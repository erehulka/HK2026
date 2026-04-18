# UserCreate

Validated body for creating a user.

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**display_name** | **string** | Human-readable name shown in clients | [default to undefined]
**email** | **string** | Unique login identity; normalized to lowercase | [default to undefined]

## Example

```typescript
import { UserCreate } from './api';

const instance: UserCreate = {
    display_name,
    email,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
