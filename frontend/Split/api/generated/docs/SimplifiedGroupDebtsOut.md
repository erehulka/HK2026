# SimplifiedGroupDebtsOut

Pairwise simplified debts for a group (Equal-split expenses only).  ``member_ids`` and ``matrix`` share the same ordering: ``matrix[i][j]`` is how many euro cents member ``member_ids[i]`` owes member ``member_ids[j]`` (zero if no debt).

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**member_ids** | **Array&lt;string&gt;** | Group member user ids (same order as matrix rows/columns) | [default to undefined]
**matrix** | **Array&lt;Array&lt;number&gt;&gt;** | Square matrix of amounts owed in euro cents; row debtor, column creditor | [default to undefined]

## Example

```typescript
import { SimplifiedGroupDebtsOut } from './api';

const instance: SimplifiedGroupDebtsOut = {
    member_ids,
    matrix,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
