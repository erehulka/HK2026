import { CameraView, useCameraPermissions } from "expo-camera";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { mockUploadReceipt } from "@/constants/mock-receipt-upload";
import {
  DraftReceipt,
  createDraftReceiptFromUpload,
  getDraftReceiptById,
  updateDraftReceiptItem,
  updateDraftReceiptName,
} from "@/constants/mock-receipts";

type ReceiptItemEditor = {
  id: string;
  name: string;
  priceInput: string;
  isAdded: boolean;
};

export default function AddReceiptScreen() {
  const { id: groupId, receiptId } = useLocalSearchParams<{
    id: string;
    receiptId?: string;
  }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [receiptName, setReceiptName] = useState("");
  const [receiptItems, setReceiptItems] = useState<ReceiptItemEditor[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const cameraRef = useRef<CameraView | null>(null);

  const loadDraftReceipt = useCallback(
    (draft?: DraftReceipt) => {
      if (!draft) {
        setReceiptName("");
        setReceiptItems([]);
        setSelectedItemIds([]);
        return;
      }

      setReceiptName(draft.name);
      setReceiptItems(
        draft.items.map((item) => ({
          id: item.id,
          name: item.name,
          priceInput: String(item.price),
          isAdded: !!item.addedToExpenseAt,
        }))
      );
      setSelectedItemIds((prev) =>
        prev.filter((itemId) => {
          const match = draft.items.find((item) => item.id === itemId);
          return !!match && !match.addedToExpenseAt;
        })
      );
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      if (!receiptId) {
        loadDraftReceipt(undefined);
        return;
      }
      loadDraftReceipt(getDraftReceiptById(groupId, receiptId));
    }, [groupId, loadDraftReceipt, receiptId])
  );

  const handleTakePhoto = async () => {
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.7,
      });
      if (photo?.uri) {
        setPhotoUri(photo.uri);
      }
    } catch {
      Alert.alert("Camera error", "Could not take photo.");
    }
  };

  const handleSendToBackend = async () => {
    if (!photoUri || isUploading) return;
    setIsUploading(true);

    try {
      const result = await mockUploadReceipt(photoUri, groupId);
      const draft = createDraftReceiptFromUpload(groupId, result);
      loadDraftReceipt(draft);
      router.push(
        `/group/${groupId}/add-receipt?receiptId=${encodeURIComponent(draft.id)}`
      );
    } catch {
      Alert.alert("Upload failed", "Could not upload receipt.");
    } finally {
      setIsUploading(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleReceiptNameChange = (nextName: string) => {
    setReceiptName(nextName);
    if (!receiptId) return;
    updateDraftReceiptName(groupId, receiptId, nextName);
  };

  const handleItemNameChange = (itemId: string, nextName: string) => {
    setReceiptItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, name: nextName } : item))
    );
    if (!receiptId) return;
    updateDraftReceiptItem(groupId, receiptId, itemId, { name: nextName });
  };

  const handleItemPriceInputChange = (itemId: string, nextPrice: string) => {
    setReceiptItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, priceInput: nextPrice } : item
      )
    );
  };

  const handleItemPriceBlur = (itemId: string) => {
    if (!receiptId) return;
    const item = receiptItems.find((entry) => entry.id === itemId);
    if (!item) return;
    const parsed = parseFloat(item.priceInput.replace(",", "."));
    if (isNaN(parsed) || parsed < 0) {
      const draft = getDraftReceiptById(groupId, receiptId);
      const original = draft?.items.find((entry) => entry.id === itemId);
      if (!original) return;
      setReceiptItems((prev) =>
        prev.map((entry) =>
          entry.id === itemId ? { ...entry, priceInput: String(original.price) } : entry
        )
      );
      return;
    }
    updateDraftReceiptItem(groupId, receiptId, itemId, { price: parsed });
    setReceiptItems((prev) =>
      prev.map((entry) =>
        entry.id === itemId ? { ...entry, priceInput: String(parsed) } : entry
      )
    );
  };

  const selectedEditableItems = receiptItems.filter(
    (item) => selectedItemIds.includes(item.id) && !item.isAdded
  );
  const remainingEditableItems = receiptItems.filter((item) => !item.isAdded);
  const canAddSelected =
    !!receiptId &&
    selectedEditableItems.length > 0 &&
    selectedEditableItems.every((item) => {
      const numeric = parseFloat(item.priceInput.replace(",", "."));
      return item.name.trim().length > 0 && !isNaN(numeric) && numeric > 0;
    });
  const canAddAllRemaining =
    !!receiptId &&
    remainingEditableItems.length > 0 &&
    remainingEditableItems.every((item) => {
      const numeric = parseFloat(item.priceInput.replace(",", "."));
      return item.name.trim().length > 0 && !isNaN(numeric) && numeric > 0;
    });

  const pushToAddExpenseForItems = (
    items: ReceiptItemEditor[],
    returnToGroupIfDone: boolean
  ) => {
    if (!receiptId || items.length === 0) return;
    const prefillName = items
      .map((item) => item.name.trim())
      .join(", ");
    const totalAmount = items.reduce((sum, item) => {
      const numeric = parseFloat(item.priceInput.replace(",", "."));
      return isNaN(numeric) ? sum : sum + numeric;
    }, 0);

    router.push({
      pathname: "/group/[id]/add-payment",
      params: {
        id: groupId,
        prefillName,
        prefillAmount: totalAmount.toFixed(2),
        sourceReceiptId: receiptId,
        sourceReceiptItemIds: items.map((item) => item.id).join(","),
        returnToGroupIfReceiptDone: returnToGroupIfDone ? "1" : "0",
      },
    });
  };

  const handleAddSelectedAsExpense = () => {
    if (!canAddSelected) return;
    pushToAddExpenseForItems(selectedEditableItems, false);
  };

  const handleAddAllRemainingAsExpense = () => {
    if (!canAddAllRemaining) return;
    pushToAddExpenseForItems(remainingEditableItems, true);
  };

  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg items-center justify-center px-5">
        <Text className="text-app-text">Loading camera permission...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg px-5 pt-16 gap-4">
        <Text className="text-3xl font-bold text-app-text">Add a receipt</Text>
        <View className="bg-app-surface border border-app-border rounded-xl p-4 gap-3">
          <Text className="text-app-text">
            Camera access is needed to take a receipt photo.
          </Text>
          <Pressable
            onPress={requestPermission}
            className="rounded-[10px] py-3 items-center bg-app-primary"
          >
            <Text className="text-app-text font-semibold">Allow camera</Text>
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            className="rounded-[10px] py-3 items-center bg-app-cancel"
          >
            <Text className="text-app-text font-semibold">Cancel</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (receiptId) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg">
        <View className="px-5 pt-16 pb-4 gap-3">
          <Text className="text-3xl font-bold text-app-text">Add a receipt</Text>
          <Text className="text-app-muted">
            Name the receipt, fix scanned items, and add selected items as expenses.
          </Text>
        </View>

        <View className="px-5 pb-6 flex-1 gap-4">
          <View className="bg-app-surface border border-app-border rounded-xl p-[14px] gap-2">
            <Text className="text-[13px] text-app-muted">Receipt name</Text>
            <TextInput
              value={receiptName}
              onChangeText={handleReceiptNameChange}
              placeholder="e.g. Weekly groceries"
              placeholderTextColor="#7c90c6"
              className="bg-app-input border border-app-input-border rounded-[10px] px-3 py-[10px] text-app-text"
            />
          </View>

          <View className="bg-app-surface border border-app-border rounded-xl p-[14px] gap-2 flex-1">
            <Text className="text-base font-semibold text-app-text">Receipt items</Text>
            <ScrollView
              className="flex-1"
              contentContainerClassName="gap-2 pb-2"
              showsVerticalScrollIndicator
            >
              {receiptItems.map((item) => {
                const isSelected = selectedItemIds.includes(item.id);
                const isDisabled = item.isAdded;
                return (
                  <View
                    key={item.id}
                    className={`rounded-[10px] border px-3 py-[10px] gap-2 ${
                      isDisabled
                        ? "bg-app-card border-app-border opacity-50"
                        : "bg-app-card border-app-border-soft"
                    }`}
                  >
                    <View className="flex-row items-center gap-2">
                      <Pressable
                        onPress={() => {
                          if (!isDisabled) toggleItemSelection(item.id);
                        }}
                        className={`w-[22px] h-[22px] rounded-md border items-center justify-center ${
                          isSelected && !isDisabled
                            ? "bg-white border-white"
                            : "bg-app-card border-app-input-border"
                        }`}
                      >
                        {isSelected && !isDisabled && (
                          <Text className="font-bold text-app-border-soft">✓</Text>
                        )}
                      </Pressable>
                      <Text className="text-xs text-app-muted flex-1">
                        {isDisabled ? "Already added to an expense" : "Select for expense"}
                      </Text>
                    </View>
                    <View className="flex-row gap-2">
                      <TextInput
                        value={item.name}
                        onChangeText={(value) => handleItemNameChange(item.id, value)}
                        editable={!isDisabled}
                        placeholder="Item name"
                        placeholderTextColor="#7c90c6"
                        className="flex-1 bg-app-input border border-app-input-border rounded-[10px] px-3 py-[10px] text-app-text"
                      />
                      <TextInput
                        value={item.priceInput}
                        onChangeText={(value) =>
                          handleItemPriceInputChange(item.id, value)
                        }
                        onBlur={() => handleItemPriceBlur(item.id)}
                        editable={!isDisabled}
                        placeholder="0.00"
                        placeholderTextColor="#7c90c6"
                        keyboardType="decimal-pad"
                        className="w-[110px] bg-app-input border border-app-input-border rounded-[10px] px-3 py-[10px] text-app-text text-right"
                      />
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>

          <View className="gap-3">
            <Pressable
              onPress={handleAddSelectedAsExpense}
              disabled={!canAddSelected}
              className={`rounded-[10px] py-3 items-center ${
                canAddSelected ? "bg-app-primary" : "bg-app-primary-dim"
              }`}
            >
              <Text className="text-app-text font-semibold">Add selected as expense</Text>
            </Pressable>
            <Pressable
              onPress={handleAddAllRemainingAsExpense}
              disabled={!canAddAllRemaining}
              className={`rounded-[10px] py-3 items-center ${
                canAddAllRemaining ? "bg-app-primary" : "bg-app-primary-dim"
              }`}
            >
              <Text className="text-app-text font-semibold">
                Add all remaining as one expense
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.back()}
              className="rounded-[10px] py-3 items-center bg-app-cancel"
            >
              <Text className="text-app-text font-semibold">Close</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-app-bg">
      <View className="px-5 pt-16 pb-4 gap-3">
        <Text className="text-3xl font-bold text-app-text">Add a receipt</Text>
        <Text className="text-app-muted">
          Take a photo and send it to backend (mocked for now).
        </Text>
      </View>

      <View className="mx-5 mb-4 rounded-xl overflow-hidden border border-app-border flex-1">
        {!photoUri ? (
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
        ) : (
          <View className="flex-1 items-center justify-center bg-app-surface px-5">
            <Text className="text-app-text text-center">
              Photo captured and ready to upload.
            </Text>
            <Text className="text-app-muted text-center mt-2">{photoUri}</Text>
          </View>
        )}
      </View>

      <View className="px-5 pb-6 gap-3">
        {!photoUri ? (
          <Pressable
            onPress={handleTakePhoto}
            className="rounded-[10px] py-3 items-center bg-app-primary"
          >
            <Text className="text-app-text font-semibold">Take photo</Text>
          </Pressable>
        ) : (
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => setPhotoUri(null)}
              className="flex-1 rounded-[10px] py-3 items-center bg-app-cancel"
            >
              <Text className="text-app-text font-semibold">Retake</Text>
            </Pressable>
            <Pressable
              onPress={handleSendToBackend}
              disabled={isUploading}
              className={`flex-1 rounded-[10px] py-3 items-center ${
                isUploading ? "bg-app-primary-dim" : "bg-app-primary"
              }`}
            >
              {isUploading ? (
                <ActivityIndicator color="#f4f7ff" />
              ) : (
                <Text className="text-app-text font-semibold">Send</Text>
              )}
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={() => router.back()}
          className="rounded-[10px] py-3 items-center bg-app-cancel"
        >
          <Text className="text-app-text font-semibold">Close</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
