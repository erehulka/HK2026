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
from pillow_heif import register_heif_opener
register_heif_opener()

from dotenv import load_dotenv
from mistralai import Mistral, models
from mistralai.types import UNSET

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

VISION_MODEL = "mistral-ocr-latest"
TEXT_MODEL = "mistral-small-latest"

MAX_TOKENS = 2048
TOTAL_TOLERANCE = 0.02  # ±2 cents rounding slack per item

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".heic", "heif"}
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
    summary_label: str
    merchant_name: str
    merchant_address: str
    date: str
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
        langs = {item.language for item in self.items}
        langs.discard("und")   # remove fallback language
        return sorted(langs)


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

Your task: for each label, produce a plain-language rewrite ONLY if the label
is clearly truncated or abbreviated.

RULES:
- If the label is already a complete, normal phrase, return it EXACTLY as-is, character by character.
- DO NOT add explanations, descriptions, parentheticals, or clarifications.
- DO NOT guess ingredients, brands, or categories.
- DO NOT add anything that was not explicitly present in the original text.
- Only expand abbreviations or obvious truncations (e.g., "GRL STK W SLD" → "Grilled steak with salad").
- If unsure, return the original label unchanged.

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


def _assistant_text(response: models.ChatCompletionResponse) -> str:
    content = response.choices[0].message.content
    if content is UNSET or content is None:
        return ""
    if isinstance(content, str):
        return content.strip()
    parts: list[str] = []
    for chunk in content:
        text = getattr(chunk, "text", None)
        if isinstance(text, str):
            parts.append(text)
    return "".join(parts).strip()


def _call_mistral_text(
    client: Mistral, user_text: str, system: str = ""
) -> str:
    messages: list[dict[str, str]] = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": user_text})
    response = client.chat.complete(
        model=TEXT_MODEL,
        messages=messages,
        max_tokens=MAX_TOKENS,
    )
    return _assistant_text(response)


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

# ── script segmentation helpers ───────────────────────────────────────────────

def _char_script(ch: str) -> str:
    code = ord(ch)

    # Latin
    if (
        0x0041 <= code <= 0x005A
        or 0x0061 <= code <= 0x007A
        or 0x00C0 <= code <= 0x024F
    ):
        return "Latin"

    # Arabic
    if (
        0x0600 <= code <= 0x06FF
        or 0x0750 <= code <= 0x077F
        or 0x08A0 <= code <= 0x08FF
        or 0xFB50 <= code <= 0xFDFF
        or 0xFE70 <= code <= 0xFEFF
    ):
        return "Arabic"

    # Cyrillic
    if 0x0400 <= code <= 0x04FF or 0x0500 <= code <= 0x052F:
        return "Cyrillic"

    # Greek
    if 0x0370 <= code <= 0x03FF:
        return "Greek"

    # Hebrew
    if 0x0590 <= code <= 0x05FF:
        return "Hebrew"

    # Devanagari
    if 0x0900 <= code <= 0x097F:
        return "Devanagari"

    # Thai
    if 0x0E00 <= code <= 0x0E7F:
        return "Thai"

    # CJK Unified Ideographs (Han)
    if 0x4E00 <= code <= 0x9FFF:
        return "Han"

    # Hiragana
    if 0x3040 <= code <= 0x309F:
        return "Hiragana"

    # Katakana
    if 0x30A0 <= code <= 0x30FF:
        return "Katakana"

    # Common (digits, punctuation, whitespace, symbols)
    return "Common"


def _segment_by_script(text: str) -> dict[str, str]:
    """
    Segment text into script-homogeneous buckets.
    'Common' characters (digits, punctuation, whitespace) are merged into the
    nearest non-Common script (Option B).
    """
    buffers: dict[str, list[str]] = {}
    last_script: Optional[str] = None

    for ch in text:
        script = _char_script(ch)
        if script == "Common":
            if last_script is None:
                continue
            buffers.setdefault(last_script, []).append(ch)
        else:
            last_script = script
            buffers.setdefault(script, []).append(ch)

    return {
        script: "".join(chars).strip()
        for script, chars in buffers.items()
        if "".join(chars).strip()
    }


# ── OCR ───────────────────────────────────────────────────────────────────────

