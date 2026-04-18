# ReceiptsApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**processReceiptUploadReceiptsProcessPost**](#processreceiptuploadreceiptsprocesspost) | **POST** /receipts/process | Upload a receipt photo and get structured JSON|

# **processReceiptUploadReceiptsProcessPost**
> ReceiptProcessedOut processReceiptUploadReceiptsProcessPost()


### Example

```typescript
import {
    ReceiptsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new ReceiptsApi(configuration);

let file: File; //Receipt image (JPEG or PNG) (default to undefined)

const { status, data } = await apiInstance.processReceiptUploadReceiptsProcessPost(
    file
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **file** | [**File**] | Receipt image (JPEG or PNG) | defaults to undefined|


### Return type

**ReceiptProcessedOut**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: multipart/form-data
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

