import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
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

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [selectedDebtRow, setSelectedDebtRow] = useState<{
    key: string;
    leftName: string;
    rightName: string;
    amountEur: number;
    amountCents: number;
    arrow: "→";
    debtorId: string;
    creditorId: string;
    debtorName: string;
    creditorName: string;
  } | null>(null);
  const [reminderSent, setReminderSent] = useState(false);

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

  const settleDebtMutation = useMutation({
    mutationFn: async (row: NonNullable<typeof selectedDebtRow>) => {
      if (!id) return;
      await backendClient.createExpenseFromFrontendGroupsGroupIdExpensesFrontendPost(
        id,
        {
          description: `Settle ${row.debtorName} -> ${row.creditorName}`,
          paidBy: row.debtorId,
          participantUserIds: [row.creditorId],
          splitType: "Equal",
          items: [
            {
              description: `Settlement ${row.debtorName} -> ${row.creditorName}`,
              amount: row.amountCents,
            },
          ],
        }
      );
    },
    onSuccess: () => {
      if (!id) return;
      queryClient.invalidateQueries({ queryKey: ["groups", id] });
      queryClient.invalidateQueries({ queryKey: ["groups", id, "debts"] });
      queryClient.invalidateQueries({ queryKey: ["users", CURRENT_USER_BACKEND_ID, "groups"] });
      setSelectedDebtRow(null);
    },
  });

  if (groupQuery.isPending) {
    return (
      <SafeAreaView className="flex-1 bg-[#0f1115]">
        <View className="flex-1 items-center justify-center gap-2">
          <ActivityIndicator color="#38bdf8" />
          <Text className="text-white/55">Loading group...</Text>
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
      <SafeAreaView className="flex-1 bg-[#0f1115]">
        <View className="flex-1 px-5 py-4 gap-3">
          <Text className="text-3xl font-bold text-white">Group not found</Text>
          <Text className="text-white/55">{message}</Text>
          <Pressable
            onPress={() => groupQuery.refetch()}
            className="rounded-[12px] border border-white/10 bg-[#232831] py-[10px] px-3 self-start"
          >
            <Text className="text-white font-semibold">Retry</Text>
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

  const debtRows = (() => {
    if (!debtsQuery.data) return [] as {
      key: string;
      leftName: string;
      rightName: string;
      amountEur: number;
      amountCents: number;
      arrow: "→";
      debtorId: string;
      creditorId: string;
      debtorName: string;
      creditorName: string;
    }[];

    const rows: {
      key: string;
      leftName: string;
      rightName: string;
      amountEur: number;
      amountCents: number;
      arrow: "→";
      debtorId: string;
      creditorId: string;
      debtorName: string;
      creditorName: string;
    }[] = [];

    const { member_ids: memberIds, matrix } = debtsQuery.data;
    for (let i = 0; i < memberIds.length; i += 1) {
      for (let j = i + 1; j < memberIds.length; j += 1) {
        const iOwesJCents = matrix[i]?.[j] ?? 0;
        const jOwesICents = matrix[j]?.[i] ?? 0;
        const netCents = iOwesJCents - jOwesICents;
        if (netCents === 0) continue;

        const debtorId = netCents > 0 ? memberIds[i] : memberIds[j];
        const creditorId = netCents > 0 ? memberIds[j] : memberIds[i];
        const debtorName = memberNameById.get(debtorId) ?? debtorId;
        const creditorName = memberNameById.get(creditorId) ?? creditorId;
        const amountEur = Math.abs(netCents) / 100;

        rows.push({
          key: `${debtorId}->${creditorId}`,
          leftName: debtorName,
          rightName: creditorName,
          amountEur,
          amountCents: Math.abs(netCents),
          arrow: "→",
          debtorId,
          creditorId,
          debtorName,
          creditorName,
        });
      }
    }

    return rows.sort((a, b) => b.amountEur - a.amountEur);
  })();

  const userBalanceEur = debtsQuery.data
    ? computeUserNetBalanceEur(debtsQuery.data, CURRENT_USER_BACKEND_ID)
    : null;
  const balanceColor =
    userBalanceEur === null || userBalanceEur === 0
      ? "text-white"
      : userBalanceEur > 0
      ? "text-emerald-400"
      : "text-rose-400";
  const balanceSign = userBalanceEur && userBalanceEur > 0 ? "+" : "";

  return (
    <SafeAreaView className="flex-1 bg-[#0f1115]">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-4 pb-8 gap-5"
        showsVerticalScrollIndicator={false}
      >
        <View className="mt-2 flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-start justify-center"
          >
            <Ionicons name="chevron-back" size={26} color="#2b6fff" />
          </Pressable>
          <View className="h-10 w-10" />
        </View>

        <View className="gap-1">
          <Text className="text-4xl font-bold text-white">{group.name}</Text>
          {group.description ? (
            <Text className="text-sm text-white/45">{group.description}</Text>
          ) : null}
        </View>

        <View className="gap-4 rounded-[22px] border border-white/8 bg-[#171a20] p-4">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-lg font-bold text-white">Overview</Text>
            <Pressable
              onPress={() => router.push(`/group/${id}/members`)}
              className="rounded-full border border-white/10 bg-[#2a3038] px-4 py-2"
            >
              {membersQuery.isPending ? (
                <ActivityIndicator color="#cbd5e1" />
              ) : (
                <Text className="text-sm font-semibold text-white/75">
                  {memberCount} {memberCount === 1 ? "user" : "users"}
                </Text>
              )}
            </Pressable>
          </View>
          <View className="rounded-[14px] border border-white/5 bg-[#2a3038] p-4 gap-1">
            <Text className="text-[12px] uppercase tracking-[0.13em] text-white/45">
              Your balance
            </Text>
            {debtsQuery.isPending ? (
              <ActivityIndicator color="#38bdf8" />
            ) : debtsQuery.isError ? (
              <Text className="text-[13px] text-rose-400">Couldn’t load balance</Text>
            ) : userBalanceEur === null ? (
              <Text className="text-[34px] font-bold text-white">—</Text>
            ) : (
              <Text className={`text-[34px] font-bold ${balanceColor}`}>
                {balanceSign}
                {formatMoney(userBalanceEur)}
              </Text>
            )}
            <Text className="text-xs text-white/45">Across this group</Text>
          </View>
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => router.push(`/group/${id}/add-payment`)}
              className="flex-1 rounded-[12px] py-4 items-center bg-[#2b6fff]"
            >
              <Text className="text-white font-semibold">Quick expense</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(`/group/${id}/add-receipt`)}
              className="flex-1 rounded-[12px] py-3 items-center bg-[#303743] border border-sky-400/25"
            >
              <View className="flex-row items-center gap-2">
                <Ionicons name="camera-outline" size={18} color="#7dd3fc" />
                <Text className="font-semibold text-sky-100">Scan receipt</Text>
              </View>
            </Pressable>
          </View>
        </View>

        <View className="gap-4 rounded-[22px] border border-white/8 bg-[#171a20] p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-white">Debts</Text>
            {!debtsQuery.isPending && !debtsQuery.isError ? (
              <Text className="text-sm text-sky-400">{debtRows.length} total</Text>
            ) : null}
          </View>

          {debtsQuery.isPending ? (
            <View className="flex-row items-center gap-2 py-1">
              <ActivityIndicator color="#38bdf8" />
              <Text className="text-white/55">Loading debts...</Text>
            </View>
          ) : debtsQuery.isError ? (
            <Text className="text-sm text-rose-400">Couldn’t load debts</Text>
          ) : debtRows.length === 0 ? (
            <Text className="italic text-white/45">No debts between members.</Text>
          ) : (
            debtRows.map((row) => (
              <Pressable
                key={row.key}
                onPress={() => {
                  setReminderSent(false);
                  setSelectedDebtRow(row);
                }}
                className="rounded-[14px] border border-white/5 bg-[#2a3038] px-4 py-3"
              >
                <View className="flex-row items-center justify-between gap-3">
                  <Text className="flex-1 text-[15px] font-semibold text-white" numberOfLines={1}>
                    {row.leftName}
                  </Text>
                  <View className="items-center px-1">
                    <Text className="text-[12px] font-semibold text-sky-300">
                      {formatMoney(row.amountEur)}
                    </Text>
                    <Text className="text-[14px] font-bold text-white/85">{row.arrow}</Text>
                  </View>
                  <Text className="flex-1 text-right text-[15px] font-semibold text-white" numberOfLines={1}>
                    {row.rightName}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
        </View>

        <View className="gap-4 rounded-[22px] border border-white/8 bg-[#171a20] p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-white">Expenses</Text>
            <Text className="text-sm text-sky-400">{expenses.length} total</Text>
          </View>
          {expenses.length === 0 ? (
            <Text className="italic text-white/45">No expenses yet.</Text>
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
                  ? "text-emerald-400"
                  : userEffectEur < 0
                  ? "text-rose-400"
                  : "text-white/50";
              const userEffectSign = userEffectEur > 0 ? "+" : "";

              return (
                <Pressable
                  key={expense.id}
                  onPress={() =>
                    router.push(
                      `/group/${id}/add-payment?paymentId=${expense.id}`
                    )
                  }
                  className="flex-row items-center justify-between rounded-[14px] border border-white/5 bg-[#2a3038] px-4 py-3"
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-[16px] font-semibold text-white">
                      {expense.description}
                    </Text>
                    <Text className="mt-1 text-xs text-white/45">
                      {payerName} paid {formatMoney(totalEur)}
                    </Text>
                    <Text className="mt-[2px] text-[11px] text-white/40">
                      {formatExpenseDate(expense.created_at)}
                    </Text>
                  </View>
                  {isInvolved ? (
                    <Text className={`text-base font-bold ${userEffectColor}`}>
                      {userEffectSign}
                      {formatMoney(userEffectEur)}
                    </Text>
                  ) : (
                    <Text className="text-xs text-white/45">Not involved</Text>
                  )}
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal
        transparent
        animationType="fade"
        visible={selectedDebtRow !== null}
        onRequestClose={() => setSelectedDebtRow(null)}
      >
        <View className="flex-1 items-center justify-center bg-black/65 px-6">
          {selectedDebtRow ? (
            <View className="w-full max-w-[360px] rounded-[20px] border border-white/10 bg-[#171a20] p-5">
              {CURRENT_USER_BACKEND_ID === selectedDebtRow.creditorId ? (
                <>
                  <Text className="text-xl font-bold text-white text-center">
                    {selectedDebtRow.debtorName}
                  </Text>
                  <Text className="mt-2 text-center text-white/65">owes you</Text>
                  <Text className="mt-2 text-center text-3xl font-bold text-emerald-400">
                    {formatMoney(selectedDebtRow.amountEur)}
                  </Text>

                  <View className="mt-5 flex-row gap-3">
                    <Pressable
                      onPress={() => setSelectedDebtRow(null)}
                      className="flex-1 rounded-[12px] border border-white/10 bg-[#232831] py-3 items-center"
                    >
                      <Text className="text-white font-semibold">Close</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setReminderSent(true);
                        setTimeout(() => {
                          setSelectedDebtRow(null);
                          setReminderSent(false);
                        }, 650);
                      }}
                      className={`flex-1 rounded-[12px] py-3 items-center ${
                        reminderSent ? "bg-gray-500" : "bg-[#2b6fff]"
                      }`}
                    >
                      <Text className="text-white font-semibold">
                        {reminderSent ? "Reminder sent" : "Remind"}
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : CURRENT_USER_BACKEND_ID === selectedDebtRow.debtorId ? (
                <>
                  <Text className="text-xl font-bold text-white text-center">
                    You owe {selectedDebtRow.creditorName}
                  </Text>
                  <Text className="mt-2 text-center text-3xl font-bold text-rose-400">
                    {formatMoney(selectedDebtRow.amountEur)}
                  </Text>

                  <View className="mt-5 flex-row gap-3">
                    <Pressable
                      onPress={() => setSelectedDebtRow(null)}
                      className="flex-1 rounded-[12px] border border-white/10 bg-[#232831] py-3 items-center"
                    >
                      <Text className="text-white font-semibold">Close</Text>
                    </Pressable>
                    <Pressable
                      disabled={settleDebtMutation.isPending}
                      onPress={() => settleDebtMutation.mutate(selectedDebtRow)}
                      className={`flex-1 rounded-[12px] py-3 items-center ${
                        settleDebtMutation.isPending ? "bg-[#2b6fff]/50" : "bg-[#2b6fff]"
                      }`}
                    >
                      {settleDebtMutation.isPending ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text className="text-white font-semibold">Settle</Text>
                      )}
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text className="text-xl font-bold text-white text-center">
                    Debt details
                  </Text>
                  <Text className="mt-2 text-center text-white/65">
                    {selectedDebtRow.debtorName} owes {selectedDebtRow.creditorName}
                  </Text>
                  <Text className="mt-2 text-center text-2xl font-bold text-sky-300">
                    {formatMoney(selectedDebtRow.amountEur)}
                  </Text>
                  <Pressable
                    onPress={() => setSelectedDebtRow(null)}
                    className="mt-5 rounded-[12px] border border-white/10 bg-[#232831] py-3 items-center"
                  >
                    <Text className="text-white font-semibold">Close</Text>
                  </Pressable>
                </>
              )}
            </View>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