def _run_ocr(client: Mistral, image_path: Path) -> str:
    """
    OCR pipeline for mistralai 1.12.4:
    - Convert local file to data URL
    - Pass via DocumentURLChunk(document_url=..., type="document_url")
    - Call client.ocr.process(model=..., document=...)
    - Extract text from resp.pages[0].markdown
    """
    ext = image_path.suffix.lower()

    # HEIC/HEIF → convert to PNG bytes
    if ext in {".heic", ".heif"}:
        from PIL import Image
        img = Image.open(image_path)
        img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        data = buf.getvalue()
        mime = "image/png"

    else:
        # Normal JPEG/PNG path
        with open(image_path, "rb") as f:
            data = f.read()
        mime = "image/png" if ext == ".png" else "image/jpeg"

    b64 = base64.b64encode(data).decode("utf-8")
    data_url = f"data:{mime};base64,{b64}"


    chunk = models.DocumentURLChunk(
        document_url=data_url,
        type="document_url",
    )

    resp = client.ocr.process(
        model=VISION_MODEL,
        document=chunk,
    )

    if not resp.pages:
        raise RuntimeError("OCR returned no pages")

    page = resp.pages[0]
    if not page.markdown:
        raise RuntimeError("OCR returned no markdown text")

    return page.markdown


# ── multilingual receipt classifier ───────────────────────────────────────────

def _step1_detect_receipt_from_text(
    client: Mistral, ocr_text: str
) -> tuple[bool, str]:
    """
    Detection based purely on OCR text (no vision chat).
    Multilingual-aware: receipts can be in any script/language.
    """
    system = (
        "You are a classifier that decides whether OCR text comes from a receipt. "
        "Respond ONLY with a JSON object – no prose, no markdown fences."
    )
    prompt = f"""
You are given raw OCR text extracted from an image.

Receipts can appear in ANY language and ANY script, including Arabic, Chinese,
Japanese, Cyrillic, Hebrew, Thai, Hindi, etc. Right‑to‑left text and non‑Western
numerals (e.g. Arabic‑Indic digits) are valid. In case of right-to-left text, be
aware of the pattern
price1 label1
price2 label2
...
total_price "TOTAL"
in which case pair each label with the price in its row, i.e. right before, not
with price right after.

Decide:
1. is_receipt: true if this looks like a purchase receipt or invoice in ANY
   language (merchant name, line items, prices, totals, dates, etc.).
2. quality_ok: true if the text seems sufficiently complete and legible to
   reliably read items and totals; false if large parts are missing, garbled,
   or clearly truncated.
3. quality_issue: if quality_ok is false, briefly describe the main issue.
   Use an empty string when quality_ok is true.

OCR_TEXT:
\"\"\"{ocr_text[:8000]}\"\"\"

Return ONLY:
{{
  "is_receipt": bool,
  "quality_ok": bool,
  "quality_issue": string
}}
"""
    raw = _call_mistral_text(client, prompt, system=system)
    result = _parse_json_block(raw)
    is_receipt = bool(result.get("is_receipt", False))
    quality_ok = bool(result.get("quality_ok", True))
    quality_issue = result.get("quality_issue", "")
    return is_receipt, ("" if quality_ok else quality_issue)


# ── strict, non‑hallucinating structuring ─────────────────────────────────────


