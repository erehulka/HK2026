# ExpensesApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**createExpenseFromFrontendGroupsGroupIdExpensesFrontendPost**](#createexpensefromfrontendgroupsgroupidexpensesfrontendpost) | **POST** /groups/{group_id}/expenses/frontend | Create an expense from the frontend payload|
|[**createExpenseGroupsGroupIdExpensesPost**](#createexpensegroupsgroupidexpensespost) | **POST** /groups/{group_id}/expenses/ | Add an expense to a group|
|[**deleteExpenseGroupsGroupIdExpensesExpenseIdDelete**](#deleteexpensegroupsgroupidexpensesexpenseiddelete) | **DELETE** /groups/{group_id}/expenses/{expense_id} | Remove an expense from a group|
|[**getExpenseGroupsGroupIdExpensesExpenseIdGet**](#getexpensegroupsgroupidexpensesexpenseidget) | **GET** /groups/{group_id}/expenses/{expense_id} | Get an expense with its items|
|[**updateExpenseGroupsGroupIdExpensesExpenseIdPatch**](#updateexpensegroupsgroupidexpensesexpenseidpatch) | **PATCH** /groups/{group_id}/expenses/{expense_id} | Edit an expense|

# **createExpenseFromFrontendGroupsGroupIdExpensesFrontendPost**
> ExpenseDetailOut createExpenseFromFrontendGroupsGroupIdExpensesFrontendPost(expenseFrontendCreate)


### Example

```typescript
import {
    ExpensesApi,
    Configuration,
    ExpenseFrontendCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new ExpensesApi(configuration);

let groupId: string; // (default to undefined)
let expenseFrontendCreate: ExpenseFrontendCreate; //

const { status, data } = await apiInstance.createExpenseFromFrontendGroupsGroupIdExpensesFrontendPost(
    groupId,
    expenseFrontendCreate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **expenseFrontendCreate** | **ExpenseFrontendCreate**|  | |
| **groupId** | [**string**] |  | defaults to undefined|


### Return type

**ExpenseDetailOut**

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

# **createExpenseGroupsGroupIdExpensesPost**
> ExpenseOut createExpenseGroupsGroupIdExpensesPost(expenseCreate)


### Example

```typescript
import {
    ExpensesApi,
    Configuration,
    ExpenseCreate
} from './api';

const configuration = new Configuration();
const apiInstance = new ExpensesApi(configuration);

let groupId: string; // (default to undefined)
let expenseCreate: ExpenseCreate; //

const { status, data } = await apiInstance.createExpenseGroupsGroupIdExpensesPost(
    groupId,
    expenseCreate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **expenseCreate** | **ExpenseCreate**|  | |
| **groupId** | [**string**] |  | defaults to undefined|


### Return type

**ExpenseOut**

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

# **deleteExpenseGroupsGroupIdExpensesExpenseIdDelete**
> deleteExpenseGroupsGroupIdExpensesExpenseIdDelete()


### Example

```typescript
import {
    ExpensesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExpensesApi(configuration);

let groupId: string; // (default to undefined)
let expenseId: string; // (default to undefined)

const { status, data } = await apiInstance.deleteExpenseGroupsGroupIdExpensesExpenseIdDelete(
    groupId,
    expenseId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **groupId** | [**string**] |  | defaults to undefined|
| **expenseId** | [**string**] |  | defaults to undefined|


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

# **getExpenseGroupsGroupIdExpensesExpenseIdGet**
> ExpenseDetailOut getExpenseGroupsGroupIdExpensesExpenseIdGet()


### Example

```typescript
import {
    ExpensesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ExpensesApi(configuration);

let groupId: string; // (default to undefined)
let expenseId: string; // (default to undefined)

const { status, data } = await apiInstance.getExpenseGroupsGroupIdExpensesExpenseIdGet(
    groupId,
    expenseId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **groupId** | [**string**] |  | defaults to undefined|
| **expenseId** | [**string**] |  | defaults to undefined|


### Return type

**ExpenseDetailOut**

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

# **updateExpenseGroupsGroupIdExpensesExpenseIdPatch**
> ExpenseOut updateExpenseGroupsGroupIdExpensesExpenseIdPatch(expenseUpdate)


### Example

```typescript
import {
    ExpensesApi,
    Configuration,
    ExpenseUpdate
} from './api';

const configuration = new Configuration();
const apiInstance = new ExpensesApi(configuration);

let groupId: string; // (default to undefined)
let expenseId: string; // (default to undefined)
let expenseUpdate: ExpenseUpdate; //

const { status, data } = await apiInstance.updateExpenseGroupsGroupIdExpensesExpenseIdPatch(
    groupId,
    expenseId,
    expenseUpdate
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **expenseUpdate** | **ExpenseUpdate**|  | |
| **groupId** | [**string**] |  | defaults to undefined|
| **expenseId** | [**string**] |  | defaults to undefined|


### Return type

**ExpenseOut**

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

