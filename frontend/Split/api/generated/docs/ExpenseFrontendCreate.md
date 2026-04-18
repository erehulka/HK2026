# ExpenseFrontendCreate

Body used by the frontend to create an expense and its items in one request.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**description** | **string** |  | [default to undefined]
**paidBy** | **string** | User who paid for the expense | [default to undefined]
**participantUserIds** | **Array&lt;string&gt;** | Users participating in this expense | [default to undefined]
**splitType** | [**ExpenseSplitType**](ExpenseSplitType.md) | How the expense is split | [optional] [default to undefined]
**items** | [**Array&lt;ItemCreate&gt;**](ItemCreate.md) | Expense items to create | [default to undefined]

## Example

```typescript
import { ExpenseFrontendCreate } from './api';

const instance: ExpenseFrontendCreate = {
    description,
    paidBy,
    participantUserIds,
    splitType,
    items,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