def _step2_structure_from_text(
    client: Mistral, ocr_text: str
) -> ReceiptData:
    """
    Use the text model to structure OCR text into ReceiptData.
    STRICT EXTRACTIVE VERSION — no guessing, no reordering, no inference.
    """
    system = (
        "You are an expert receipt parser. "
        "You receive raw OCR text and must extract a structured JSON object. "
        "You MUST be strictly extractive. "
        "Respond ONLY with a single valid JSON object – no prose, no markdown."
    )

    schema_hint = """
Target JSON schema:

{
  "summary_label": "string",
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
      "notes": "string",
      "language": "und"
    }
  ],
  "subtotal": number,
  "vat_rate_pct": number or null,
  "vat_amount": number or null,
  "tip": number or null,
  "total": number,
  "raw_text": "full verbatim text"
}

CRITICAL RULES FOR EXTRACTION (NO GUESSING):
- DO NOT infer, compute, or guess ANY numeric value.
- DO NOT reorder numbers.
- DO NOT normalize or “fix” the receipt.
- Use ONLY numbers that appear explicitly in the OCR text.

ITEM EXTRACTION RULES:
1. If a line has exactly one price-like number:
     → quantity = 1
     → unit_price = total_price = that number

2. If a line has a name and a price on the same line:
     → treat that price as total_price
     → quantity = 1
     → unit_price = total_price

3. MULTI-LINE ITEMS (e.g.):
       DARK CHOCOLATE *
       2   £0.95      1.90
   - Treat both lines as ONE item.
   - quantity = leftmost integer on the second line
   - unit_price = first price-like number on the second line
   - total_price = rightmost price-like number on the second line

4. If a line has multiple numbers but their meaning is ambiguous:
     → quantity = 1
     → total_price = rightmost price
     → unit_price = total_price

5. NEVER compute unit_price = total_price / quantity.
6. NEVER move numbers between items.
7. If unsure, fall back to:
     → quantity = 1
     → unit_price = total_price
     → notes = "".

LANGUAGE RULE:
- Assign "und" (undetermined) to each language field--the actual value will be assigned later.

Receipts can appear in ANY language and ANY script, including Arabic, Chinese,
Japanese, Cyrillic, Hebrew, Thai, Hindi, etc. Right‑to‑left text and non‑Western
numerals (e.g. Arabic‑Indic digits) are valid. In case of right-to-left text, be
aware of the pattern
price1 label1
price2 label2
...
total_price "TOTAL"
in which case pair each label with the price in its row, i.e. right before, not
with price right after.

Data field explanations:
  -Global properties:
    -summary_label: A short, human-readable label for the receipt (i.e. "Groceries" or "Tobacco shop").
    This cannot be empty--if you cannot decide, fall back to "Receipt"
    -merchant_name: Name of shop or company if present on the receipt.
    -merchant_address: address of merchant, if present on the receipt
    -date: Date of purchase, if present on the receipt
    -time: Time of purchase, if present on the receipt
    -currency: Monetary currency as indicated by the receipt. The indication may be a single symbol, such as $ or £
    -subtotal: sum of item prices, before VAT
    -vat_rate_pct: VAT rate in percent
    -vat_amount: VAT amount added to the subtotal
    -tip: The tip, if present as an individual item (but also include it in items)
    -total: Total invoiced amount, including VAT
    -raw_text: Raw output of the OCR procedure
  -Item properties:
    -name: Label of the item
    -quantity: Either the number of units of this item (i.e. COLA x2 is a 'COLA' with quantity = 2.0),
     or the amount if the item is priced by weight/volume.
    -unit_price: Price per one unit of this item, or per unit weight/volume
    -total_price: Total price paid for this item. Equal to unit_price * quantity
    -notes: notes for this item
    -language: leave as "und", will be assigned later
"""

    prompt = f"""
You are given raw OCR text from a receipt.

OCR_TEXT:
\"\"\"{ocr_text[:8000]}\"\"\"

Using ONLY this text and following the STRICT extraction rules below,
produce the JSON object.

{schema_hint}
"""

    raw = _call_mistral_text(client, prompt, system=system)

    try:
        d = _parse_json_block(raw)
    except Exception as exc:
        raise RuntimeError(f"Structuring LLM returned invalid JSON: {exc}\nRAW:\n{raw}")

    def _safe_float(x):
        try:
            if x is None:
                return None
            if isinstance(x, (int, float)):
                return float(x)
            s = str(x).strip()
            if not s:
                return None
            return float(s)
        except Exception:
            return None

    items: list[LineItem] = []
    for i in d.get("items", []):
        raw_qty = i.get("quantity")
        raw_unit = i.get("unit_price")
        raw_total = i.get("total_price")

        qty = _safe_float(raw_qty)
        unit = _safe_float(raw_unit)
        total = _safe_float(raw_total)

        if total is None and unit is not None and qty is not None:
            total = unit * qty

        if total is None and unit is None:
            total = 0.0
            unit = 0.0
            qty = 1.0

        if unit is None:
            unit = total

        if qty is None:
            qty = 1.0

        items.append(
            LineItem(
                name=i["name"],
                quantity=qty,
                unit_price=unit,
                total_price=total,
                notes=i.get("notes", ""),
                language="und",#str(i.get("language", "und")),
            )
        )

    return ReceiptData(
        summary_label=d.get("summary_label", ""),
        merchant_name=d.get("merchant_name", ""),
        merchant_address=d.get("merchant_address", ""),
        date=d.get("date", ""),
        time=d.get("time", ""),
        items=items,
        subtotal=float(d.get("subtotal", 0) or 0),
        vat_rate_pct=float(d["vat_rate_pct"])
        if d.get("vat_rate_pct") is not None
        else None,
        vat_amount=float(d["vat_amount"])
        if d.get("vat_amount") is not None
        else None,
        tip=float(d["tip"]) if d.get("tip") is not None else None,
        total=float(d.get("total", 0) or 0),
        currency=d.get("currency", ""),
        ocr_sum_verified=False,
        raw_text=ocr_text,
    )

# ── script‑aware language refinement ───────────────────────────────────────────

