from __future__ import annotations

import base64
import json
import math
import os
import re
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from mistralai import Mistral
from mistralai.models.chat_completion import ChatMessage

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_BACKEND_ROOT / ".env")


def _require_mistral_api_key() -> str:
    key = os.environ.get("MISTRAL_API_KEY", "").strip()
    if not key:
        raise RuntimeError(
            "MISTRAL_API_KEY is not set. Add it to `.env` in the backend folder "
            "(see `.env.example`) or export it in your environment."
        )
    return key


# ── constants ────────────────────────────────────────────────────────────────

VISION_MODEL = "mistral-ocr"       # vision-capable; used for image passes
TEXT_MODEL = "mistral-small"       # text-only; used for interpret + translate

MAX_TOKENS = 2048
TOTAL_TOLERANCE = 0.02             # ±2 cents rounding slack per item

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
MEDIA_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
}


# ── data model ───────────────────────────────────────────────────────────────

@dataclass
class LineItem:
    name: str
    quantity: float
    unit_price: float
    total_price: float
    notes: str = ""
    language: str = "und"  # BCP-47 tag for this label; user may override


@dataclass
class ReceiptData:
    merchant_name: str
    merchant_address: str
    date: str                       # ISO-8601 when parseable, raw string otherwise
    time: str
    items: list[LineItem]
    subtotal: float
    vat_rate_pct: Optional[float]
    vat_amount: Optional[float]
    tip: Optional[float]
    total: float
    currency: str
    ocr_sum_verified: bool
    raw_text: str

    @property
    def languages(self) -> list[str]:
        return sorted({item.language for item in self.items})

    def to_dict(self) -> dict:
        d = asdict(self)
        d["languages"] = self.languages
        return d


@dataclass
class InterpretedItem:
    original_name: str
    interpreted_name: str
    interpreted: bool
    language: str
    index: int


@dataclass
class TranslatedItem:
    original_name: str
    translated_name: str
    source_language: str
    index: int


