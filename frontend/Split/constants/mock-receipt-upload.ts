export type ReceiptUploadResult = {
  receiptId: string;
  extractedPaymentName: string;
  extractedAmount: number;
};

export async function mockUploadReceipt(
  imageUri: string,
  groupId: string
): Promise<ReceiptUploadResult> {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const uriTail = imageUri.slice(-6).replace(/[^a-zA-Z0-9]/g, "");

  return {
    receiptId: `r-${groupId}-${uriTail}-${Date.now()}`,
    extractedPaymentName: "Receipt purchase",
    extractedAmount: 42.5,
  };
}
