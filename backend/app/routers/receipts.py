"""Upload receipt images and run the OCR / structuring pipeline."""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from starlette.concurrency import run_in_threadpool

from app.processing import receipt_processor
from app.schemas.receipt import ReceiptProcessedOut


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
