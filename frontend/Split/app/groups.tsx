import { useQueries, useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AxiosResponse } from "axios";

import { GroupOut, SimplifiedGroupDebtsOut } from "@/api/generated/api";
import { backendClient } from "@/api/generated/client";
import { CURRENT_USER_BACKEND_ID } from "@/constants/mock-user";

const userGroupsQueryKey = (userId: string) =>
  ["users", userId, "groups"] as const;
const groupDebtsQueryKey = (groupId: string) =>
  ["groups", groupId, "debts", "simplified"] as const;

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

export default function GroupsScreen() {
  const {
    data: groups,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: userGroupsQueryKey(CURRENT_USER_BACKEND_ID),
    queryFn: () =>
      backendClient.listUserGroupsUsersUserIdGroupsGet(CURRENT_USER_BACKEND_ID),
    select: (response: AxiosResponse<GroupOut[]>) => response.data,
  });
  const groupBalanceQueries = useQueries({
    queries: (groups ?? []).map((group) => ({
      queryKey: groupDebtsQueryKey(group.id),
      queryFn: () =>
        backendClient.getSimplifiedGroupDebtsGroupsGroupIdDebtsSimplifiedGet(
          group.id
        ),
      select: (response: AxiosResponse<SimplifiedGroupDebtsOut>) => response.data,
      enabled: !!group.id,
    })),
  });

  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formatBalance = (value: number) =>
    currencyFormatter.format(Math.abs(value));

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  return (
    <SafeAreaView className="flex-1 bg-[#0f1115]">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-10 pb-8 gap-5"
        showsVerticalScrollIndicator={false}
      >
        <View className="mt-9 flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-white">Groups</Text>

          <View className="h-10 w-10" />
        </View>

        <View className="gap-4 rounded-[22px] border border-white/8 bg-[#171a20] p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-white">All groups</Text>
            <Text className="text-sm text-sky-400">{groups?.length ?? 0} total</Text>
          </View>

          {isPending ? (
            <View className="py-6 items-center gap-2">
              <ActivityIndicator color="#38bdf8" />
              <Text className="text-sm text-white/55">Loading groups...</Text>
            </View>
          ) : isError ? (
            <View className="py-4 gap-2">
              <Text className="text-sm text-rose-400">
                Could not load groups.
              </Text>
              <Pressable
                onPress={() => refetch()}
                className="self-start rounded-full border border-white/15 px-3 py-1.5"
              >
                <Text className="text-xs font-semibold text-white/85">Retry</Text>
              </Pressable>
            </View>
          ) : (
            (groups ?? []).map((group, index) => {
              const balanceQuery = groupBalanceQueries[index];
              const balanceEur = balanceQuery?.data
                ? computeUserNetBalanceEur(
                    balanceQuery.data,
                    CURRENT_USER_BACKEND_ID
                  )
                : null;
              const balanceColor =
                balanceEur === null || balanceEur === 0
                  ? "text-white"
                  : balanceEur > 0
                  ? "text-emerald-400"
                  : "text-rose-400";
              const balanceSign = balanceEur && balanceEur > 0 ? "+" : "";

              return (
                <Pressable
                  key={group.id}
                  onPress={() => router.push(`/group/${group.id}`)}
                  className="rounded-[18px] border border-white/5 bg-[#232831] p-4"
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1 gap-1">
                      <Text className="text-base font-semibold text-white">
                        {group.name}
                      </Text>
                      <Text className="text-xs text-white/45">
                        {group.description || "Group"}
                      </Text>
                    </View>
                    <View className="items-end">
                      {balanceQuery?.isPending ? (
                        <Text className="text-sm text-white/45">Loading...</Text>
                      ) : (
                        <Text className={`text-xl font-bold ${balanceColor}`}>
                          {balanceEur === null
                            ? "—"
                            : `${balanceSign}${formatBalance(balanceEur)}`}
                        </Text>
                      )}
                      <Text className="mt-1 text-xs text-white/45">Balance</Text>
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        <Pressable
          onPress={() => router.push("/create-group")}
          className="rounded-[18px] border border-white/10 bg-[#232831] px-4 py-4"
        >
          <Text className="text-center text-base font-semibold text-white">
            Create Group
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
