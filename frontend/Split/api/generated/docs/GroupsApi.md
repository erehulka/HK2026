# GroupsApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**addUserToGroupGroupsGroupIdUsersUserIdPost**](#addusertogroupgroupsgroupidusersuseridpost) | **POST** /groups/{group_id}/users/{user_id} | Add a user to a group|
|[**createGroupGroupsPost**](#creategroupgroupspost) | **POST** /groups/ | Create a group|
|[**getGroupGroupsGroupIdGet**](#getgroupgroupsgroupidget) | **GET** /groups/{group_id} | Get a group with its expenses|
|[**getSimplifiedGroupDebtsGroupsGroupIdDebtsSimplifiedGet**](#getsimplifiedgroupdebtsgroupsgroupiddebtssimplifiedget) | **GET** /groups/{group_id}/debts/simplified | Simplified pairwise debts for the group|
|[**listGroupUsersGroupsGroupIdUsersGet**](#listgroupusersgroupsgroupidusersget) | **GET** /groups/{group_id}/users | List users in a group|
|[**removeUserFromGroupGroupsGroupIdUsersUserIdDelete**](#removeuserfromgroupgroupsgroupidusersuseriddelete) | **DELETE** /groups/{group_id}/users/{user_id} | Remove a user from a group|

# **addUserToGroupGroupsGroupIdUsersUserIdPost**
> GroupMembershipOut addUserToGroupGroupsGroupIdUsersUserIdPost()


### Example

```typescript
import {
    GroupsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new GroupsApi(configuration);

let groupId: string; // (default to undefined)
let userId: string; // (default to undefined)

const { status, data } = await apiInstance.addUserToGroupGroupsGroupIdUsersUserIdPost(
    groupId,
    userId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **groupId** | [**string**] |  | defaults to undefined|
| **userId** | [**string**] |  | defaults to undefined|


### Return type

**GroupMembershipOut**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createGroupGroupsPost**
> GroupOut createGroupGroupsPost(groupCreate)


### Example

```typescript
import {
    GroupsApi,
    Configuration,
    GroupCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new GroupsApi(configuration);

let groupCreate: GroupCreate; //

const { status, data } = await apiInstance.createGroupGroupsPost(
    groupCreate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **groupCreate** | **GroupCreate**|  | |


### Return type

**GroupOut**

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

# **getGroupGroupsGroupIdGet**
> GroupDetailOut getGroupGroupsGroupIdGet()


### Example

```typescript
import {
    GroupsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new GroupsApi(configuration);

let groupId: string; // (default to undefined)

const { status, data } = await apiInstance.getGroupGroupsGroupIdGet(
    groupId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **groupId** | [**string**] |  | defaults to undefined|


### Return type

**GroupDetailOut**

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

# **getSimplifiedGroupDebtsGroupsGroupIdDebtsSimplifiedGet**
> SimplifiedGroupDebtsOut getSimplifiedGroupDebtsGroupsGroupIdDebtsSimplifiedGet()

Return the simplified settlement matrix from all **Equal** split expenses in the group.  Rows/columns follow ``member_ids`` (lexicographically sorted user id strings). Amounts are euro cents. Unsupported expense types or invalid participant data yield HTTP 422.

### Example

```typescript
import {
    GroupsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new GroupsApi(configuration);

let groupId: string; // (default to undefined)

const { status, data } = await apiInstance.getSimplifiedGroupDebtsGroupsGroupIdDebtsSimplifiedGet(
    groupId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **groupId** | [**string**] |  | defaults to undefined|


### Return type

**SimplifiedGroupDebtsOut**

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

# **listGroupUsersGroupsGroupIdUsersGet**
> Array<UserOut> listGroupUsersGroupsGroupIdUsersGet()


### Example

```typescript
import {
    GroupsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new GroupsApi(configuration);

let groupId: string; // (default to undefined)

const { status, data } = await apiInstance.listGroupUsersGroupsGroupIdUsersGet(
    groupId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **groupId** | [**string**] |  | defaults to undefined|


### Return type

**Array<UserOut>**

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

# **removeUserFromGroupGroupsGroupIdUsersUserIdDelete**
> removeUserFromGroupGroupsGroupIdUsersUserIdDelete()


### Example

```typescript
import {
    GroupsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new GroupsApi(configuration);

let groupId: string; // (default to undefined)
let userId: string; // (default to undefined)

const { status, data } = await apiInstance.removeUserFromGroupGroupsGroupIdUsersUserIdDelete(
    groupId,
    userId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **groupId** | [**string**] |  | defaults to undefined|
| **userId** | [**string**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**204** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

