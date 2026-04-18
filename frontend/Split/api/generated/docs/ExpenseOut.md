# ExpenseOut

Expense returned to clients.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **string** |  | [default to undefined]
**group_id** | **string** |  | [default to undefined]
**description** | **string** |  | [default to undefined]
**total_amount** | **number** | Total amount in euro cents (100 &#x3D; €1.00) | [default to undefined]
**created_by** | **string** |  | [default to undefined]
**paid_by** | **string** |  | [default to undefined]
**participants** | **Array&lt;string&gt;** |  | [default to undefined]
**split_type** | [**ExpenseSplitType**](ExpenseSplitType.md) |  | [default to undefined]
**items** | **Array&lt;string&gt;** |  | [default to undefined]
**created_at** | **string** |  | [default to undefined]
**updated_at** | **string** |  | [default to undefined]

## Example

```typescript
import { ExpenseOut } from './api';

const instance: ExpenseOut = {
    id,
    group_id,
    description,
    total_amount,
    created_by,
    paid_by,
    participants,
    split_type,
    items,
    created_at,
    updated_at,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
