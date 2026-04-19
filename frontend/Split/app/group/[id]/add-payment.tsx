import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ExpenseSplitType } from "@/api/generated/api";
import { backendClient } from "@/api/generated/client";
import {
  ExpenseItemsList,
  type ExpenseItemsListItem,
} from "@/components/expense-items-list";
import {
  countRemainingDraftReceiptItems,
  markDraftReceiptItemsAsAdded,
} from "@/constants/mock-receipts";
import { CURRENT_USER, CURRENT_USER_BACKEND_ID } from "@/constants/mock-user";

type Member = {
  id: string;
  name: string;
};

type ReceiptExpenseItemPayload = {
  id: string;
  name: string;
  amountCents: number;
};

type ExpenseItemDraft = {
  id: string;
  name: string;
  priceInput: string;
  isPersisted: boolean;
};

type DropdownKey = "paidBy" | "splitBetween" | null;

export default function AddPaymentScreen() {
  const {
    id: groupId,
    paymentId,
    prefillName,
    prefillAmount,
    sourceReceiptId,
    sourceReceiptItemIds,
    sourceReceiptItemsPayload,
    returnToGroupIfReceiptDone,
  } = useLocalSearchParams<{
    id: string;
    paymentId?: string;
    prefillName?: string;
    prefillAmount?: string;
    sourceReceiptId?: string;
    sourceReceiptItemIds?: string;
    sourceReceiptItemsPayload?: string;
    returnToGroupIfReceiptDone?: string;
  }>();
  const queryClient = useQueryClient();

  const membersQuery = useQuery({
    queryKey: ["groups", groupId, "members"],
    queryFn: () => backendClient.listGroupUsersGroupsGroupIdUsersGet(groupId),
    select: (response) =>
      response.data.map(
        (user): Member => ({
          id: user.id,
          name: user.display_name,
        })
      ),
    enabled: !!groupId,
  });
  const existingExpenseQuery = useQuery({
    queryKey: ["groups", groupId, "expenses", paymentId],
    queryFn: () =>
      backendClient.getExpenseGroupsGroupIdExpensesExpenseIdGet(
        groupId,
        paymentId!
      ),
    select: (response) => response.data,
    enabled: !!groupId && !!paymentId,
  });
  const isEditing = !!paymentId;

  const members = useMemo<Member[]>(
    () =>
      membersQuery.data && membersQuery.data.length > 0
        ? membersQuery.data
        : [{ id: CURRENT_USER_BACKEND_ID, name: CURRENT_USER.name }],
    [membersQuery.data]
  );

  const [name, setName] = useState(prefillName ?? "");
  const [amount, setAmount] = useState(prefillAmount ?? "");
  const [paidById, setPaidById] = useState<string>(CURRENT_USER_BACKEND_ID);
  const [owesIds, setOwesIds] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null);
  const [expenseItemsDraft, setExpenseItemsDraft] = useState<
    ExpenseItemDraft[]
  >([]);
  const [deletedPersistedItemIds, setDeletedPersistedItemIds] = useState<
    string[]
  >([]);

  const receiptExpenseItems = useMemo<ReceiptExpenseItemPayload[]>(() => {
    if (!sourceReceiptItemsPayload) return [];
    try {
      const parsed = JSON.parse(
        sourceReceiptItemsPayload
      ) as ReceiptExpenseItemPayload[];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (item) =>
          !!item &&
          typeof item.id === "string" &&
          typeof item.name === "string" &&
          typeof item.amountCents === "number"
      );
    } catch {
      return [];
    }
  }, [sourceReceiptItemsPayload]);

  const trimmedName = name.trim();
  const numericAmount = parseFloat(amount.replace(",", "."));
  const amountCents = Math.round(numericAmount * 100);
  const existingItems = existingExpenseQuery.data?.items ?? [];
  const isReceiptCreateWithItems = !isEditing && expenseItemsDraft.length > 0;
  const isReceiptMultiItemCreate =
    isReceiptCreateWithItems && expenseItemsDraft.length > 1;
  const isSingleItemExpense = isEditing && expenseItemsDraft.length === 1;
  const isMultiItemExpense = isEditing && expenseItemsDraft.length > 1;
  const draftItemsTotalCents = expenseItemsDraft.reduce((sum, item) => {
    const parsed = parseFloat(item.priceInput.replace(",", "."));
    return isNaN(parsed) ? sum : sum + Math.round(parsed * 100);
  }, 0);
  const singleEditableItem = isSingleItemExpense
    ? expenseItemsDraft[0]
    : undefined;
  const areDraftItemsValid = expenseItemsDraft.every((item) => {
    const parsed = parseFloat(item.priceInput.replace(",", "."));
    return item.name.trim().length > 0 && !isNaN(parsed) && parsed > 0;
  });
  const canSave =
    trimmedName.length > 0 &&
    !isNaN(numericAmount) &&
    numericAmount > 0 &&
    owesIds.length > 0 &&
    (!isReceiptCreateWithItems || areDraftItemsValid) &&
    (!isMultiItemExpense || areDraftItemsValid) &&
    !membersQuery.isPending &&
    (!isEditing || !existingExpenseQuery.isPending);

  const goToGroupsView = () => router.replace("/");
  const handleBackNavigation = () => {
    goToGroupsView();
  };

  useEffect(() => {
    const memberIds = members.map((member) => member.id);
    setOwesIds((previous) => {
      const filtered = previous.filter((entry) => memberIds.includes(entry));
      return filtered.length > 0 ? filtered : memberIds;
    });

    setPaidById((previous) =>
      memberIds.includes(previous) ? previous : memberIds[0] ?? previous
    );
  }, [members]);

  useEffect(() => {
    if (!isEditing || !existingExpenseQuery.data) return;
    const expense = existingExpenseQuery.data;
    setName(expense.description);
    const computedTotal = expense.items.reduce(
      (sum, item) => sum + item.amount,
      0
    );
    setExpenseItemsDraft(
      expense.items.map((item) => ({
        id: item.id,
        name: item.description,
        priceInput: (item.amount / 100).toFixed(2),
        isPersisted: true,
      }))
    );
    setDeletedPersistedItemIds([]);
    setAmount((computedTotal / 100).toFixed(2));
    setPaidById(expense.paid_by);
    setOwesIds(expense.participants);
  }, [isEditing, existingExpenseQuery.data]);

  useEffect(() => {
    if (isEditing || receiptExpenseItems.length === 0) return;
    setExpenseItemsDraft(
      receiptExpenseItems.map((item) => ({
        id: item.id,
        name: item.name,
        priceInput: (item.amountCents / 100).toFixed(2),
        isPersisted: false,
      }))
    );
  }, [isEditing, receiptExpenseItems]);

  useEffect(() => {
    if (!(isMultiItemExpense || isReceiptMultiItemCreate)) return;
    setAmount((draftItemsTotalCents / 100).toFixed(2));
  }, [isMultiItemExpense, isReceiptMultiItemCreate, draftItemsTotalCents]);

  const toggleDropdown = (key: Exclude<DropdownKey, null>) => {
    setOpenDropdown((prev) => (prev === key ? null : key));
  };

  const toggleOwes = (id: string) => {
    setOwesIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const paidByName =
    members.find((m) => m.id === paidById)?.name ?? CURRENT_USER.name;

  const owesSummary =
    owesIds.length === members.length
      ? "Everyone"
      : owesIds.length === 0
      ? "Nobody"
      : owesIds
          .map((id) => members.find((m) => m.id === id)?.name)
          .filter(Boolean)
          .join(", ");

  const sourceItemIds = useMemo(
    () =>
      sourceReceiptItemIds
        ? sourceReceiptItemIds
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
        : [],
    [sourceReceiptItemIds]
  );
  const effectiveSourceItemIds = useMemo(
    () =>
      sourceItemIds.filter((itemId) =>
        expenseItemsDraft.some((item) => item.id === itemId)
      ),
    [sourceItemIds, expenseItemsDraft]
  );

  const handleItemNameChange = (itemId: string, value: string) => {
    setExpenseItemsDraft((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, name: value } : item))
    );
  };

  const handleItemPriceInputChange = (itemId: string, value: string) => {
    setExpenseItemsDraft((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, priceInput: value } : item
      )
    );
  };

  const handleItemPriceBlur = (itemId: string) => {
    setExpenseItemsDraft((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const parsed = parseFloat(item.priceInput.replace(",", "."));
        if (isNaN(parsed) || parsed <= 0)
          return { ...item, priceInput: "0.00" };
        return { ...item, priceInput: parsed.toFixed(2) };
      })
    );
  };

  const handleDeleteItem = (itemId: string) => {
    setExpenseItemsDraft((prev) => {
      const target = prev.find((item) => item.id === itemId);
      if (target?.isPersisted) {
        setDeletedPersistedItemIds((current) =>
          current.includes(itemId) ? current : [...current, itemId]
        );
      }
      return prev.filter((item) => item.id !== itemId);
    });
  };

  const savePaymentMutation = useMutation({
    mutationFn: async () => {
      if (isEditing && paymentId) {
        await backendClient.updateExpenseGroupsGroupIdExpensesExpenseIdPatch(
          groupId,
          paymentId,
          {
            description: trimmedName,
            paid_by: paidById,
            participants: owesIds,
            split_type: ExpenseSplitType.Equal,
          }
        );

        for (const deletedItemId of deletedPersistedItemIds) {
          await backendClient.deleteExpenseItemGroupsGroupIdExpensesExpenseIdItemsItemIdDelete(
            groupId,
            paymentId,
            deletedItemId
          );
        }

        const existingById = new Map(
          existingItems.map((item) => [item.id, item])
        );
        for (const draftItem of expenseItemsDraft) {
          if (!draftItem.isPersisted) continue;
          const originalItem = existingById.get(draftItem.id);
          if (!originalItem) continue;
          const nextAmountCents = Math.round(
            parseFloat(draftItem.priceInput.replace(",", ".")) * 100
          );
          const shouldUpdateName = draftItem.name !== originalItem.description;
          const shouldUpdateAmount =
            !isNaN(nextAmountCents) && nextAmountCents !== originalItem.amount;
          if (!shouldUpdateName && !shouldUpdateAmount) continue;
          await backendClient.updateExpenseItemGroupsGroupIdExpensesExpenseIdItemsItemIdPatch(
            groupId,
            paymentId,
            draftItem.id,
            {
              description: shouldUpdateName ? draftItem.name : undefined,
              amount: shouldUpdateAmount ? nextAmountCents : undefined,
            }
          );
        }

        if (singleEditableItem && singleEditableItem.isPersisted) {
          await backendClient.updateExpenseItemGroupsGroupIdExpensesExpenseIdItemsItemIdPatch(
            groupId,
            paymentId,
            singleEditableItem.id,
            { amount: amountCents }
          );
        }

        return;
      }
      await backendClient.createExpenseFromFrontendGroupsGroupIdExpensesFrontendPost(
        groupId,
        {
          description: trimmedName,
          paidBy: paidById,
          participantUserIds: owesIds,
          splitType: ExpenseSplitType.Equal,
          items: isReceiptCreateWithItems
            ? expenseItemsDraft.map((item) => ({
                description: item.name.trim(),
                amount:
                  expenseItemsDraft.length === 1
                    ? amountCents
                    : Math.round(
                        parseFloat(item.priceInput.replace(",", ".")) * 100
                      ),
              }))
            : [
                {
                  description: trimmedName,
                  amount: amountCents,
                },
              ],
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
      queryClient.invalidateQueries({ queryKey: ["groups", groupId, "debts"] });
      queryClient.invalidateQueries({
        queryKey: ["users", CURRENT_USER_BACKEND_ID, "groups"],
      });
      if (paymentId) {
        queryClient.invalidateQueries({
          queryKey: ["groups", groupId, "expenses", paymentId],
        });
      }
      if (sourceReceiptId && effectiveSourceItemIds.length > 0) {
        markDraftReceiptItemsAsAdded(
          groupId,
          sourceReceiptId,
          effectiveSourceItemIds
        );
        if (returnToGroupIfReceiptDone === "1") {
          const remaining = countRemainingDraftReceiptItems(
            groupId,
            sourceReceiptId
          );
          if (remaining === 0) {
            goToGroupsView();
            return;
          }
        }
      }
      goToGroupsView();
    },
  });
  const deleteExpenseMutation = useMutation({
    mutationFn: async () => {
      if (!paymentId) return;
      await backendClient.deleteExpenseGroupsGroupIdExpensesExpenseIdDelete(
        groupId,
        paymentId
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
      queryClient.invalidateQueries({ queryKey: ["groups", groupId, "debts"] });
      queryClient.invalidateQueries({
        queryKey: ["users", CURRENT_USER_BACKEND_ID, "groups"],
      });
      if (paymentId) {
        queryClient.invalidateQueries({
          queryKey: ["groups", groupId, "expenses", paymentId],
        });
      }
      goToGroupsView();
    },
  });

  const handleSave = () => {
    if (!canSave || savePaymentMutation.isPending) return;
    savePaymentMutation.mutate();
  };

  const multiItemsListItems: ExpenseItemsListItem[] = expenseItemsDraft.map(
    (item) => ({
      id: item.id,
      name: item.name,
      priceInput: item.priceInput,
      isDisabled: false,
    })
  );

  return (
    <SafeAreaView className="flex-1 bg-app-bg">
      <Stack.Screen
        options={{
          gestureEnabled: false,
          headerLeft: () => (
            <Pressable
              onPress={handleBackNavigation}
              className="w-10 h-10 items-start justify-center"
            >
              <Ionicons name="chevron-back" size={22} color="#2563eb" />
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerClassName="px-5 pt-16 pb-6 gap-4">
        <Text className="text-3xl font-bold text-app-text">
          {isEditing ? "Edit Payment" : "Add Payment"}
        </Text>
        {isEditing ? (
          <Text className="text-sm text-app-muted">
            Editing updates description, payer, and participants.
          </Text>
        ) : null}

        <View className="bg-app-surface border border-app-border rounded-xl p-[14px] gap-[10px]">
          <View className="flex-row gap-2">
            <View className="flex-1 gap-1">
              <Text className="text-[13px] text-app-muted">Expense</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Groceries"
                placeholderTextColor="#7c90c6"
                editable={!savePaymentMutation.isPending}
                className="bg-app-input border border-app-input-border rounded-[10px] px-3 py-[10px] text-app-text"
              />
            </View>
            <View className="w-[110px] gap-1">
              <Text className="text-[13px] text-app-muted">Amount</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor="#7c90c6"
                keyboardType="decimal-pad"
                editable={
                  !savePaymentMutation.isPending &&
                  (!isEditing || isSingleItemExpense) &&
                  !isReceiptMultiItemCreate
                }
                className="bg-app-input border border-app-input-border rounded-[10px] px-3 py-[10px] text-app-text text-right"
              />
            </View>
          </View>
          {isSingleItemExpense ? (
            <Text className="text-[12px] text-app-muted">
              Single-item expense: editing amount updates that item value.
            </Text>
          ) : isReceiptMultiItemCreate ? (
            <Text className="text-[12px] text-app-muted">
              Receipt expense with multiple items: amount is sum of item values.
            </Text>
          ) : isMultiItemExpense ? (
            <Text className="text-[12px] text-app-muted">
              Multi-item expense: amount is the sum of item values.
            </Text>
          ) : null}
        </View>

        <View className="bg-app-surface border border-app-border rounded-xl p-[14px] gap-[10px]">
          <Pressable
            onPress={() => toggleDropdown("paidBy")}
            disabled={savePaymentMutation.isPending}
            className="flex-row items-center justify-between bg-app-card border border-app-border-soft rounded-[10px] py-[10px] px-3"
          >
            <View className="flex-1">
              <Text className="text-[13px] text-app-muted">Paid by</Text>
              <Text className="text-[15px] font-semibold text-app-text">
                {paidByName}
              </Text>
            </View>
            <Text className="text-app-muted">
              {openDropdown === "paidBy" ? "▲" : "▼"}
            </Text>
          </Pressable>

          {openDropdown === "paidBy" && (
            <View className="gap-1">
              {members.map((member) => {
                const isActive = member.id === paidById;
                return (
                  <Pressable
                    key={member.id}
                    onPress={() => {
                      setPaidById(member.id);
                      setOpenDropdown(null);
                    }}
                    disabled={savePaymentMutation.isPending}
                    className={`flex-row items-center justify-between rounded-[10px] py-[10px] px-3 border border-app-border-soft ${
                      isActive ? "bg-app-border-soft" : "bg-app-card"
                    }`}
                  >
                    <Text
                      className={`text-[15px] ${
                        isActive
                          ? "text-app-text font-semibold"
                          : "text-app-muted"
                      }`}
                    >
                      {member.name}
                    </Text>
                    {isActive && (
                      <Text className="text-app-text font-bold">✓</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          <Pressable
            onPress={() => toggleDropdown("splitBetween")}
            disabled={savePaymentMutation.isPending}
            className="flex-row items-center justify-between bg-app-card border border-app-border-soft rounded-[10px] py-[10px] px-3"
          >
            <View className="flex-1 pr-2">
              <Text className="text-[13px] text-app-muted">Split between</Text>
              <Text
                numberOfLines={1}
                className="text-[15px] font-semibold text-app-text"
              >
                {owesSummary} ({owesIds.length})
              </Text>
            </View>
            <Text className="text-app-muted">
              {openDropdown === "splitBetween" ? "▲" : "▼"}
            </Text>
          </Pressable>

          {openDropdown === "splitBetween" && (
            <View className="gap-1">
              {members.map((member) => {
                const isSelected = owesIds.includes(member.id);
                return (
                  <Pressable
                    key={member.id}
                    onPress={() => toggleOwes(member.id)}
                    disabled={savePaymentMutation.isPending}
                    className={`flex-row items-center justify-between rounded-[10px] py-[10px] px-3 border border-app-border-soft ${
                      isSelected ? "bg-app-border-soft" : "bg-app-card"
                    }`}
                  >
                    <Text className="text-[15px] text-app-text">
                      {member.name}
                    </Text>
                    <View
                      className={`w-[22px] h-[22px] rounded-md border items-center justify-center ${
                        isSelected
                          ? "bg-white border-white"
                          : "bg-app-card border-app-input-border"
                      }`}
                    >
                      {isSelected && (
                        <Text className="font-bold text-app-border-soft">
                          ✓
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {isMultiItemExpense || isReceiptMultiItemCreate ? (
          <View className="bg-app-surface border border-app-border rounded-xl p-[14px] gap-[10px]">
            <View>
              <Text className="text-[15px] font-semibold text-app-text">
                {expenseItemsDraft.length} items
              </Text>
            </View>
            <ScrollView
              className="max-h-[220px]"
              contentContainerClassName="gap-2 pb-1"
              nestedScrollEnabled
            >
              <ExpenseItemsList
                items={multiItemsListItems}
                showSelection={false}
                editable
                onNameChange={handleItemNameChange}
                onPriceInputChange={handleItemPriceInputChange}
                onPriceBlur={handleItemPriceBlur}
                enableSwipeDelete
                onDelete={handleDeleteItem}
              />
            </ScrollView>
          </View>
        ) : null}

        <View className="bg-app-surface border border-app-border rounded-xl p-[14px] gap-[10px]">
          <Text className="text-base font-semibold text-app-text">
            Split method
          </Text>
          <Text className="text-[13px] text-app-muted">
            Quick payment currently creates an equal split for selected members.
          </Text>
        </View>

        {membersQuery.isPending ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator color="#d7e6ff" />
            <Text className="text-app-muted">Loading group members…</Text>
          </View>
        ) : null}
        {isEditing && existingExpenseQuery.isPending ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator color="#d7e6ff" />
            <Text className="text-app-muted">Loading payment details…</Text>
          </View>
        ) : null}
        {savePaymentMutation.isError ? (
          <Text className="text-app-danger">
            Could not {isEditing ? "update" : "create"} payment
            {savePaymentMutation.error instanceof Error
              ? `: ${savePaymentMutation.error.message}`
              : ""}
            .
          </Text>
        ) : null}

        <View className="flex-row gap-3 mt-2">
          <Pressable
            onPress={handleBackNavigation}
            disabled={
              savePaymentMutation.isPending || deleteExpenseMutation.isPending
            }
            className="flex-1 rounded-[10px] py-3 items-center bg-app-cancel"
          >
            <Text className="text-app-text font-semibold">Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={
              !canSave ||
              savePaymentMutation.isPending ||
              deleteExpenseMutation.isPending
            }
            className={`flex-1 rounded-[10px] py-3 items-center ${
              canSave && !savePaymentMutation.isPending
                ? "bg-app-primary"
                : "bg-app-primary-dim"
            }`}
          >
            {savePaymentMutation.isPending ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator color="#f4f7ff" />
                <Text className="text-app-text font-semibold">
                  {isEditing ? "Updating…" : "Saving…"}
                </Text>
              </View>
            ) : (
              <Text className="text-app-text font-semibold">
                {isEditing ? "Confirm" : "Save"}
              </Text>
            )}
          </Pressable>
        </View>

        {isEditing ? (
          <Pressable
            onPress={() => deleteExpenseMutation.mutate()}
            disabled={
              savePaymentMutation.isPending || deleteExpenseMutation.isPending
            }
            className="rounded-[10px] py-3 items-center bg-app-danger flex-row justify-center gap-2"
          >
            {deleteExpenseMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={16} color="#fff" />
                <Text className="text-white font-semibold">Delete expense</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
