import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Group, MOCK_GROUPS } from "@/constants/mock-groups";

export default function HomeScreen() {
  const [groups, setGroups] = useState<Group[]>(MOCK_GROUPS);
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
      setGroups([...MOCK_GROUPS]);
    }, [])
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
              <Text className="text-sm font-semibold text-sky-400">Upraviť</Text>
            </Pressable>
          </View>

          <Text className="text-2xl font-bold text-white">Účty</Text>

          <View className="rounded-[18px] border border-white/8 bg-[#1a1d24] p-4">
            <View className="rounded-[14px] border border-white/5 bg-[#2a3038] p-4">
              <Text className="text-base font-semibold text-white">{accountName}</Text>
              <Text className="mt-1 text-sm text-white/45">{accountIban}</Text>

              <View className="my-4 h-px bg-white/5" />

              <Text className="text-xs uppercase tracking-[0.18em] text-white/40">
                Aktuálny zostatok
              </Text>
              <View className="mt-2 flex-row items-end gap-2">
                <Text className="text-3xl font-bold text-white">
                  {formatMoney(accountBalance).replace("€", "")}
                </Text>
                <Text className="pb-1 text-sm font-semibold text-white/85">EUR</Text>
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
            {groups.slice(0, 2).map((group) => (
              <Pressable
                key={group.id}
                onPress={() => router.push(`/group/${group.id}`)}
                className="flex-1 rounded-[18px] border border-white/8 bg-[#232831] p-4"
              >
                <Text className="text-base font-semibold text-white">{group.name}</Text>
                <Text className="mt-4 text-2xl font-bold text-white">
                  {group.balance >= 0 ? "+" : "-"} {formatBalance(group.balance)}
                </Text>
                <Text className="mt-1 text-xs text-white/45 capitalize">
                  {group.type}
                </Text>
                <View className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/8">
                  <View
                    className={`h-full rounded-full ${
                      group.balance > 0
                        ? "bg-emerald-400"
                        : group.balance < 0
                        ? "bg-rose-400"
                        : "bg-sky-400"
                    }`}
                    style={{ width: `${Math.min(100, Math.abs(group.balance) / 2)}%` }}
                  />
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="gap-4 rounded-[22px] border border-white/8 bg-[#171a20] p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-white">Spending plan</Text>
            <Text className="text-sm text-sky-400">Zobraziť detail</Text>
          </View>
          <View className="rounded-[18px] border border-white/8 bg-[#232831] p-4">
            <Text className="text-sm text-white/45">Current plan overview</Text>
            <Text className="mt-3 text-3xl font-bold text-emerald-400">
              + {formatBalance(2127.44)}
            </Text>
            <Text className="mt-2 text-sm text-white/55">
              Odhad zostatku do konca obdobia (zostáva 13 dní)
            </Text>
          </View>
        </View>

        <View className="gap-4 rounded-[22px] border border-white/8 bg-[#171a20] p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-white">Spending Plan</Text>
          </View>

          {groups.length === 0 ? (
            <Text className="italic text-white/50">
              No groups exist at the moment.
            </Text>
          ) : (
            groups.map((group) => (
              <Pressable
                key={group.id}
                onPress={() => router.push(`/group/${group.id}`)}
                className="flex-row items-center justify-between rounded-[18px] border border-white/8 bg-[#232831] px-4 py-3"
              >
                <View className="gap-1">
                  <Text className="text-base font-semibold text-white">{group.name}</Text>
                  <Text className="text-xs text-white/45 capitalize">{group.type}</Text>
                </View>
                <View className="items-end gap-1">
                  <Text className="text-base font-semibold text-white">
                    {group.balance >= 0 ? "+" : "-"} {formatBalance(group.balance)}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
