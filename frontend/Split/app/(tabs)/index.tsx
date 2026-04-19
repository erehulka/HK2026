import { Ionicons } from "@expo/vector-icons";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GroupOut, SimplifiedGroupDebtsOut } from "@/api/generated/api";
import { backendClient } from "@/api/generated/client";
import { CURRENT_USER_BACKEND_ID } from "@/constants/mock-user";
import { AxiosResponse } from "axios";

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

export default function HomeScreen() {
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
  const previewGroups = groups?.slice(0, 2) ?? [];
  const previewBalanceQueries = useQueries({
    queries: previewGroups.map((group) => ({
      queryKey: groupDebtsQueryKey(group.id),
      queryFn: () =>
        backendClient.getSimplifiedGroupDebtsGroupsGroupIdDebtsSimplifiedGet(
          group.id
        ),
      select: (response: AxiosResponse<SimplifiedGroupDebtsOut>) => response.data,
      enabled: !!group.id,
    })),
  });

  const accountName = "Moj bezny ucet";
  const accountIban = "SK86 1100 0000 0026 1100 0000";
  const accountBalance = 2154.43;

  const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formatBalance = (value: number) =>
    currencyFormatter.format(Math.abs(value));

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("sk-SK", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  const openGroupsHome = () => {
    router.push("/groups" as never);
  };

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  return (
    <SafeAreaView className="flex-1 bg-[#0f1115]">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 py-4 gap-5 pb-8"
        showsVerticalScrollIndicator={false}
      >
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Pressable className="h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
              <View className="items-center justify-center">
                <Ionicons name="mail-outline" size={19} color="#38bdf8" />
                <View className="absolute -right-2 -top-2 h-5 min-w-5 items-center justify-center rounded-full bg-[#2b6fff] px-1">
                  <Text className="text-[10px] font-bold text-white">78</Text>
                </View>
              </View>
            </Pressable>

            <View className="h-12 w-16 items-center justify-center ml-8">
              <Image
                source={require("../../assets/images/logo.png")}
                style={{ width: 52, height: 52 }}
                contentFit="contain"
              />
            </View>

            <Pressable
              onPress={() => router.push("/create-group")}
              className="rounded-full border border-sky-400/40 bg-sky-500/10 px-4 py-2"
            >
              <Text className="text-sm font-semibold text-sky-400">
                Upraviť
              </Text>
            </Pressable>
          </View>

          <Text className="text-2xl font-bold text-white">Účty</Text>

          <View className="rounded-[18px] border border-white/8 bg-[#1a1d24] p-4">
            <View className="rounded-[14px] border border-white/5 bg-[#2a3038] p-4">
              <Text className="text-base font-semibold text-white">
                {accountName}
              </Text>
              <Text className="mt-1 text-sm text-white/45">{accountIban}</Text>

              <View className="my-4 h-px bg-white/5" />

              <Text className="text-xs uppercase tracking-[0.18em] text-white/40">
                Aktuálny zostatok
              </Text>
              <View className="mt-2 flex-row items-end gap-2">
                <Text className="text-3xl font-bold text-white">
                  {formatMoney(accountBalance).replace("€", "")}
                </Text>
                <Text className="pb-1 text-sm font-semibold text-white/85">
                  EUR
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View className="gap-4 rounded-[22px] border border-white/8 bg-[#171a20] p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-white">Groups</Text>
            <Pressable onPress={openGroupsHome}>
              <Text className="text-sm text-sky-400">Show all</Text>
            </Pressable>
          </View>

          <View className="flex-row gap-3">
            {!isPending &&
              !isError &&
              previewGroups.map((group, index) => {
                const balanceQuery = previewBalanceQueries[index];
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
                    className="flex-1 rounded-[14px] border border-white/5 bg-[#2a3038] p-4"
                  >
                    <Text className="text-base font-semibold text-white">
                      {group.name}
                    </Text>
                    {balanceQuery?.isPending ? (
                      <Text className="mt-4 text-base text-white/45">
                        Loading balance...
                      </Text>
                    ) : (
                      <Text className={`mt-4 text-2xl font-bold ${balanceColor}`}>
                        {balanceEur === null ? "—" : `${balanceSign}${formatBalance(balanceEur)}`}
                      </Text>
                    )}
                    <Text className="mt-1 text-xs text-white/45">
                      {group.description || "Group"}
                    </Text>
                  </Pressable>
                );
              })}
          </View>
        </View>

        <View className="gap-4 rounded-[22px] border border-white/8 bg-[#171a20] p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-white">Spending plan</Text>
            <Text className="text-sm text-sky-400">See detail</Text>
          </View>
          <View className="rounded-[14px] border border-white/5 bg-[#2a3038] p-4">
            <Text className="text-sm text-white/45">Current plan overview</Text>
            <Text className="mt-3 text-3xl font-bold text-emerald-400">
              + {formatBalance(1312.44)}
            </Text>
            <Text className="mt-2 text-sm text-white/55">
              Estimated balance remaining until the end of the period (13 days
              remaining)
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
