# ExpenseCreate

Body for creating an expense in a group.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**description** | **string** |  | [default to undefined]
**created_by** | **string** | User who created the expense | [default to undefined]
**paid_by** | **string** | User who paid for the expense | [default to undefined]
**participants** | **Array&lt;string&gt;** | Users participating in this expense | [default to undefined]
**split_type** | [**ExpenseSplitType**](ExpenseSplitType.md) | How the expense is split | [optional] [default to undefined]

## Example

```typescript
import { ExpenseCreate } from './api';

const instance: ExpenseCreate = {
    description,
    created_by,
    paid_by,
    participants,
    split_type,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
