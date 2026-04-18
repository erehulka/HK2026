# ExpenseUpdate

Partial update for an expense (PATCH).

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**description** | **string** |  | [optional] [default to undefined]
**created_by** | **string** |  | [optional] [default to undefined]
**paid_by** | **string** |  | [optional] [default to undefined]
**participants** | **Array&lt;string&gt;** |  | [optional] [default to undefined]
**split_type** | [**ExpenseSplitType**](ExpenseSplitType.md) |  | [optional] [default to undefined]

## Example

```typescript
import { ExpenseUpdate } from './api';

const instance: ExpenseUpdate = {
    description,
    created_by,
    paid_by,
    participants,
    split_type,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