def _step2b_refine_item_languages(
    client: Mistral,
    data: ReceiptData,
) -> None:
    """
    Post-processing language refinement (script-aware):

    1. Segment raw_text into script-homogeneous blocks (Arabic, Latin, etc.),
       merging 'Common' characters into the nearest script.
    2. For each script block, detect all languages present.
    3. Merge all detected languages into a global set.
    4. For each item label, decide which of the global languages it fits.
       If none fit (brand name / garbled / code), leave as 'und'.
    """
    if not data.items:
        return

    # 1) Segment by script
    script_blocks = _segment_by_script(data.raw_text)
    if not script_blocks:
        return

    # 2) Detect languages per script block
    system = (
        "You are a language detector. "
        "Respond ONLY with a JSON array of ISO 639-1 language codes, no prose."
    )
    global_langs: set[str] = set()

    for script_name, script_text in script_blocks.items():
        if not script_text:
            continue

        prompt_global = f"""
Detect ALL natural languages that appear anywhere in the following OCR text block.

Important:
- Include languages even if they appear only in short fragments.
- Do NOT return only the dominant language; return every language that appears.
- Return a JSON array of ISO 639-1 codes, e.g. ["ar"], ["ar","en"].

Script: {script_name}

TEXT_BLOCK:
\"\"\"{script_text[:4000]}\"\"\"
"""
        raw_global = _call_mistral_text(client, prompt_global, system=system)
        cleaned_global = _strip_fences(raw_global)
        start_g, end_g = cleaned_global.find("["), cleaned_global.rfind("]") + 1
        if start_g == -1 or end_g == 0:
            continue

        try:
            langs = json.loads(cleaned_global[start_g:end_g])
        except Exception:
            continue

        if isinstance(langs, list):
            for l in langs:
                s = str(l).strip()
                if s and s != "und":
                    global_langs.add(s)

    # Fallback if nothing detected
    if not global_langs:
        global_lang_list = []
    else:
        global_lang_list = sorted(global_langs)

    # 3) Per-item refinement
    items_payload = [
        {"index": i, "name": item.name, "current_language": item.language}
        for i, item in enumerate(data.items)
    ]
    if not global_lang_list:
        for item in data.items:
            item.language = "und"
        return

    prompt_items = f"""
You are refining language tags for receipt line items.

You are given:
- A list of global languages detected in the receipt (ISO 639-1 codes).
- A list of item labels with indices and their current language tags.

Your task:
For each item label:
1. Decide whether the label is a valid phrase in ANY of the global languages.
2. If the label clearly fits exactly one of the global languages, assign that language.
Be lenient--if the language isn't obvious, go through the global languages in order
and if for any the label could conceivably be a phrase, even as a loanword or an
uncommon phrase, choose that language and proceed. Choose the first language in the
list if the label is a globally recognisable phrase, such as the name of a common
food item ("Latte", "Lasagna", "Sushi" etc) or other universal phrase.
3. If the label could fit multiple global languages, choose the most likely one.
4. If the label does NOT fit any of the global languages (e.g. brand name, code,
   abbreviation, or ambiguous), assign "und".
5. Do NOT use languages that are not in the global list.
6. Do NOT return "und" as a global language — only as a fallback for individual items.

Global languages:
{json.dumps(global_lang_list)}

Items:
{json.dumps(items_payload, ensure_ascii=False, indent=2)}

Return a JSON array with exactly {len(items_payload)} objects:
[
  {{"index": 0, "language": "en"}},
  ...
]
"""


    raw_items = _call_mistral_text(client, prompt_items, system=system)
    cleaned_items = _strip_fences(raw_items)
    start_i, end_i = cleaned_items.find("["), cleaned_items.rfind("]") + 1
    if start_i == -1 or end_i == 0:
        return

    try:
        entries = json.loads(cleaned_items[start_i:end_i])
    except Exception:
        return

    # Apply refined languages
    for e in entries:
        try:
            idx = int(e["index"])
            lang = str(e.get("language", "")).strip()
        except Exception:
            continue

        if 0 <= idx < len(data.items):
            if not lang:
                continue
            if lang not in global_lang_list and lang != "und":
                continue
            data.items[idx].language = lang

# ── saving ─────────────────────────────────────────────────────────────────────