@dataclass
class ProcessResult:
    ok: bool
    reason: str = ""
    data: Optional[ReceiptData] = None
    json_path: Optional[Path] = None

    # ── label interpretation ──────────────────────────────────────────────────

    def interpret_labels(self) -> list[InterpretedItem]:
        if not self.ok or self.data is None:
            raise RuntimeError("Cannot interpret labels on a failed ProcessResult.")

        client = Mistral(api_key=_require_mistral_api_key())
        items = self.data.items

        by_language: dict[str, list[int]] = {}
        for idx, item in enumerate(items):
            by_language.setdefault(item.language, []).append(idx)

        results: dict[int, InterpretedItem] = {}

        for lang, indices in by_language.items():
            label_list = "\n".join(f'{idx}. "{items[idx].name}"' for idx in indices)
            lang_desc = (
                f"language tag '{lang}'" if lang != "und" else "an unidentified language"
            )
            context = (
                f'Merchant: "{self.data.merchant_name}". '
                f'The following labels are in {lang_desc}.'
            )
            prompt = f"""
{context}

Below is a numbered list of item labels from a receipt. Many are abbreviated,
use brand shorthand, or contain store codes.

Your task: for each label produce a plain-language rewrite in English using the format:
  "Description of item (Brand)"
Omit the brand parenthetical if no brand is identifiable from the label.

If you genuinely cannot identify what the item is (e.g. a pure numeric PLU code,
an internal store SKU, or too ambiguous), set interpreted to false and copy the
original label unchanged into interpreted_name.

Labels:
{label_list}

Return a JSON array with exactly {len(indices)} objects, preserving the original
index numbers (do not renumber them):
[
  {{"index": <original_index>, "interpreted_name": "...", "interpreted": true}},
  ...
]
"""
            raw = _call_mistral_text(client, prompt)
            cleaned = _strip_fences(raw)
            start, end = cleaned.find("["), cleaned.rfind("]") + 1
            if start == -1 or end == 0:
                raise ValueError(
                    f"No JSON array in interpret_labels response:\n{raw}"
                )
            entries = json.loads(cleaned[start:end])

            for e in entries:
                idx = int(e["index"])
                results[idx] = InterpretedItem(
                    original_name=items[idx].name,
                    interpreted_name=str(e["interpreted_name"]),
                    interpreted=bool(e.get("interpreted", True)),
                    language=items[idx].language,
                    index=idx,
                )

        return [
            results.get(
                i,
                InterpretedItem(
                    original_name=items[i].name,
                    interpreted_name=items[i].name,
                    interpreted=False,
                    language=items[i].language,
                    index=i,
                ),
            )
            for i in range(len(items))
        ]

    # ── translation ───────────────────────────────────────────────────────────

    def translate(
        self,
        target_language: str,
        interpreted: Optional[list[InterpretedItem]] = None,
    ) -> list[TranslatedItem]:
        if not self.ok or self.data is None:
            raise RuntimeError("Cannot translate on a failed ProcessResult.")

        client = Mistral(api_key=_require_mistral_api_key())
        items = self.data.items

        if interpreted is not None:
            interp_map = {ii.index: ii.interpreted_name for ii in interpreted}
            source_names = [
                interp_map.get(i, item.name) for i, item in enumerate(items)
            ]
        else:
            source_names = [item.name for item in items]

        label_list = "\n".join(
            f'{i}. "{name}" [source language: {items[i].language}]'
            for i, name in enumerate(source_names)
        )
        prompt = f"""
Translate each of the following receipt item labels into {target_language}.
Each label is annotated with its source language as a hint.
Preserve quantity descriptors. Do not translate brand names — keep them as-is
and only translate the descriptive portion of the label.

Labels:
{label_list}

Return a JSON array with exactly {len(items)} objects, in the same order:
[
  {{"index": 0, "translated_name": "..."}},
  ...
]
"""
        raw = _call_mistral_text(client, prompt)
        cleaned = _strip_fences(raw)
        start, end = cleaned.find("["), cleaned.rfind("]") + 1
        if start == -1 or end == 0:
            raise ValueError(f"No JSON array in translate response:\n{raw}")
        entries = json.loads(cleaned[start:end])

        return [
            TranslatedItem(
                original_name=source_names[e["index"]],
                translated_name=str(e["translated_name"]),
                source_language=items[e["index"]].language,
                index=int(e["index"]),
            )
            for e in entries
        ]


# ── helpers ───────────────────────────────────────────────────────────────────

def _encode_image(image_path: Path) -> str:
    with open(image_path, "rb") as fh:
        return base64.standard_b64encode(fh.read()).decode("utf-8")


def _media_type(image_path: Path) -> str:
    ext = image_path.suffix.lower()
    if ext not in MEDIA_TYPES:
        raise ValueError(
            f"Unsupported image format '{ext}'. "
            f"Accepted: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )
    return MEDIA_TYPES[ext]


def _strip_fences(raw: str) -> str:
    return re.sub(r"```(?:json)?", "", raw).replace("```", "").strip()


def _call_mistral_vision(
    client: Mistral,
    system: str,
    b64: str,
    media_type: str,
    user_text: str,
) -> str:
    data_uri = f"data:{media_type};base64,{b64}"
    response = client.vision.complete(
        model=VISION_MODEL,
        messages=[
            ChatMessage(role="system", content=system),
            ChatMessage(
                role="user",
                content=[
                    {"type": "image_url", "image_url": {"url": data_uri}},
                    {"type": "text", "text": user_text},
                ],
            ),
        ],
        max_tokens=MAX_TOKENS,
    )
    return response.choices[0].message.content.strip()


def _call_mistral_text(
    client: Mistral, user_text: str, system: str = ""
) -> str:
    messages: list[ChatMessage] = []
    if system:
        messages.append(ChatMessage(role="system", content=system))
    messages.append(ChatMessage(role="user", content=user_text))
    response = client.chat.complete(
        model=TEXT_MODEL,
        messages=messages,
        max_tokens=MAX_TOKENS,
    )
    return response.choices[0].message.content.strip()


def _parse_json_block(raw: str) -> dict:
    cleaned = _strip_fences(raw)
    start = cleaned.find("{")
    end = cleaned.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"No JSON object found in response:\n{raw}")
    return json.loads(cleaned[start:end])


