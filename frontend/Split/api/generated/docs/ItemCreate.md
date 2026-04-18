# ItemCreate

Body for creating an item under an expense.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**description** | **string** |  | [default to undefined]
**amount** | **number** | Item amount in euro cents (100 &#x3D; €1.00) | [default to undefined]

## Example

```typescript
import { ItemCreate } from './api';

const instance: ItemCreate = {
    description,
    amount,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