def _step3_save(data: ReceiptData, image_path: Path, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    stem = image_path.stem
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = output_dir / f"{stem}_{timestamp}.json"
    with open(json_path, "w", encoding="utf-8") as fh:
        json.dump(data.to_dict(), fh, indent=2, ensure_ascii=False)
    return json_path


# -- Other functions -----------------------------------------------------------

def summarise_item_sublist(
    receipt_data: ReceiptData,
    item_sublist: list[str],
) -> str:
    """
    Summarise a subset of receipt items into a short natural-language phrase.
    Uses an LLM call but is strictly extractive and non-creative.
    """

    if not item_sublist:
        return "No items"

    client = Mistral(api_key=_require_mistral_api_key())

    # Prepare payload for the LLM
    all_items_payload = [
        {"name": item.name, "quantity": item.quantity, "total_price": item.total_price}
        for item in receipt_data.items
    ]

    selected_payload = [
        {"name": item}
        for item in item_sublist
    ]

    system = (
        "You are an expert at summarising subsets of receipt items. "
        "You MUST be strictly extractive: do NOT invent items, categories, or brands. "
        "Your output must be a single short natural-language phrase."
    )

    prompt = f"""
You are given:
1. A list of ALL items on a receipt.
2. A list of SELECTED items (a subset of the full list).

Your task:
- Summarise the SELECTED items into a short natural-language phrase.
- You may group items into categories (e.g. 'tobacco products', 'groceries', 'drinks'),
  but ONLY if the grouping is clearly supported by the item names.
- If the selected items represent only PART of a category present in the full receipt,
  prefix with 'some', e.g. 'some clothes'.
- If the selected items represent ALL items of a category, use the bare category name.
- You may mix categories and individual items if needed.
- The summary must be concise (max ~10 words).
- DO NOT hallucinate. Use ONLY the provided item names.

ALL ITEMS:
{json.dumps(all_items_payload, ensure_ascii=False, indent=2)}

SELECTED ITEMS:
{json.dumps(item_sublist, ensure_ascii=False, indent=2)}

Return ONLY the summary phrase, nothing else.
"""

    raw = _call_mistral_text(client, prompt, system=system)
    summary = raw.strip().strip('"').strip("'")
    return summary



# ── main pipeline ─────────────────────────────────────────────────────────────

def process_receipt(
    image_path: str | Path,
    output_dir: str | Path = ".",
    *,
    save_json: bool = True,
) -> ProcessResult:
    image_path = Path(image_path)
    output_dir = Path(output_dir)

    if not image_path.exists():
        return ProcessResult(ok=False, reason=f"File not found: {image_path}")

    try:
        _ = _media_type(image_path)
    except ValueError as exc:
        return ProcessResult(ok=False, reason=str(exc))

    client = Mistral(api_key=_require_mistral_api_key())

    # 1) OCR
    try:
        ocr_text = _run_ocr(client, image_path)
        #ocr_text = _pair_prices_with_arabic_labels(ocr_text)
        #ocr_text = _normalize_rtl_lines(ocr_text)
    except Exception as exc:
        return ProcessResult(ok=False, reason=f"OCR step failed: {exc}")

    # 2) Detection
    try:
        is_receipt, quality_issue = _step1_detect_receipt_from_text(client, ocr_text)
    except Exception as exc:
        return ProcessResult(ok=False, reason=f"Detection step failed: {exc}")

    if not is_receipt:
        return ProcessResult(
            ok=False,
            reason="The image does not appear to be a receipt based on OCR text. "
                   "Please retake the photo.",
        )

    if quality_issue:
        return ProcessResult(
            ok=False,
            reason=f"Image/OCR quality issue — {quality_issue}. Please retake the photo.",
        )

    # 3) Structuring
    try:
        receipt_data = _step2_structure_from_text(client, ocr_text)
    except Exception as exc:
        return ProcessResult(ok=False, reason=f"Structuring failed: {exc}")

    # 4) Script-aware language refinement
    try:
        _step2b_refine_item_languages(client, receipt_data)
    except Exception:
        pass

    # 5) Verify totals
    receipt_data.ocr_sum_verified = _verify_total(receipt_data)

    # 6) Save JSON (optional)
    if save_json:
        try:
            json_path = _step3_save(receipt_data, image_path, output_dir)
        except Exception as exc:
            return ProcessResult(ok=False, reason=f"Could not save JSON: {exc}")
        return ProcessResult(ok=True, data=receipt_data, json_path=json_path)

    return ProcessResult(ok=True, data=receipt_data, json_path=None)


# ── CLI runner ────────────────────────────────────────────────────────────────

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
        print(
            f"  [{i}] ({item.language}) {item.name!r} "
            f"({item.unit_price}) x {item.quantity} ---> {item.total_price}"
        )

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
