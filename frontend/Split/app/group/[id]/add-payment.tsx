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
    <SafeAreaView className="flex-1 bg-[#0f1115]">
      <Stack.Screen
        options={{
          gestureEnabled: false,
          headerShown: false,
        }}
      />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-4 pb-8 gap-5"
        showsVerticalScrollIndicator={false}
      >
        <View className="mt-2 flex-row items-center justify-between">
          <Pressable
            onPress={handleBackNavigation}
            className="h-10 w-10 items-start justify-center"
          >
            <Ionicons name="chevron-back" size={26} color="#2b6fff" />
          </Pressable>
          <View className="h-10 w-10" />
        </View>

        <View className="gap-1">
          <Text className="text-4xl font-bold text-white">
            {isEditing ? "Edit payment" : "Add payment"}
          </Text>
          {isEditing ? (
            <Text className="text-sm text-white/45">
              Editing updates description, payer, and participants.
            </Text>
          ) : null}
        </View>

        <View className="gap-3 rounded-[22px] border border-white/8 bg-[#171a20] p-4">
          <View className="flex-row gap-3">
            <View className="flex-1 gap-1">
              <Text className="text-[12px] uppercase tracking-[0.13em] text-white/45">
                Expense
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Groceries"
                placeholderTextColor="#9aa1ad"
                editable={!savePaymentMutation.isPending}
                className="rounded-[10px] border border-white/10 bg-[#232831] px-3 py-[10px] text-white"
              />
            </View>
            <View className="w-[92px] gap-1">
              <Text className="text-[12px] uppercase tracking-[0.13em] text-white/45">
                Amount
              </Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor="#9aa1ad"
                keyboardType="decimal-pad"
                editable={
                  !savePaymentMutation.isPending &&
                  (!isEditing || isSingleItemExpense) &&
                  !isReceiptMultiItemCreate
                }
                className="rounded-[10px] border border-white/10 bg-[#232831] px-3 py-[10px] text-right text-white"
              />
            </View>
          </View>
          {isSingleItemExpense ? (
            <Text className="text-xs text-white/45">
              Single-item expense: editing amount updates that item value.
            </Text>
          ) : isReceiptMultiItemCreate ? (
            <Text className="text-xs text-white/45">
              Receipt expense with multiple items: amount is sum of item values.
            </Text>
          ) : isMultiItemExpense ? (
            <Text className="text-xs text-white/45">
              Multi-item expense: amount is the sum of item values.
            </Text>
          ) : null}
        </View>

        <View className="gap-3 rounded-[22px] border border-white/8 bg-[#171a20] p-4">
          <Text className="text-lg font-bold text-white">Split setup</Text>
          <Pressable
            onPress={() => toggleDropdown("paidBy")}
            disabled={savePaymentMutation.isPending}
            className="flex-row items-center justify-between rounded-[14px] border border-white/5 bg-[#2a3038] px-4 py-3"
          >
            <View className="flex-1">
              <Text className="text-[12px] uppercase tracking-[0.13em] text-white/45">
                Paid by
              </Text>
              <Text className="text-[16px] font-semibold text-white">
                {paidByName}
              </Text>
            </View>
            <Text className="text-white/55">
              {openDropdown === "paidBy" ? "▲" : "▼"}
            </Text>
          </Pressable>

          {openDropdown === "paidBy" && (
            <View className="gap-2">
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
                    className={`flex-row items-center justify-between rounded-[12px] border px-3 py-[10px] ${
                      isActive
                        ? "border-sky-400/40 bg-sky-500/10"
                        : "border-white/5 bg-[#2a3038]"
                    }`}
                  >
                    <Text
                      className={`text-[15px] ${
                        isActive ? "font-semibold text-sky-400" : "text-white/80"
                      }`}
                    >
                      {member.name}
                    </Text>
                    {isActive ? (
                      <Text className="font-bold text-sky-400">✓</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}

          <Pressable
            onPress={() => toggleDropdown("splitBetween")}
            disabled={savePaymentMutation.isPending}
            className="flex-row items-center justify-between rounded-[14px] border border-white/5 bg-[#2a3038] px-4 py-3"
          >
            <View className="flex-1 pr-2">
              <Text className="text-[12px] uppercase tracking-[0.13em] text-white/45">
                Split between
              </Text>
              <Text numberOfLines={1} className="text-[16px] font-semibold text-white">
                {owesSummary} ({owesIds.length})
              </Text>
            </View>
            <Text className="text-white/55">
              {openDropdown === "splitBetween" ? "▲" : "▼"}
            </Text>
          </Pressable>

          {openDropdown === "splitBetween" && (
            <View className="gap-2">
              {members.map((member) => {
                const isSelected = owesIds.includes(member.id);
                return (
                  <Pressable
                    key={member.id}
                    onPress={() => toggleOwes(member.id)}
                    disabled={savePaymentMutation.isPending}
                    className={`flex-row items-center justify-between rounded-[12px] border px-3 py-[10px] ${
                      isSelected
                        ? "border-sky-400/40 bg-sky-500/10"
                        : "border-white/5 bg-[#2a3038]"
                    }`}
                  >
                    <Text className="text-[15px] text-white">{member.name}</Text>
                    <View
                      className={`h-[22px] w-[22px] items-center justify-center rounded-md border ${
                        isSelected
                          ? "border-sky-400 bg-sky-400"
                          : "border-white/25 bg-transparent"
                      }`}
                    >
                      {isSelected ? (
                        <Text className="font-bold text-[#0f1115]">✓</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {isMultiItemExpense || isReceiptMultiItemCreate ? (
          <View className="gap-3 rounded-[22px] border border-white/8 bg-[#171a20] p-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-white">Items</Text>
              <Text className="text-sm text-sky-400">
                {expenseItemsDraft.length} total
              </Text>
            </View>
            <ScrollView
              className="max-h-[260px]"
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

        <View className="gap-2 rounded-[22px] border border-white/8 bg-[#171a20] p-4">
          <Text className="text-base font-semibold text-white">Split method</Text>
          <Text className="text-[13px] text-white/45">
            Quick payment currently creates an equal split for selected members.
          </Text>
        </View>

        {membersQuery.isPending ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator color="#38bdf8" />
            <Text className="text-white/55">Loading group members...</Text>
          </View>
        ) : null}
        {isEditing && existingExpenseQuery.isPending ? (
          <View className="flex-row items-center gap-2">
            <ActivityIndicator color="#38bdf8" />
            <Text className="text-white/55">Loading payment details...</Text>
          </View>
        ) : null}
        {savePaymentMutation.isError ? (
          <Text className="text-rose-400">
            Could not {isEditing ? "update" : "create"} payment
            {savePaymentMutation.error instanceof Error
              ? `: ${savePaymentMutation.error.message}`
              : ""}
            .
          </Text>
        ) : null}

        <View className="mt-1 flex-row gap-3">
          <Pressable
            onPress={handleBackNavigation}
            disabled={
              savePaymentMutation.isPending || deleteExpenseMutation.isPending
            }
            className="flex-1 items-center rounded-[12px] border border-white/10 bg-[#232831] py-3"
          >
            <Text className="font-semibold text-white">Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={
              !canSave ||
              savePaymentMutation.isPending ||
              deleteExpenseMutation.isPending
            }
            className={`flex-1 items-center rounded-[12px] py-3 ${
              canSave && !savePaymentMutation.isPending
                ? "bg-[#2b6fff]"
                : "bg-[#2b6fff]/40"
            }`}
          >
            {savePaymentMutation.isPending ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator color="#fff" />
                <Text className="font-semibold text-white">
                  {isEditing ? "Updating..." : "Saving..."}
                </Text>
              </View>
            ) : (
              <Text className="font-semibold text-white">
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
            className="flex-row items-center justify-center gap-2 rounded-[12px] bg-rose-600 py-3"
          >
            {deleteExpenseMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={16} color="#fff" />
                <Text className="font-semibold text-white">Delete expense</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
