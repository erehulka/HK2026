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


class ReceiptInterpretTranslateLineIn(BaseModel):
    """One line: only fields read by the interpret + translate pipeline."""

    name: str = Field(description="Item label as read from the receipt")
    language: str = Field(
        default="und",
        description="BCP-47 tag for this label (used for grouping and translation hints)",
    )


class ReceiptInterpretTranslateIn(BaseModel):
    """
    Minimal payload for label enhancement: receipt context plus line names and languages.
    No totals, dates, or OCR dump — those are not used by the model calls.
    """

    summary_label: str = Field(
        description="Short receipt category / context (passed into the interpret prompt)",
    )
    items: list[ReceiptInterpretTranslateLineIn] = Field(
        min_length=1,
        description="Lines to interpret and translate; order is preserved in the response",
    )


class ReceiptEnhancedLineOut(BaseModel):
    """One receipt line: raw label from the payload and the improved English label."""

    index: int = Field(description="Index matching `items` in the request body")
    original_name: str = Field(description="Label as on the receipt (unchanged from input)")
    enhanced_name: str = Field(
        description="English label after abbreviation expansion and translation",
    )


class ReceiptEnhancedLabelsOut(BaseModel):
    """Enhanced English labels for each input line (same order as request `items`)."""

    lines: list[ReceiptEnhancedLineOut]
