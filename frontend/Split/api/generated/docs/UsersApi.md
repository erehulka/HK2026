# UsersApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**addFriendUsersUserIdFriendsFriendIdPost**](#addfriendusersuseridfriendsfriendidpost) | **POST** /users/{user_id}/friends/{friend_id} | Add a friend|
|[**createUserUsersPost**](#createuseruserspost) | **POST** /users/ | Create a user|
|[**listUserGroupsUsersUserIdGroupsGet**](#listusergroupsusersuseridgroupsget) | **GET** /users/{user_id}/groups | List groups a user belongs to|
|[**removeFriendUsersUserIdFriendsFriendIdDelete**](#removefriendusersuseridfriendsfriendiddelete) | **DELETE** /users/{user_id}/friends/{friend_id} | Remove a friend|

# **addFriendUsersUserIdFriendsFriendIdPost**
> UserOut addFriendUsersUserIdFriendsFriendIdPost()


### Example

```typescript
import {
    UsersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

let userId: string; // (default to undefined)
let friendId: string; // (default to undefined)

const { status, data } = await apiInstance.addFriendUsersUserIdFriendsFriendIdPost(
    userId,
    friendId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userId** | [**string**] |  | defaults to undefined|
| **friendId** | [**string**] |  | defaults to undefined|


### Return type

**UserOut**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createUserUsersPost**
> UserOut createUserUsersPost(userCreate)


### Example

```typescript
import {
    UsersApi,
    Configuration,
    UserCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

let userCreate: UserCreate; //

const { status, data } = await apiInstance.createUserUsersPost(
    userCreate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userCreate** | **UserCreate**|  | |


### Return type

**UserOut**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **listUserGroupsUsersUserIdGroupsGet**
> Array<GroupOut> listUserGroupsUsersUserIdGroupsGet()


### Example

```typescript
import {
    UsersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

let userId: string; // (default to undefined)

const { status, data } = await apiInstance.listUserGroupsUsersUserIdGroupsGet(
    userId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userId** | [**string**] |  | defaults to undefined|


### Return type

**Array<GroupOut>**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **removeFriendUsersUserIdFriendsFriendIdDelete**
> UserOut removeFriendUsersUserIdFriendsFriendIdDelete()


### Example

```typescript
import {
    UsersApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UsersApi(configuration);

let userId: string; // (default to undefined)
let friendId: string; // (default to undefined)

const { status, data } = await apiInstance.removeFriendUsersUserIdFriendsFriendIdDelete(
    userId,
    friendId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **userId** | [**string**] |  | defaults to undefined|
| **friendId** | [**string**] |  | defaults to undefined|


### Return type

**UserOut**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

