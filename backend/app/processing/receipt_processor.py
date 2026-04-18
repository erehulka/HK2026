"""
receipt_processor.py
────────────────────
Pipeline:
  1. Detect whether the image is a receipt.
  2. Quality-gate: reject blurry / illegible images with a reason string.
  3. OCR + structured extraction (items, prices, VAT, total, tip).
  4. Verify OCR: sum(items) == printed total.
  5. Detect receipt language (script analysis → Claude fallback).
  6. Persist result as JSON.

Public surface
──────────────
    result = process_receipt(image_path, output_dir=".") -> ProcessResult

    ProcessResult.ok              – bool
    ProcessResult.reason          – human-readable explanation (on failure)
    ProcessResult.data            – ReceiptData (on success)
    ProcessResult.json_path       – Path of saved JSON (on success)
    ProcessResult.interpret_labels() -> list[InterpretedItem]
    ProcessResult.translate(target_language, interpreted=None) -> list[TranslatedItem]

Language detection strategy
────────────────────────────
Short receipts (<50 words) make pure statistical langdetect unreliable.
We use a two-stage approach:

  Stage 1 — unicodedata script census (zero dependencies, instant):
    Tallies characters by Unicode block (Cyrillic, Arabic, CJK, Hangul,
    Devanagari, Greek, Hebrew, Latin, …). If a non-Latin script dominates
    (>30 % of alpha chars) we can name the script family with high confidence
    and stop. The unicodedata module is part of the Python standard library.

  Stage 2 — Claude micro-call (only when script is Latin/ambiguous):
    Sends raw_text to Claude with a minimal prompt asking for the BCP-47 tag.
    Adds one small API call but is far more accurate than frequency analysis
    on 20-word café receipts.

The detected language is stored as a BCP-47 tag (e.g. "en", "fr", "sk")
in ReceiptData.language. The user may override this field freely.
"""

from __future__ import annotations

import base64
import json
import math
import re
import unicodedata
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional

import anthropic  # pip install anthropic

# ── constants ────────────────────────────────────────────────────────────────

MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 2048
TOTAL_TOLERANCE = 0.02              # ±2 cents rounding slack per item

# Minimum share of alphabetic characters a non-Latin script must own to be
# declared dominant (skipping the Claude fallback).
SCRIPT_DOMINANCE_THRESHOLD = 0.30

# ── Unicode block → (script_name, bcp47_tag) ─────────────────────────────────
# Covers the most common non-Latin scripts found on receipts worldwide.
# Latin is intentionally absent — it always falls through to Stage 2.
_BLOCK_MAP: list[tuple[range, str, str]] = [
    (range(0x0400, 0x0500), "Cyrillic",   "und-Cyrl"),  # ru/uk/bg/…; Claude resolves
    (range(0x0370, 0x0400), "Greek",      "el"),
    (range(0x0590, 0x0600), "Hebrew",     "he"),
    (range(0x0600, 0x0700), "Arabic",     "ar"),
    (range(0x0900, 0x0980), "Devanagari", "hi"),
    (range(0x0980, 0x0A00), "Bengali",    "bn"),
    (range(0x0A80, 0x0B00), "Gujarati",   "gu"),
    (range(0x0B80, 0x0C00), "Tamil",      "ta"),
    (range(0x0C00, 0x0C80), "Telugu",     "te"),
    (range(0x0C80, 0x0D00), "Kannada",    "kn"),
    (range(0x0D00, 0x0D80), "Malayalam",  "ml"),
    (range(0x0E00, 0x0E80), "Thai",       "th"),
    (range(0x1100, 0x1200), "Hangul",     "ko"),
    (range(0xAC00, 0xD7A4), "Hangul",     "ko"),
    (range(0x3040, 0x30A0), "Hiragana",   "ja"),
    (range(0x30A0, 0x3100), "Katakana",   "ja"),
    (range(0x4E00, 0xA000), "CJK",        "zh"),        # ja/zh ambiguous; Claude resolves
    (range(0x3400, 0x4DC0), "CJK",        "zh"),
]


