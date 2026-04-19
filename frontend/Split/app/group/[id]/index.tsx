import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { SimplifiedGroupDebtsOut } from "@/api/generated/api";
import { backendClient } from "@/api/generated/client";
import { CURRENT_USER_BACKEND_ID } from "@/constants/mock-user";

const groupQueryKey = (groupId: string) => ["groups", groupId] as const;
const groupMembersQueryKey = (groupId: string) =>
  ["groups", groupId, "members"] as const;
const groupDebtsQueryKey = (groupId: string) =>
  ["groups", groupId, "debts", "simplified"] as const;

/**
 * Returns the signed net balance in EUR for `userId` in this group.
 * Positive = group members owe the user; negative = the user owes the group.
 * Returns null if the user is not part of the matrix (and so has no balance).
 */
function computeUserNetBalanceEur(
  debts: SimplifiedGroupDebtsOut,
  userId: string
): number | null {
  const idx = debts.member_ids.indexOf(userId);
  if (idx === -1) return null;

  let owedByUserCents = 0;
  let owedToUserCents = 0;
  for (let j = 0; j < debts.member_ids.length; j += 1) {
    owedByUserCents += debts.matrix[idx]?.[j] ?? 0;
    owedToUserCents += debts.matrix[j]?.[idx] ?? 0;
  }
  return (owedToUserCents - owedByUserCents) / 100;
}

