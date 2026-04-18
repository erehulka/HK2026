import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
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
import { CURRENT_USER, CURRENT_USER_BACKEND_ID } from "@/constants/mock-user";
import {
  countRemainingDraftReceiptItems,
  markDraftReceiptItemsAsAdded,
} from "@/constants/mock-receipts";

type Member = {
  id: string;
  name: string;
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
    returnToGroupIfReceiptDone,
  } = useLocalSearchParams<{
    id: string;
    paymentId?: string;
    prefillName?: string;
    prefillAmount?: string;
    sourceReceiptId?: string;
    sourceReceiptItemIds?: string;
    returnToGroupIfReceiptDone?: string;
  }>();
  const queryClient = useQueryClient();

  const membersQuery = useQuery({
    queryKey: ["groups", groupId, "members"],
    queryFn: () => backendClient.listGroupUsersGroupsGroupIdUsersGet(groupId),
    select: (response) =>
      response.data.map((user): Member => ({
        id: user.id,
        name: user.display_name,
      })),
    enabled: !!groupId,
  });
  const existingExpenseQuery = useQuery({
    queryKey: ["groups", groupId, "expenses", paymentId],
    queryFn: () =>
      backendClient.getExpenseGroupsGroupIdExpensesExpenseIdGet(groupId, paymentId!),
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

  const trimmedName = name.trim();
  const numericAmount = parseFloat(amount.replace(",", "."));
  const amountCents = Math.round(numericAmount * 100);
  const canSave =
    trimmedName.length > 0 &&
    !isNaN(numericAmount) &&
    numericAmount > 0 &&
    owesIds.length > 0 &&
    !membersQuery.isPending &&
    (!isEditing || !existingExpenseQuery.isPending);

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
    setAmount((expense.total_amount / 100).toFixed(2));
    setPaidById(expense.paid_by);
    setOwesIds(expense.participants);
  }, [isEditing, existingExpenseQuery.data]);

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
        return;
      }
      await backendClient.createExpenseFromFrontendGroupsGroupIdExpensesFrontendPost(groupId, {
        description: trimmedName,
        paidBy: paidById,
        participantUserIds: owesIds,
        splitType: ExpenseSplitType.Equal,
        items: [
          {
            description: trimmedName,
            amount: amountCents,
          },
        ],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", groupId] });
      queryClient.invalidateQueries({ queryKey: ["groups", groupId, "debts"] });
      queryClient.invalidateQueries({ queryKey: ["users", CURRENT_USER_BACKEND_ID, "groups"] });
      if (paymentId) {
        queryClient.invalidateQueries({ queryKey: ["groups", groupId, "expenses", paymentId] });
      }
      if (sourceReceiptId && sourceItemIds.length > 0) {
        markDraftReceiptItemsAsAdded(groupId, sourceReceiptId, sourceItemIds);
        if (returnToGroupIfReceiptDone === "1") {
          const remaining = countRemainingDraftReceiptItems(groupId, sourceReceiptId);
          if (remaining === 0) {
            router.replace(`/group/${groupId}`);
            return;
          }
        }
      }
      router.back();
    },
  });

  const handleSave = () => {
    if (!canSave || savePaymentMutation.isPending) return;
    savePaymentMutation.mutate();
  };

  return (
    <SafeAreaView className="flex-1 bg-app-bg">
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
                editable={!savePaymentMutation.isPending && !isEditing}
                className="bg-app-input border border-app-input-border rounded-[10px] px-3 py-[10px] text-app-text text-right"
              />
            </View>
          </View>
          {isEditing ? (
            <Text className="text-[12px] text-app-muted">
              Amount changes are not supported by this endpoint yet.
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

        <View className="bg-app-surface border border-app-border rounded-xl p-[14px] gap-[10px]">
          <Text className="text-base font-semibold text-app-text">Split method</Text>
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
            onPress={() => router.back()}
            disabled={savePaymentMutation.isPending}
            className="flex-1 rounded-[10px] py-3 items-center bg-app-cancel"
          >
            <Text className="text-app-text font-semibold">Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={!canSave || savePaymentMutation.isPending}
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
      </ScrollView>
    </SafeAreaView>
  );
}
