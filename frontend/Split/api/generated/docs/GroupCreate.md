# GroupCreate

Validated body for creating a group (stored in MongoDB `groups` collection).

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**name** | **string** | Display name for the group | [default to undefined]
**description** | **string** | Longer text describing the group; may be empty | [default to undefined]

## Example

```typescript
import { GroupCreate } from './api';

const instance: GroupCreate = {
    name,
    description,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
