import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Group, MOCK_GROUPS } from "@/constants/mock-groups";

export default function GroupsScreen() {
  const [groups, setGroups] = useState<Group[]>(MOCK_GROUPS);

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
      setGroups([...MOCK_GROUPS]);
    }, [])
  );

  return (
    <SafeAreaView className="flex-1 bg-[#0f1115]">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pt-10 pb-8 gap-5"
        showsVerticalScrollIndicator={false}
      >
        <View className="mt-2 flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-white">Groups</Text>

          <View className="h-10 w-10" />
        </View>

        <Pressable
          onPress={() => router.push("/create-group")}
          className="mt-2 rounded-[18px] border border-sky-400/30 bg-sky-500/10 px-4 py-3"
        >
          <Text className="text-center text-sm font-semibold text-sky-400">
            Create Group
          </Text>
        </Pressable>

        <View className="gap-4 rounded-[22px] border border-white/8 bg-[#171a20] p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-white">All groups</Text>
            <Text className="text-sm text-sky-400">{groups.length} total</Text>
          </View>

          {groups.map((group) => (
            <Pressable
              key={group.id}
              onPress={() => router.push(`/group/${group.id}`)}
              className="rounded-[18px] border border-white/8 bg-[#232831] p-4"
            >
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1 gap-1">
                  <Text className="text-base font-semibold text-white">
                    {group.name}
                  </Text>
                  <Text className="text-xs text-white/45 capitalize">
                    {group.type}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-xl font-bold text-white">
                    {group.balance >= 0 ? "+" : "-"} {formatBalance(group.balance)}
                  </Text>
                  <Text className="mt-1 text-xs text-white/45">Balance</Text>
                </View>
              </View>

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
      </ScrollView>
    </SafeAreaView>
  );
}