def _script_census(text: str) -> dict[str, int]:
    """Count alphabetic characters by Unicode script block."""
    counts: Counter[str] = Counter()
    for ch in text:
        if not ch.isalpha():
            continue
        cp = ord(ch)
        matched = False
        for r, script, _ in _BLOCK_MAP:
            if cp in r:
                counts[script] += 1
                matched = True
                break
        if not matched:
            counts["Latin"] += 1    # everything else treated as Latin
    return dict(counts)


def _detect_language_from_script(text: str) -> tuple[Optional[str], bool]:
    """
    Stage-1 detection via Unicode script census.

    Returns (bcp47_tag_or_None, needs_claude_fallback).
    Non-Latin dominant → return its tag, fallback=False.
    Latin dominant or too little signal → return None, fallback=True.
    """
    census = _script_census(text)
    total_alpha = sum(census.values())
    if total_alpha < 5:
        return None, True

    dominant_script = max(census, key=census.__getitem__)
    dominant_share = census[dominant_script] / total_alpha

    if dominant_script != "Latin" and dominant_share >= SCRIPT_DOMINANCE_THRESHOLD:
        for _, script, tag in _BLOCK_MAP:
            if script == dominant_script:
                return tag, False
    return None, True


def _detect_language_claude(client: anthropic.Anthropic, text: str) -> str:
    """
    Stage-2 fallback: ask Claude for a BCP-47 language tag.
    Returns a BCP-47 tag string, or "und" (undetermined) on failure.
    """
    system = (
        "You are a language identification assistant. "
        "Respond with ONLY a BCP-47 language tag (e.g. 'en', 'fr', 'sk', 'de'). "
        "No explanation, no punctuation, nothing else."
    )
    try:
        raw = _call_claude(client, system, [
            {"type": "text",
             "text": f"What language is this receipt text written in?\n\n{text[:800]}"}
        ])
        tag = re.split(r"\s", raw.strip())[0].lower()
        tag = re.sub(r"[^a-z\-]", "", tag)
        return tag if tag else "und"
    except Exception:
        return "und"


def detect_language(client: anthropic.Anthropic, raw_text: str) -> str:
    """
    Detect the language of receipt raw_text. Returns a BCP-47 tag.
    Stage 1: stdlib unicodedata script census (free, instant).
    Stage 2: Claude micro-call (only for Latin-script / ambiguous text).
    Falls back to "und" on any error. User may override ReceiptData.language.
    """
    tag, needs_fallback = _detect_language_from_script(raw_text)
    if not needs_fallback and tag:
        return tag
    return _detect_language_claude(client, raw_text)


# ── data model ───────────────────────────────────────────────────────────────

@dataclass
class LineItem:
    name: str
    quantity: float
    unit_price: float
    total_price: float
    notes: str = ""


@dataclass
class ReceiptData:
    merchant_name: str
    merchant_address: str
    date: str                       # ISO-8601 when parseable, raw string otherwise
    time: str
    items: list[LineItem]
    subtotal: float
    vat_rate_pct: Optional[float]   # e.g. 20.0 for 20 %
    vat_amount: Optional[float]
    tip: Optional[float]            # None if no tip was present
    total: float
    currency: str                   # ISO-4217 when detectable, else raw symbol
    ocr_sum_verified: bool          # True when computed sum matches printed total
    raw_text: str                   # full text as extracted by the model
    language: str = "und"           # BCP-47; user may override freely


@dataclass
class InterpretedItem:
    """Result of ProcessResult.interpret_labels() for one line item."""
    original_name: str
    interpreted_name: str           # "Description (Brand)" or unchanged original
    interpreted: bool               # False = unrecognisable; left unchanged
    index: int                      # matches position in ReceiptData.items


@dataclass
class TranslatedItem:
    """Result of ProcessResult.translate() for one line item."""
    original_name: str
    translated_name: str
    index: int                      # matches position in ReceiptData.items