function formatExpenseDate(isoDate: string) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const groupQuery = useQuery({
    queryKey: groupQueryKey(id),
    queryFn: () => backendClient.getGroupGroupsGroupIdGet(id),
    select: (response) => response.data,
    enabled: !!id,
  });

  const membersQuery = useQuery({
    queryKey: groupMembersQueryKey(id),
    queryFn: () => backendClient.listGroupUsersGroupsGroupIdUsersGet(id),
    select: (response) => response.data,
    enabled: !!id,
  });

  const debtsQuery = useQuery({
    queryKey: groupDebtsQueryKey(id),
    queryFn: () =>
      backendClient.getSimplifiedGroupDebtsGroupsGroupIdDebtsSimplifiedGet(id),
    select: (response) => response.data,
    enabled: !!id,
  });

  useFocusEffect(
    useCallback(() => {
      groupQuery.refetch();
      membersQuery.refetch();
      debtsQuery.refetch();
    }, [groupQuery, membersQuery, debtsQuery])
  );

  if (groupQuery.isPending) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg">
        <View className="flex-1 items-center justify-center gap-2">
          <ActivityIndicator color="#d7e6ff" />
          <Text className="text-app-muted">Loading group…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (groupQuery.isError || !groupQuery.data) {
    const message =
      groupQuery.error instanceof Error
        ? groupQuery.error.message
        : "Group not found";
    return (
      <SafeAreaView className="flex-1 bg-app-bg">
        <View className="flex-1 px-5 py-4 gap-3">
          <Text className="text-3xl font-bold text-app-text">
            Group not found
          </Text>
          <Text className="text-app-muted">{message}</Text>
          <Pressable
            onPress={() => groupQuery.refetch()}
            className="bg-app-card border border-app-border-soft rounded-[10px] py-[10px] px-3 self-start"
          >
            <Text className="text-app-text font-semibold">Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const group = groupQuery.data;
  const expenses = [...(group.expenses ?? [])].sort((a, b) => {
    const aTime = new Date(a.created_at).getTime();
    const bTime = new Date(b.created_at).getTime();
    if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
      return b.created_at.localeCompare(a.created_at);
    }
    return bTime - aTime;
  });
  const memberCount = membersQuery.data?.length ?? 0;
  const memberNameById = new Map(
    (membersQuery.data ?? []).map((member) => [member.id, member.display_name])
  );

  const userBalanceEur = debtsQuery.data
    ? computeUserNetBalanceEur(debtsQuery.data, CURRENT_USER_BACKEND_ID)
    : null;
  const balanceColor =
    userBalanceEur === null || userBalanceEur === 0
      ? "text-app-text"
      : userBalanceEur > 0
      ? "text-app-success"
      : "text-app-danger";
  const balanceSign = userBalanceEur && userBalanceEur > 0 ? "+" : "";

  return (
    <SafeAreaView className="flex-1 bg-app-bg">
      <ScrollView contentContainerClassName="px-5 pt-16 pb-6 gap-5">
        <View className="flex-row items-center justify-between">
          <Text className="text-[28px] font-bold text-app-text flex-1 pr-3">
            {group.name}
          </Text>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => router.push(`/group/${id}/members`)}
              className="h-10 px-3 rounded-full bg-app-surface border border-app-border items-center justify-center"
            >
              {membersQuery.isPending ? (
                <ActivityIndicator color="#d7e6ff" />
              ) : (
                <Text className="text-app-text font-semibold text-[13px]">
                  {memberCount} {memberCount === 1 ? "user" : "users"}
                </Text>
              )}
            </Pressable>
            <Pressable className="w-10 h-10 rounded-full bg-app-surface border border-app-border items-center justify-center">
              <Ionicons name="settings-outline" size={20} color="#d7e6ff" />
            </Pressable>
          </View>
        </View>

        {group.description ? (
          <Text className="text-sm text-app-muted">{group.description}</Text>
        ) : null}

        <View className="flex-row gap-3 items-stretch">
          <View className="flex-1 bg-app-surface border border-app-border rounded-xl p-4 gap-[6px]">
            <Text className="text-[13px] text-app-muted">Your balance</Text>
            {debtsQuery.isPending ? (
              <ActivityIndicator color="#d7e6ff" />
            ) : debtsQuery.isError ? (
              <Text className="text-[13px] text-app-danger">
                Couldn’t load balance
              </Text>
            ) : userBalanceEur === null ? (
              <Text className="text-[28px] font-bold text-app-text">—</Text>
            ) : (
              <Text className={`text-[28px] font-bold ${balanceColor}`}>
                {balanceSign}
                {userBalanceEur.toFixed(2)} €
              </Text>
            )}
          </View>
          <Pressable className="w-[120px] rounded-xl p-4 items-center justify-center bg-app-primary">
            <Ionicons name="card-outline" size={22} color="#f4f7ff" />
            <Text className="text-app-text font-semibold mt-2">Group Card</Text>
          </Pressable>
        </View>

        <View className="flex-row gap-3">
          <Pressable
            onPress={() => router.push(`/group/${id}/add-payment`)}
            className="flex-1 rounded-[10px] py-3 items-center bg-app-primary"
          >
            <Text className="text-app-text font-semibold">Quick payment</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(`/group/${id}/add-receipt`)}
            className="flex-1 rounded-[10px] py-3 items-center bg-app-cancel"
          >
            <Text className="text-app-text font-semibold">Add a receipt</Text>
          </Pressable>
        </View>

        <View className="bg-app-surface border border-app-border rounded-xl p-[14px] gap-[10px]">
          <Text className="text-lg font-semibold text-app-text">Expenses</Text>
          {expenses.length === 0 ? (
            <Text className="italic text-app-muted">No expenses yet.</Text>
          ) : (
            expenses.map((expense) => {
              const payerName =
                memberNameById.get(expense.paid_by) ?? expense.paid_by;
              const totalEur = expense.total_amount / 100;
              const participantCount = Math.max(expense.participants.length, 1);
              const shareEur = totalEur / participantCount;
              const involvedAsPayer = expense.paid_by === CURRENT_USER_BACKEND_ID;
              const involvedAsParticipant = expense.participants.includes(
                CURRENT_USER_BACKEND_ID
              );
              const isInvolved = involvedAsPayer || involvedAsParticipant;

              let userEffectEur = 0;
              if (involvedAsPayer) userEffectEur += totalEur;
              if (involvedAsParticipant) userEffectEur -= shareEur;

              const userEffectColor =
                userEffectEur > 0
                  ? "text-app-success"
                  : userEffectEur < 0
                  ? "text-app-danger"
                  : "text-app-muted";
              const userEffectSign = userEffectEur > 0 ? "+" : "";

              return (
                <Pressable
                  key={expense.id}
                  onPress={() =>
                    router.push(
                      `/group/${id}/add-payment?paymentId=${expense.id}`
                    )
                  }
                  className="flex-row items-center justify-between bg-app-card border border-app-border-soft rounded-[10px] py-[10px] px-3"
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-[15px] font-semibold text-app-text">
                      {expense.description}
                    </Text>
                    <Text className="text-xs text-app-muted mt-[2px]">
                      {payerName} paid {totalEur.toFixed(2)}
                    </Text>
                    <Text className="text-[11px] text-app-muted mt-[2px]">
                      {formatExpenseDate(expense.created_at)}
                    </Text>
                  </View>
                  {isInvolved ? (
                    <Text className={`text-base font-bold ${userEffectColor}`}>
                      {userEffectSign}
                      {userEffectEur.toFixed(2)}
                    </Text>
                  ) : (
                    <Text className="text-xs text-app-muted">Not involved</Text>
                  )}
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
