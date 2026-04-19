import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as DocumentPicker from "expo-document-picker";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { type ReceiptProcessedOut } from "@/api/generated/api";
import { backendClient } from "@/api/generated/client";
import {
  ExpenseItemsList,
  type ExpenseItemsListItem,
} from "@/components/expense-items-list";
import {
  DraftReceipt,
  createDraftReceiptFromUpload,
  deleteDraftReceiptItem,
  getDraftReceiptById,
  updateDraftReceiptItem,
  updateDraftReceiptName,
} from "@/constants/mock-receipts";

type UploadResultLike = {
  receiptId: string;
  extractedReceiptName: string;
  items: {
    name: string;
    price: number;
  }[];
};

function mapProcessedReceiptToDraftUploadResult(
  processed: ReceiptProcessedOut,
  groupId: string
): UploadResultLike {
  const receiptId = `r-${groupId}-${Date.now()}`;
  const extractedReceiptName =
    processed.summary_label?.trim() ||
    `Receipt ${new Date().toLocaleDateString()}`;

  return {
    receiptId,
    extractedReceiptName,
    items: processed.items.map((item, index) => {
      const parsedTotal = Number(item.total_price);
      const fallbackTotal = Number(item.unit_price) * Number(item.quantity);
      const price = Number.isFinite(parsedTotal)
        ? parsedTotal
        : Number.isFinite(fallbackTotal)
        ? fallbackTotal
        : 0;

      return {
        name: item.name?.trim() || `Item ${index + 1}`,
        price,
      };
    }),
  };
}

type ReceiptItemEditor = {
  id: string;
  name: string;
  priceInput: string;
  isAdded: boolean;
};

type ReceiptExpenseItemPayload = {
  id: string;
  name: string;
  amountCents: number;
};

