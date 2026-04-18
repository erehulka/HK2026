# ReceiptLineItemOut

One line on a parsed receipt.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **string** | Item label as read from the receipt | [default to undefined]
**quantity** | **number** | Quantity or amount for priced-by-weight lines | [default to undefined]
**unit_price** | **number** | Unit price from the receipt (not inferred) | [default to undefined]
**total_price** | **number** | Line total from the receipt | [default to undefined]
**notes** | **string** | Optional notes for this line | [optional] [default to '']
**language** | **string** | BCP-47 language tag for the item label (und &#x3D; undetermined) | [optional] [default to 'und']

## Example

```typescript
import { ReceiptLineItemOut } from './api';

const instance: ReceiptLineItemOut = {
    name,
    quantity,
    unit_price,
    total_price,
    notes,
    language,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
