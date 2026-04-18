export type ReceiptUploadResult = {
  receiptId: string;
  extractedReceiptName: string;
  items: Array<{
    name: string;
    price: number;
  }>;
};

export async function mockUploadReceipt(
  imageUri: string,
  groupId: string
): Promise<ReceiptUploadResult> {
  await new Promise((resolve) => setTimeout(resolve, 1200));
  const uriTail = imageUri.slice(-6).replace(/[^a-zA-Z0-9]/g, "");

  return {
    receiptId: `r-${groupId}-${uriTail}-${Date.now()}`,
    extractedReceiptName: "Grocery store receipt",
    items: [
      { name: "Bananas", price: 3.2 },
      { name: "Milk", price: 2.9 },
      { name: "Bread", price: 1.8 },
      { name: "Pasta", price: 4.6 },
    ],
  };
}