def _verify_total(data: ReceiptData) -> bool:
    item_sum = sum(item.total_price for item in data.items)
    tip = data.tip or 0.0
    vat = data.vat_amount or 0.0
    strategy_a = math.isclose(
        item_sum + tip,
        data.total,
        abs_tol=TOTAL_TOLERANCE * (len(data.items) + 1),
    )
    strategy_b = math.isclose(
        item_sum + vat + tip,
        data.total,
        abs_tol=TOTAL_TOLERANCE * (len(data.items) + 1),
    )
    return strategy_a or strategy_b


# ── pipeline steps ────────────────────────────────────────────────────────────

def _step1_detect_receipt(
    client: Mistral, b64: str, media_type: str
) -> tuple[bool, str]:
    system = (
        "You are a receipt-detection assistant. "
        "Respond ONLY with a JSON object – no prose, no markdown fences."
    )
    prompt = (
        "Examine this image and answer three questions:\n"
        "1. is_receipt: is this clearly a photo of a paper/digital receipt or invoice? (true/false)\n"
        "2. quality_ok: is the text legible – not blurry, not cut off, not too dark/bright, "
        "no critical numbers obscured? (true/false)\n"
        "3. quality_issue: if quality_ok is false, describe concisely what is wrong. "
        "Empty string when quality_ok is true.\n\n"
        'Return ONLY: {"is_receipt": bool, "quality_ok": bool, "quality_issue": string}'
    )
    raw = _call_mistral_vision(client, system, b64, media_type, prompt)
    result = _parse_json_block(raw)
    is_receipt = bool(result.get("is_receipt", False))
    quality_ok = bool(result.get("quality_ok", True))
    quality_issue = result.get("quality_issue", "")
    return is_receipt, ("" if quality_ok else quality_issue)


def _step2_ocr_extract(
    client: Mistral, b64: str, media_type: str
) -> ReceiptData:
    system = (
        "You are an expert receipt OCR engine. "
        "Extract every piece of information from the receipt image. "
        "Respond ONLY with a single valid JSON object – no prose, no markdown."
    )
    schema_hint = """
{
  "merchant_name": "string",
  "merchant_address": "string",
  "date": "YYYY-MM-DD or raw string",
  "time": "HH:MM or raw string or empty",
  "currency": "USD | EUR | GBP | … or raw symbol",
  "items": [
    {
      "name": "string",
      "quantity": number,
      "unit_price": number,
      "total_price": number,
      "notes": "string (discounts, modifiers, etc.) or empty",
      "language": "BCP-47 tag for the language of this specific label"
    }
  ],
  "subtotal": number,
  "vat_rate_pct": number or null,
  "vat_amount": number or null,
  "tip": number or null,
  "total": number,
  "raw_text": "full verbatim text of the receipt as a single string"
}

Rules:
- All prices are plain numbers (no currency symbols).
- If a tip was hand-written or added at the end, include it as a regular item
  AND also set the top-level "tip" field.
- If a field is genuinely absent on the receipt, use null.
- Do NOT invent or guess values; transcribe only what is visible.
- For "language" on each item: identify the language of that specific label.
  Many receipts mix languages — e.g. items in Slovak but brand names in English.
  Use "und" if genuinely indeterminate (e.g. a pure numeric code).
"""
    raw = _call_mistral_vision(
        client,
        system,
        b64,
        media_type,
        f"Extract the receipt data into this JSON schema:\n{schema_hint}",
    )
    d = _parse_json_block(raw)
    items = [
        LineItem(
            name=i["name"],
            quantity=float(i.get("quantity", 1)),
            unit_price=float(i.get("unit_price", i.get("total_price", 0))),
            total_price=float(i["total_price"]),
            notes=i.get("notes", ""),
            language=str(i.get("language", "und")),
        )
        for i in d.get("items", [])
    ]
    return ReceiptData(
        merchant_name=d.get("merchant_name", ""),
        merchant_address=d.get("merchant_address", ""),
        date=d.get("date", ""),
        time=d.get("time", ""),
        items=items,
        subtotal=float(d.get("subtotal", 0)),
        vat_rate_pct=float(d["vat_rate_pct"])
        if d.get("vat_rate_pct") is not None
        else None,
        vat_amount=float(d["vat_amount"])
        if d.get("vat_amount") is not None
        else None,
        tip=float(d["tip"]) if d.get("tip") is not None else None,
        total=float(d.get("total", 0)),
        currency=d.get("currency", ""),
        ocr_sum_verified=False,
        raw_text=d.get("raw_text", ""),
    )


