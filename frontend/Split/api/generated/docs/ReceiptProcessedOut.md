# ReceiptProcessedOut

Structured receipt returned by `POST /receipts/process` on success.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**summary_label** | **string** | Short human-readable receipt category | [default to undefined]
**merchant_name** | **string** | Merchant or shop name if present | [default to undefined]
**merchant_address** | **string** | Merchant address if present | [default to undefined]
**date** | **string** | Purchase date (often YYYY-MM-DD) | [default to undefined]
**time** | **string** | Purchase time if present | [default to undefined]
**items** | [**Array&lt;ReceiptLineItemOut&gt;**](ReceiptLineItemOut.md) | Parsed line items | [default to undefined]
**subtotal** | **number** | Subtotal before VAT if present | [default to undefined]
**vat_rate_pct** | **number** |  | [default to undefined]
**vat_amount** | **number** |  | [default to undefined]
**tip** | **number** |  | [default to undefined]
**total** | **number** | Total invoiced amount | [default to undefined]
**currency** | **string** | Currency code or symbol from the receipt | [default to undefined]
**ocr_sum_verified** | **boolean** | Whether item totals are consistent with declared total (within tolerance) | [default to undefined]
**raw_text** | **string** | Verbatim OCR text used for structuring | [default to undefined]
**languages** | **Array&lt;string&gt;** | Distinct BCP-47 tags from line items (excludes und) | [default to undefined]

## Example

```typescript
import { ReceiptProcessedOut } from './api';

const instance: ReceiptProcessedOut = {
    summary_label,
    merchant_name,
    merchant_address,
    date,
    time,
    items,
    subtotal,
    vat_rate_pct,
    vat_amount,
    tip,
    total,
    currency,
    ocr_sum_verified,
    raw_text,
    languages,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