export default function AddReceiptScreen() {
  const { id: groupId, receiptId } = useLocalSearchParams<{
    id: string;
    receiptId?: string;
  }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [photoMimeType, setPhotoMimeType] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [receiptName, setReceiptName] = useState("");
  const [receiptItems, setReceiptItems] = useState<ReceiptItemEditor[]>([]);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const cameraRef = useRef<CameraView | null>(null);

  const loadDraftReceipt = useCallback((draft?: DraftReceipt) => {
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
  }, []);

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
        setPhotoName(photo.uri.split("/").pop() || null);
        setPhotoMimeType("image/jpeg");
      }
    } catch {
      Alert.alert("Camera error", "Could not take photo.");
    }
  };

  const handlePickFromFiles = async () => {
    if (isUploading) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "image/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const picked = result.assets[0];
      setPhotoUri(picked.uri);
      setPhotoName(picked.name || null);
      setPhotoMimeType(picked.mimeType || "image/jpeg");
    } catch {
      Alert.alert("File picker error", "Could not select an image.");
    }
  };

  const handleSendToBackend = async () => {
    if (!photoUri || isUploading) return;
    setIsUploading(true);

    try {
      const fileName =
        photoName || photoUri.split("/").pop() || `receipt-${Date.now()}.jpg`;
      // React Native expects { uri, name, type } for multipart file fields.
      const uploadFile = {
        uri: photoUri,
        name: fileName,
        type: photoMimeType || "image/jpeg",
      } as unknown as File;

      const { data } =
        await backendClient.processReceiptUploadReceiptsProcessPost(uploadFile);
      const result = mapProcessedReceiptToDraftUploadResult(data, groupId);
      const draft = createDraftReceiptFromUpload(groupId, result);
      loadDraftReceipt(draft);
      router.replace(
        `/group/${groupId}/add-receipt?receiptId=${encodeURIComponent(
          draft.id
        )}`
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not upload receipt.";
      Alert.alert("Upload failed", message);
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
      prev.map((item) =>
        item.id === itemId ? { ...item, name: nextName } : item
      )
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
          entry.id === itemId
            ? { ...entry, priceInput: String(original.price) }
            : entry
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

  const handleDeleteItem = (itemId: string) => {
    const target = receiptItems.find((item) => item.id === itemId);
    if (!target || target.isAdded) return;

    setReceiptItems((prev) => prev.filter((item) => item.id !== itemId));
    setSelectedItemIds((prev) => prev.filter((id) => id !== itemId));

    if (!receiptId) return;
    deleteDraftReceiptItem(groupId, receiptId, itemId);
  };

  const selectedEditableItems = receiptItems.filter(
    (item) => selectedItemIds.includes(item.id) && !item.isAdded
  );
  const receiptItemListItems: ExpenseItemsListItem[] = receiptItems.map(
    (item) => ({
      id: item.id,
      name: item.name,
      priceInput: item.priceInput,
      isDisabled: item.isAdded,
    })
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
  const selectedEditableCount = selectedEditableItems.length;
  const remainingEditableCount = remainingEditableItems.length;
  const allRemainingSelected =
    remainingEditableCount > 0 &&
    selectedEditableCount === remainingEditableCount;

  const toggleSelectAllRemaining = () => {
    if (remainingEditableCount === 0) return;
    if (allRemainingSelected) {
      setSelectedItemIds([]);
      return;
    }
    setSelectedItemIds(remainingEditableItems.map((item) => item.id));
  };

  const translateMutation = useMutation({
    mutationFn: async (itemsToTranslate: ReceiptItemEditor[]) => {
      const { data } =
        await backendClient.translateReceiptLabelsReceiptsTranslateLabelsPost({
          target_language: "English",
          items: itemsToTranslate.map((item) => ({
            name: item.name,
            language: "und",
          })),
        });
      // Map results back to the ids we sent in (response uses index).
      return data.labels.map((label) => ({
        id: itemsToTranslate[label.index]?.id,
        translatedName: label.translated_name,
      }));
    },
    onSuccess: (results) => {
      setReceiptItems((prev) =>
        prev.map((item) => {
          const match = results.find((entry) => entry.id === item.id);
          if (!match || !match.translatedName) return item;
          return { ...item, name: match.translatedName };
        })
      );
      if (!receiptId) return;
      for (const result of results) {
        if (!result.id || !result.translatedName) continue;
        updateDraftReceiptItem(groupId, receiptId, result.id, {
          name: result.translatedName,
        });
      }
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Could not translate items.";
      Alert.alert("Translate failed", message);
    },
  });

  const translatableItems = remainingEditableItems.filter(
    (item) => item.name.trim().length > 0
  );
  const canTranslateAll =
    translatableItems.length > 0 && !translateMutation.isPending;

  const handleTranslateAll = () => {
    if (!canTranslateAll) return;
    translateMutation.mutate(translatableItems);
  };

  const pushToAddExpenseForItems = (
    items: ReceiptItemEditor[],
    returnToGroupIfDone: boolean
  ) => {
    if (!receiptId || items.length === 0) return;
    const prefillName = receiptName.trim() || "Receipt expense";
    const expenseItemsPayload: ReceiptExpenseItemPayload[] = items
      .map((item) => {
        const numeric = parseFloat(item.priceInput.replace(",", "."));
        return {
          id: item.id,
          name: item.name.trim(),
          amountCents: isNaN(numeric) ? 0 : Math.round(numeric * 100),
        };
      })
      .filter((item) => item.name.length > 0 && item.amountCents > 0);
    const totalAmount = expenseItemsPayload.reduce((sum, item) => {
      return sum + item.amountCents / 100;
    }, 0);

    if (expenseItemsPayload.length === 0) return;

    const destination = {
      pathname: "/group/[id]/add-payment" as const,
      params: {
        id: groupId,
        prefillName,
        prefillAmount: totalAmount.toFixed(2),
        sourceReceiptId: receiptId,
        sourceReceiptItemIds: items.map((item) => item.id).join(","),
        sourceReceiptItemsPayload: JSON.stringify(expenseItemsPayload),
        returnToGroupIfReceiptDone: returnToGroupIfDone ? "1" : "0",
      },
    };
    router.replace(destination);
  };

  const handleAddSelectedAsExpense = () => {
    if (!canAddSelected) return;
    const selectedAllRemaining =
      selectedEditableItems.length === remainingEditableItems.length;
    pushToAddExpenseForItems(selectedEditableItems, selectedAllRemaining);
  };

  const handleAddAllRemainingAsExpense = () => {
    if (!canAddAllRemaining) return;
    pushToAddExpenseForItems(remainingEditableItems, true);
  };

  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-[#0f1115] items-center justify-center px-5">
        <Text className="text-white/70">Loading camera permission...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-[#0f1115] px-5 pt-16 gap-4">
        <Text className="text-3xl font-bold text-white">Add a receipt</Text>
        <View className="gap-3 rounded-[22px] border border-white/8 bg-[#171a20] p-4">
          <Text className="text-white/70">
            Camera access is needed to take a photo. You can also choose one
            from files.
          </Text>
          <Pressable
            onPress={handlePickFromFiles}
            className="rounded-[12px] py-3 items-center bg-[#232831] border border-white/10"
          >
            <Text className="text-white font-semibold">Choose from files</Text>
          </Pressable>
          <Pressable
            onPress={requestPermission}
            className="rounded-[12px] py-3 items-center bg-[#2b6fff]"
          >
            <Text className="text-white font-semibold">Allow camera</Text>
          </Pressable>
          <Pressable
            onPress={() => router.back()}
            className="rounded-[12px] py-3 items-center bg-[#232831] border border-white/10"
          >
            <Text className="text-white font-semibold">Cancel</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (receiptId) {
    return (
      <SafeAreaView className="flex-1 bg-[#0f1115]">
        <View className="px-5 pt-16 pb-4 gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-3xl font-bold text-white">
              Create expenses
            </Text>
            <Pressable
              onPress={handleTranslateAll}
              disabled={!canTranslateAll}
              className={`flex-row items-center gap-1.5 rounded-[12px] border px-3 py-2 ${
                canTranslateAll
                  ? "border-sky-400/40 bg-sky-400/15"
                  : "border-white/10 bg-white/5"
              }`}
            >
              {translateMutation.isPending ? (
                <ActivityIndicator size="small" color="#38bdf8" />
              ) : (
                <Ionicons
                  name="language"
                  size={16}
                  color={canTranslateAll ? "#38bdf8" : "#ffffff40"}
                />
              )}
              <Text
                className={`text-sm font-semibold ${
                  canTranslateAll ? "text-sky-400" : "text-white/30"
                }`}
              >
                Translate
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="px-5 pb-6 flex-1 gap-4">
          <View className="rounded-[22px] border border-white/8 bg-[#171a20] p-[14px] gap-2">
            <Text className="text-[13px] text-white/45">Receipt name</Text>
            <TextInput
              value={receiptName}
              onChangeText={handleReceiptNameChange}
              placeholder="e.g. Weekly groceries"
              placeholderTextColor="#9aa1ad"
              className="rounded-[10px] border border-white/10 bg-[#232831] px-3 py-[10px] text-white"
            />
          </View>

          <View className="px-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-white">
                Receipt items
              </Text>
              <Pressable
                onPress={toggleSelectAllRemaining}
                disabled={remainingEditableCount === 0}
              >
                <Text
                  className={`text-sm ${
                    remainingEditableCount === 0
                      ? "text-white/25"
                      : "text-sky-400"
                  }`}
                >
                  {allRemainingSelected ? "Clear" : "Select all"}
                </Text>
              </Pressable>
            </View>
            <Text className="mt-1 text-xs text-white/45">
              Selected {selectedEditableCount} of {remainingEditableCount}{" "}
              remaining
            </Text>
          </View>
          <ScrollView
            className="flex-1"
            contentContainerClassName="gap-2 pb-2"
            showsVerticalScrollIndicator
          >
            <ExpenseItemsList
              items={receiptItemListItems}
              showSelection
              selectedItemIds={selectedItemIds}
              onToggleSelection={toggleItemSelection}
              editable
              onNameChange={handleItemNameChange}
              onPriceInputChange={handleItemPriceInputChange}
              onPriceBlur={handleItemPriceBlur}
              enableSwipeDelete
              onDelete={handleDeleteItem}
            />
          </ScrollView>

          <View className="flex-row gap-3">
            <Pressable
              onPress={handleAddSelectedAsExpense}
              disabled={!canAddSelected}
              className={`flex-1 rounded-[12px] py-3 items-center ${
                canAddSelected ? "bg-[#0ea5e9]" : "bg-[#0ea5e9]/40"
              }`}
            >
              <Text
                numberOfLines={1}
                className="text-white font-semibold text-[13px]"
              >
                {selectedEditableCount > 0
                  ? `Add selected (${selectedEditableCount})`
                  : "Add selected"}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleAddAllRemainingAsExpense}
              disabled={!canAddAllRemaining}
              className={`flex-1 rounded-[12px] py-3 items-center ${
                canAddAllRemaining ? "bg-[#2b6fff]" : "bg-[#2b6fff]/40"
              }`}
            >
              <Text
                numberOfLines={1}
                className="text-white font-semibold text-[13px]"
              >
                {remainingEditableCount > 0
                  ? `Add all (${remainingEditableCount})`
                  : "Add all"}
              </Text>
            </Pressable>
          </View>
          {remainingEditableCount === 0 ? (
            <Text className="text-xs text-white/45 px-1">
              All receipt items are already added to expenses.
            </Text>
          ) : !canAddSelected && selectedEditableCount > 0 ? (
            <Text className="text-xs text-white/45 px-1">
              Some selected items are incomplete. Fill in name and amount first.
            </Text>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#0f1115]">
      <View className="px-5 pt-16 pb-4 gap-3">
        <Text className="text-3xl font-bold text-white">Add a receipt</Text>
        <Text className="text-white/55">
          Take a photo or choose from files, then send it to backend.
        </Text>
      </View>

      <View className="mx-5 mb-4 flex-1 overflow-hidden rounded-[22px] border border-white/10">
        {!photoUri ? (
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
        ) : (
          <Image
            source={{ uri: photoUri }}
            className="h-full w-full"
            resizeMode="cover"
          />
        )}
      </View>

      <View className="px-5 pb-6 gap-3">
        {!photoUri ? (
          <View className="flex-row gap-3">
            <Pressable
              onPress={handlePickFromFiles}
              className="flex-1 rounded-[12px] py-3 items-center justify-center bg-[#232831] border border-white/10 flex-row gap-2"
            >
              <Ionicons name="folder-open-outline" size={18} color="#dbe4f5" />
              <Text className="text-white font-semibold">
                Choose from files
              </Text>
            </Pressable>
            <Pressable
              onPress={handleTakePhoto}
              className="flex-1 rounded-[12px] py-3 items-center justify-center bg-[#2b6fff] flex-row gap-2"
            >
              <Ionicons name="camera-outline" size={18} color="#fff" />
              <Text className="text-white font-semibold">Take photo</Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => {
                setPhotoUri(null);
                setPhotoName(null);
                setPhotoMimeType(null);
              }}
              className="flex-1 rounded-[12px] py-3 items-center bg-[#232831] border border-white/10"
            >
              <Text className="text-white font-semibold">Retake</Text>
            </Pressable>
            <Pressable
              onPress={handleSendToBackend}
              disabled={isUploading}
              className={`flex-1 rounded-[12px] py-3 items-center ${
                isUploading ? "bg-[#2b6fff]/40" : "bg-[#2b6fff]"
              }`}
            >
              {isUploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold">Send</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
