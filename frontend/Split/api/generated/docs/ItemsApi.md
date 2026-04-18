# ItemsApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**addItemToExpenseGroupsGroupIdExpensesExpenseIdItemsPost**](#additemtoexpensegroupsgroupidexpensesexpenseiditemspost) | **POST** /groups/{group_id}/expenses/{expense_id}/items | Add an item to an expense|
|[**deleteExpenseItemGroupsGroupIdExpensesExpenseIdItemsItemIdDelete**](#deleteexpenseitemgroupsgroupidexpensesexpenseiditemsitemiddelete) | **DELETE** /groups/{group_id}/expenses/{expense_id}/items/{item_id} | Remove an item from an expense|
|[**updateExpenseItemGroupsGroupIdExpensesExpenseIdItemsItemIdPatch**](#updateexpenseitemgroupsgroupidexpensesexpenseiditemsitemidpatch) | **PATCH** /groups/{group_id}/expenses/{expense_id}/items/{item_id} | Edit an item on an expense|

# **addItemToExpenseGroupsGroupIdExpensesExpenseIdItemsPost**
> ItemOut addItemToExpenseGroupsGroupIdExpensesExpenseIdItemsPost(itemCreate)


### Example

```typescript
import {
    ItemsApi,
    Configuration,
    ItemCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new ItemsApi(configuration);

let groupId: string; // (default to undefined)
let expenseId: string; // (default to undefined)
let itemCreate: ItemCreate; //

const { status, data } = await apiInstance.addItemToExpenseGroupsGroupIdExpensesExpenseIdItemsPost(
    groupId,
    expenseId,
    itemCreate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **itemCreate** | **ItemCreate**|  | |
| **groupId** | [**string**] |  | defaults to undefined|
| **expenseId** | [**string**] |  | defaults to undefined|


### Return type

**ItemOut**

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

# **deleteExpenseItemGroupsGroupIdExpensesExpenseIdItemsItemIdDelete**
> deleteExpenseItemGroupsGroupIdExpensesExpenseIdItemsItemIdDelete()


### Example

```typescript
import {
    ItemsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ItemsApi(configuration);

let groupId: string; // (default to undefined)
let expenseId: string; // (default to undefined)
let itemId: string; // (default to undefined)

const { status, data } = await apiInstance.deleteExpenseItemGroupsGroupIdExpensesExpenseIdItemsItemIdDelete(
    groupId,
    expenseId,
    itemId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **groupId** | [**string**] |  | defaults to undefined|
| **expenseId** | [**string**] |  | defaults to undefined|
| **itemId** | [**string**] |  | defaults to undefined|


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

# **updateExpenseItemGroupsGroupIdExpensesExpenseIdItemsItemIdPatch**
> ItemOut updateExpenseItemGroupsGroupIdExpensesExpenseIdItemsItemIdPatch(itemUpdate)


### Example

```typescript
import {
    ItemsApi,
    Configuration,
    ItemUpdate
} from './api';

const configuration = new Configuration();
const apiInstance = new ItemsApi(configuration);

let groupId: string; // (default to undefined)
let expenseId: string; // (default to undefined)
let itemId: string; // (default to undefined)
let itemUpdate: ItemUpdate; //

const { status, data } = await apiInstance.updateExpenseItemGroupsGroupIdExpensesExpenseIdItemsItemIdPatch(
    groupId,
    expenseId,
    itemId,
    itemUpdate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **itemUpdate** | **ItemUpdate**|  | |
| **groupId** | [**string**] |  | defaults to undefined|
| **expenseId** | [**string**] |  | defaults to undefined|
| **itemId** | [**string**] |  | defaults to undefined|


### Return type

**ItemOut**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