def _step3_save(data: ReceiptData, image_path: Path, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    stem = image_path.stem
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = output_dir / f"{stem}_{timestamp}.json"
    with open(json_path, "w", encoding="utf-8") as fh:
        json.dump(data.to_dict(), fh, indent=2, ensure_ascii=False)
    return json_path


# ── public entry point ────────────────────────────────────────────────────────

def process_receipt(
    image_path: str | Path, output_dir: str | Path = "."
) -> ProcessResult:
    image_path = Path(image_path)
    output_dir = Path(output_dir)

    if not image_path.exists():
        return ProcessResult(ok=False, reason=f"File not found: {image_path}")

    try:
        mt = _media_type(image_path)
    except ValueError as exc:
        return ProcessResult(ok=False, reason=str(exc))

    client = Mistral(api_key=_require_mistral_api_key())
    b64 = _encode_image(image_path)

    try:
        is_receipt, quality_issue = _step1_detect_receipt(client, b64, mt)
    except Exception as exc:
        return ProcessResult(ok=False, reason=f"Detection step failed: {exc}")

    if not is_receipt:
        return ProcessResult(
            ok=False,
            reason="The image does not appear to be a receipt. Please retake the photo.",
        )
    if quality_issue:
        return ProcessResult(
            ok=False,
            reason=f"Image quality issue — {quality_issue}. Please retake the photo.",
        )

    try:
        receipt_data = _step2_ocr_extract(client, b64, mt)
    except Exception as exc:
        return ProcessResult(ok=False, reason=f"OCR extraction failed: {exc}")

    receipt_data.ocr_sum_verified = _verify_total(receipt_data)

    try:
        json_path = _step3_save(receipt_data, image_path, output_dir)
    except Exception as exc:
        return ProcessResult(ok=False, reason=f"Could not save JSON: {exc}")

    return ProcessResult(ok=True, data=receipt_data, json_path=json_path)


# ── CLI smoke-test ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python receipt_processor.py <image> [output_dir]")
        print(f"  Supported formats: {', '.join(sorted(SUPPORTED_EXTENSIONS))}")
        sys.exit(1)

    img = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "."
    result = process_receipt(img, out)

    if not result.ok:
        print(f"✗ Processing failed: {result.reason}")
        sys.exit(2)

    d = result.data
    print("✓ Receipt processed successfully.")
    print(
        f"  Languages    : {d.languages}  "
        "(override via result.data.items[n].language = 'xx')"
    )
    print(f"  OCR verified : {d.ocr_sum_verified}")
    print(f"  JSON saved   : {result.json_path}")

    print("\n── Items with detected languages:")
    for i, item in enumerate(d.items):
        print(f"  [{i}] ({item.language}) {item.name!r}")

    print("\n── Interpreting labels …")
    interpreted = result.interpret_labels()
    for ii in interpreted:
        flag = "" if ii.interpreted else "  ⚑ unrecognised"
        print(
            f"  [{ii.index}] ({ii.language}) "
            f"{ii.original_name!r:30s} → {ii.interpreted_name!r}{flag}"
        )

    print("\n── Translating to English …")
    translated = result.translate("English", interpreted=interpreted)
    for ti in translated:
        print(
            f"  [{ti.index}] [{ti.source_language}] "
            f"{ti.original_name!r:30s} → {ti.translated_name!r}"
        )