@dataclass
class ProcessResult:
    ok: bool
    reason: str = ""
    data: Optional[ReceiptData] = None
    json_path: Optional[Path] = None

    # ── label interpretation ──────────────────────────────────────────────────

    def interpret_labels(self) -> list[InterpretedItem]:
        """
        Rewrite receipt labels from cryptic/abbreviated form to plain language,
        using the format: "Description of item (Brand, if identifiable)".

        All labels are sent to Claude in a single batch call (one API round-trip).
        Items that cannot be identified are left unchanged and flagged with
        interpreted=False — suitable for surfacing to the user for manual review.

        Known limitations
        ─────────────────
        • Brand knowledge is limited to Claude's training data. Obscure regional
          chains and store-specific SKU codes will typically be flagged.
        • Purely numeric PLU/barcode codes (e.g. "4011", "PLU 0024") will almost
          always be flagged as unrecognisable.
        • Results are non-deterministic; borderline labels may vary between calls.
        • The model has no internet access; it cannot look up unknown products.

        Returns list[InterpretedItem], same length and order as ReceiptData.items.
        Raises RuntimeError if ProcessResult.ok is False.
        """
        if not self.ok or self.data is None:
            raise RuntimeError("Cannot interpret labels on a failed ProcessResult.")

        client = anthropic.Anthropic()
        items = self.data.items

        label_list = "\n".join(f'{i}. "{item.name}"' for i, item in enumerate(items))
        context = (
            f'Merchant: "{self.data.merchant_name}". '
            f'Receipt language: "{self.data.language}".'
        )
        system = (
            "You are a receipt label interpreter. "
            "Respond ONLY with a JSON array – no prose, no markdown fences."
        )
        prompt = f"""
{context}

Below is a numbered list of item labels from a receipt. Many are abbreviated,
use brand shorthand, or contain store codes.

Your task: for each label produce a plain-language rewrite using the format:
  "Description of item (Brand)"
Omit the brand parenthetical if no brand is identifiable from the label.

If you genuinely cannot identify what the item is (e.g. it is a pure numeric
PLU code, an internal store SKU, or too ambiguous), set interpreted to false
and copy the original label unchanged into interpreted_name.

Labels:
{label_list}

Return a JSON array with exactly {len(items)} objects, in the same order:
[
  {{"index": 0, "interpreted_name": "...", "interpreted": true}},
  ...
]
"""
        raw = _call_claude(client, system, [{"type": "text", "text": prompt}])
        cleaned = re.sub(r"```(?:json)?", "", raw).replace("```", "").strip()
        start, end = cleaned.find("["), cleaned.rfind("]") + 1
        if start == -1 or end == 0:
            raise ValueError(f"No JSON array in interpret_labels response:\n{raw}")
        entries = json.loads(cleaned[start:end])

        return [
            InterpretedItem(
                original_name=items[e["index"]].name,
                interpreted_name=str(e["interpreted_name"]),
                interpreted=bool(e.get("interpreted", True)),
                index=int(e["index"]),
            )
            for e in entries
        ]

    # ── translation ───────────────────────────────────────────────────────────

    def translate(self,
                  target_language: str,
                  interpreted: Optional[list[InterpretedItem]] = None
                  ) -> list[TranslatedItem]:
        """
        Translate all item labels into target_language.

        Parameters
        ----------
        target_language : str
            Natural language name or BCP-47 tag — e.g. "French", "fr",
            "Slovak", "sk", "Simplified Chinese", "zh-Hans".

        interpreted : list[InterpretedItem] | None
            If you have already called interpret_labels(), pass the result here.
            Translation will then work on the cleaner interpreted_name values
            rather than raw receipt abbreviations, producing better output.
            When None, raw item names from ReceiptData are used.

        Returns list[TranslatedItem], same length and order as ReceiptData.items.
        Raises RuntimeError if ProcessResult.ok is False.
        """
        if not self.ok or self.data is None:
            raise RuntimeError("Cannot translate on a failed ProcessResult.")

        client = anthropic.Anthropic()
        items = self.data.items

        if interpreted is not None:
            interp_map = {ii.index: ii.interpreted_name for ii in interpreted}
            source_names = [interp_map.get(i, item.name) for i, item in enumerate(items)]
        else:
            source_names = [item.name for item in items]

        label_list = "\n".join(f'{i}. "{name}"' for i, name in enumerate(source_names))
        system = (
            "You are a professional translator specialising in grocery and retail receipts. "
            "Respond ONLY with a JSON array – no prose, no markdown fences."
        )
        prompt = f"""
Translate each of the following receipt item labels into {target_language}.
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
        raw = _call_claude(client, system, [{"type": "text", "text": prompt}])
        cleaned = re.sub(r"```(?:json)?", "", raw).replace("```", "").strip()
        start, end = cleaned.find("["), cleaned.rfind("]") + 1
        if start == -1 or end == 0:
            raise ValueError(f"No JSON array in translate response:\n{raw}")
        entries = json.loads(cleaned[start:end])

        return [
            TranslatedItem(
                original_name=source_names[e["index"]],
                translated_name=str(e["translated_name"]),
                index=int(e["index"]),
            )
            for e in entries
        ]


# ── helpers ───────────────────────────────────────────────────────────────────

def _encode_image(image_path: Path) -> str:
    with open(image_path, "rb") as fh:
        return base64.standard_b64encode(fh.read()).decode("utf-8")


def _call_claude(client: anthropic.Anthropic, system: str, user_content: list) -> str:
    msg = client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=system,
        messages=[{"role": "user", "content": user_content}],
    )
    return msg.content[0].text.strip()


def _parse_json_block(raw: str) -> dict:
    cleaned = re.sub(r"```(?:json)?", "", raw).replace("```", "").strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"No JSON object found in response:\n{raw}")
    return json.loads(cleaned[start:end])


def _verify_total(data: ReceiptData) -> bool:
    item_sum = sum(item.total_price for item in data.items)
    tip = data.tip or 0.0
    vat = data.vat_amount or 0.0
    strategy_a = math.isclose(item_sum + tip, data.total,
                              abs_tol=TOTAL_TOLERANCE * (len(data.items) + 1))
    strategy_b = math.isclose(item_sum + vat + tip, data.total,
                              abs_tol=TOTAL_TOLERANCE * (len(data.items) + 1))
    return strategy_a or strategy_b


# ── pipeline steps ────────────────────────────────────────────────────────────

def _step1_detect_receipt(client: anthropic.Anthropic, b64: str) -> tuple[bool, str]:
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
    raw = _call_claude(client, system, [
        {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}},
        {"type": "text", "text": prompt},
    ])
    result = _parse_json_block(raw)
    is_receipt = bool(result.get("is_receipt", False))
    quality_ok = bool(result.get("quality_ok", True))
    quality_issue = result.get("quality_issue", "")
    return is_receipt, ("" if quality_ok else quality_issue)


def _step2_ocr_extract(client: anthropic.Anthropic, b64: str) -> ReceiptData:
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
      "notes": "string (discounts, modifiers, etc.) or empty"
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
"""
    raw = _call_claude(client, system, [
        {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": b64}},
        {"type": "text", "text": f"Extract the receipt data into this JSON schema:\n{schema_hint}"},
    ])
    d = _parse_json_block(raw)
    items = [
        LineItem(
            name=i["name"],
            quantity=float(i.get("quantity", 1)),
            unit_price=float(i.get("unit_price", i.get("total_price", 0))),
            total_price=float(i["total_price"]),
            notes=i.get("notes", ""),
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
        vat_rate_pct=float(d["vat_rate_pct"]) if d.get("vat_rate_pct") is not None else None,
        vat_amount=float(d["vat_amount"]) if d.get("vat_amount") is not None else None,
        tip=float(d["tip"]) if d.get("tip") is not None else None,
        total=float(d.get("total", 0)),
        currency=d.get("currency", ""),
        ocr_sum_verified=False,
        raw_text=d.get("raw_text", ""),
        language="und",
    )


def _step3_save(data: ReceiptData, image_path: Path, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    stem = image_path.stem
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = output_dir / f"{stem}_{timestamp}.json"
    with open(json_path, "w", encoding="utf-8") as fh:
        json.dump(asdict(data), fh, indent=2, ensure_ascii=False)
    return json_path


# ── public entry point ────────────────────────────────────────────────────────

def process_receipt(image_path: str | Path,
                    output_dir: str | Path = ".") -> ProcessResult:
    """
    Full receipt-processing pipeline.

    Parameters
    ----------
    image_path : path to a JPEG image captured from a camera.
    output_dir : directory where the output JSON will be saved.

    Returns
    -------
    ProcessResult
        .ok        – False if the image was rejected or extraction failed.
        .reason    – human-readable message (always populated on failure).
        .data      – ReceiptData on success, None on failure.
        .json_path – Path of saved JSON on success, None on failure.

    Post-processing (only when .ok is True):
        .interpret_labels()                        -> list[InterpretedItem]
        .translate(target_language, interpreted)   -> list[TranslatedItem]
    """
    image_path = Path(image_path)
    output_dir = Path(output_dir)

    if not image_path.exists():
        return ProcessResult(ok=False, reason=f"File not found: {image_path}")

    client = anthropic.Anthropic()
    b64 = _encode_image(image_path)

    # Steps 1 & 2 — detection + quality gate
    try:
        is_receipt, quality_issue = _step1_detect_receipt(client, b64)
    except Exception as exc:
        return ProcessResult(ok=False, reason=f"Detection step failed: {exc}")

    if not is_receipt:
        return ProcessResult(ok=False,
            reason="The image does not appear to be a receipt. Please retake the photo.")
    if quality_issue:
        return ProcessResult(ok=False,
            reason=f"Image quality issue — {quality_issue}. Please retake the photo.")

    # Step 3 — OCR + structured extraction
    try:
        receipt_data = _step2_ocr_extract(client, b64)
    except Exception as exc:
        return ProcessResult(ok=False, reason=f"OCR extraction failed: {exc}")

    # Step 4 — OCR total verification
    receipt_data.ocr_sum_verified = _verify_total(receipt_data)

    # Step 5 — Language detection (non-fatal)
    try:
        receipt_data.language = detect_language(client, receipt_data.raw_text)
    except Exception:
        receipt_data.language = "und"

    # Step 6 — Persist to disk
    try:
        json_path = _step3_save(receipt_data, image_path, output_dir)
    except Exception as exc:
        return ProcessResult(ok=False, reason=f"Could not save JSON: {exc}")

    return ProcessResult(ok=True, data=receipt_data, json_path=json_path)


# ── CLI smoke-test ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python receipt_processor.py <image.jpg> [output_dir]")
        sys.exit(1)

    img = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "."
    result = process_receipt(img, out)

    if not result.ok:
        print(f"✗ Processing failed: {result.reason}")
        sys.exit(2)

    d = result.data
    print("✓ Receipt processed successfully.")
    print(f"  Language     : {d.language}  (override via result.data.language = 'xx')")
    print(f"  OCR verified : {d.ocr_sum_verified}")
    print(f"  JSON saved   : {result.json_path}")

    print("\n── Interpreting labels …")
    interpreted = result.interpret_labels()
    for ii in interpreted:
        flag = "" if ii.interpreted else "  ⚑ unrecognised"
        print(f"  [{ii.index}] {ii.original_name!r:30s} → {ii.interpreted_name!r}{flag}")

    print("\n── Translating to French …")
    translated = result.translate("French", interpreted=interpreted)
    for ti in translated:
        print(f"  [{ti.index}] {ti.original_name!r:30s} → {ti.translated_name!r}")
