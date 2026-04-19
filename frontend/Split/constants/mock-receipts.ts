import { ReceiptUploadResult } from "@/constants/mock-receipt-upload";

export type DraftReceiptItem = {
  id: string;
  name: string;
  price: number;
  addedToExpenseAt?: string;
};

export type DraftReceipt = {
  id: string;
  groupId: string;
  name: string;
  items: DraftReceiptItem[];
  createdAt: string;
};

const DRAFT_RECEIPTS: Record<string, DraftReceipt[]> = {};

export function createDraftReceiptFromUpload(
  groupId: string,
  uploadResult: ReceiptUploadResult
): DraftReceipt {
  if (!DRAFT_RECEIPTS[groupId]) {
    DRAFT_RECEIPTS[groupId] = [];
  }

  const draft: DraftReceipt = {
    id: uploadResult.receiptId,
    groupId,
    name: uploadResult.extractedReceiptName,
    items: uploadResult.items.map((item, index) => ({
      id: `${uploadResult.receiptId}-item-${index + 1}`,
      name: item.name,
      price: item.price,
    })),
    createdAt: new Date().toISOString(),
  };

  DRAFT_RECEIPTS[groupId].unshift(draft);
  return draft;
}

export function getDraftReceiptById(
  groupId: string,
  receiptId: string
): DraftReceipt | undefined {
  return DRAFT_RECEIPTS[groupId]?.find((receipt) => receipt.id === receiptId);
}

export function updateDraftReceiptName(
  groupId: string,
  receiptId: string,
  nextName: string
) {
  const receipt = getDraftReceiptById(groupId, receiptId);
  if (!receipt) return;
  receipt.name = nextName;
}

export function updateDraftReceiptItem(
  groupId: string,
  receiptId: string,
  itemId: string,
  patch: Partial<Pick<DraftReceiptItem, "name" | "price">>
) {
  const receipt = getDraftReceiptById(groupId, receiptId);
  if (!receipt) return;
  const item = receipt.items.find((entry) => entry.id === itemId);
  if (!item || item.addedToExpenseAt) return;
  if (typeof patch.name === "string") {
    item.name = patch.name;
  }
  if (typeof patch.price === "number" && !isNaN(patch.price) && patch.price >= 0) {
    item.price = patch.price;
  }
}

export function deleteDraftReceiptItem(
  groupId: string,
  receiptId: string,
  itemId: string
) {
  const receipt = getDraftReceiptById(groupId, receiptId);
  if (!receipt) return;
  const target = receipt.items.find((entry) => entry.id === itemId);
  if (!target || target.addedToExpenseAt) return;
  receipt.items = receipt.items.filter((entry) => entry.id !== itemId);
}

export function markDraftReceiptItemsAsAdded(
  groupId: string,
  receiptId: string,
  itemIds: string[]
) {
  const receipt = getDraftReceiptById(groupId, receiptId);
  if (!receipt || itemIds.length === 0) return;
  const now = new Date().toISOString();
  receipt.items = receipt.items.map((item) =>
    itemIds.includes(item.id) ? { ...item, addedToExpenseAt: now } : item
  );
}

export function countRemainingDraftReceiptItems(
  groupId: string,
  receiptId: string
): number {
  const receipt = getDraftReceiptById(groupId, receiptId);
  if (!receipt) return 0;
  return receipt.items.filter((item) => !item.addedToExpenseAt).length;
}
