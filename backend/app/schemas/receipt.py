"""OpenAPI / client types for receipt OCR pipeline output."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ReceiptLineItemOut(BaseModel):
    """One line on a parsed receipt."""

    name: str = Field(description="Item label as read from the receipt")
    quantity: float = Field(description="Quantity or amount for priced-by-weight lines")
    unit_price: float = Field(description="Unit price from the receipt (not inferred)")
    total_price: float = Field(description="Line total from the receipt")
    notes: str = Field(default="", description="Optional notes for this line")
    language: str = Field(
        default="und",
        description="BCP-47 language tag for the item label (und = undetermined)",
    )


class ReceiptProcessedOut(BaseModel):
    """Structured receipt returned by `POST /receipts/process` on success."""

    summary_label: str = Field(description="Short human-readable receipt category")
    date: str = Field(description="Purchase date (often YYYY-MM-DD)")
    time: str = Field(description="Purchase time if present")
    items: list[ReceiptLineItemOut] = Field(description="Parsed line items")
    subtotal: float = Field(description="Subtotal before VAT if present")
    vat_rate_pct: float | None = Field(description="VAT rate in percent, if present")
    vat_amount: float | None = Field(description="VAT amount, if present")
    tip: float | None = Field(description="Tip amount, if present as its own field")
    total: float = Field(description="Total invoiced amount")
    currency: str = Field(description="Currency code or symbol from the receipt")
    ocr_sum_verified: bool = Field(
        description="Whether item totals are consistent with declared total (within tolerance)",
    )
    raw_text: str = Field(description="Verbatim OCR text used for structuring")
    languages: list[str] = Field(
        description="Distinct BCP-47 tags from line items (excludes und)",
    )


class TranslateLabelLineIn(BaseModel):
    """One receipt line label plus its detected language (for translation only)."""

    name: str = Field(description="Item label text to translate")
    language: str = Field(
        default="und",
        description="BCP-47 language tag for this label (hint for the model)",
    )


class TranslateLabelsIn(BaseModel):
    """Input for ``POST /receipts/translate-labels``."""

    target_language: str = Field(
        description='Goal language for labels (e.g. "Slovak", "English")',
    )
    items: list[TranslateLabelLineIn] = Field(
        min_length=1,
        description="Ordered line labels; order defines indices 0..n-1",
    )


class TranslatedLabelOut(BaseModel):
    """One translated line label."""

    index: int
    original_name: str = Field(
        description="Source string that was translated (the input ``name`` for that line)",
    )
    translated_name: str
    source_language: str = Field(description="BCP-47 tag from the corresponding input line")


class TranslateLabelsOut(BaseModel):
    """Response from ``POST /receipts/translate-labels``."""

    labels: list[TranslatedLabelOut]
