"""Upload receipt images and run the OCR / structuring pipeline."""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Body, File, HTTPException, UploadFile, status
from starlette.concurrency import run_in_threadpool

from app.processing import receipt_processor
from app.schemas.receipt import (
    ReceiptEnhancedLineOut,
    ReceiptInterpretTranslateIn,
    ReceiptEnhancedLabelsOut,
    ReceiptProcessedOut,
)


def _pick_image_suffix(filename: str | None, content_type: str | None) -> str:
    if filename:
        ext = Path(filename).suffix.lower()
        if ext in receipt_processor.SUPPORTED_EXTENSIONS:
            return ext
    ct = (content_type or "").split(";")[0].strip().lower()
    if ct == "image/jpeg":
        return ".jpg"
    if ct == "image/png":
        return ".png"
    raise HTTPException(
        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        detail=(
            "Unsupported image type. "
            f"Accepted extensions: {', '.join(sorted(receipt_processor.SUPPORTED_EXTENSIONS))}"
        ),
    )


router = APIRouter(prefix="/receipts", tags=["receipts"])


@router.post(
    "/process",
    summary="Upload a receipt photo and get structured JSON",
    response_model=ReceiptProcessedOut,
)
async def process_receipt_upload(
    file: UploadFile = File(..., description="Receipt image (JPEG or PNG)"),
) -> ReceiptProcessedOut:
    suffix = _pick_image_suffix(file.filename, file.content_type)

    tmp_dir = Path(tempfile.mkdtemp(prefix="receipt_upload_"))
    image_path = tmp_dir / f"{uuid4().hex}{suffix}"
    try:
        with image_path.open("wb") as out:
            shutil.copyfileobj(file.file, out)

        result = await run_in_threadpool(
            receipt_processor.process_receipt,
            image_path,
            save_json=False,
        )
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

    if not result.ok or result.data is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.reason or "Receipt processing failed",
        )

    return ReceiptProcessedOut.model_validate(result.data.to_dict())


def _interpret_translate_sync(body: ReceiptInterpretTranslateIn) -> ReceiptEnhancedLabelsOut:
    snapshot = receipt_processor.ReceiptLabelsSnapshot(
        summary_label=body.summary_label,
        lines=[
            receipt_processor.LabelLine(name=li.name, language=li.language)
            for li in body.items
        ],
    )
    _interpreted, translated = receipt_processor.interpret_and_translate_labels(snapshot)
    lines: list[ReceiptEnhancedLineOut] = []
    for ti in sorted(translated, key=lambda t: t.index):
        raw = (
            snapshot.lines[ti.index].name
            if 0 <= ti.index < len(snapshot.lines)
            else ti.original_name
        )
        lines.append(
            ReceiptEnhancedLineOut(
                index=ti.index,
                original_name=raw,
                enhanced_name=ti.enhanced_name,
            )
        )
    return ReceiptEnhancedLabelsOut(lines=lines)


@router.post(
    "/interpret-translate",
    summary="Enhance receipt line labels to English (stateless)",
    response_model=ReceiptEnhancedLabelsOut,
)
async def interpret_translate_receipt(
    body: ReceiptInterpretTranslateIn = Body(...),
) -> ReceiptEnhancedLabelsOut:
    """
    Expands abbreviated labels and translates them to English. Response is only the
    enhanced lines (`original_name` from the receipt, `enhanced_name` in English).
    Send `summary_label` and `items` with `name` and `language` only (map from a process
    result if needed: `summary_label` plus each line’s label and language tag).
    """
    try:
        return await run_in_threadpool(_interpret_translate_sync, body)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
