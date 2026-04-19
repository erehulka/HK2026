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
        <View className="mt-9 flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-white">Groups</Text>

          <View className="h-10 w-10" />
        </View>

        <View className="gap-4 rounded-[22px] border border-white/8 bg-[#171a20] p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-white">All groups</Text>
            <Text className="text-sm text-sky-400">{groups.length} total</Text>
          </View>

          {groups.map((group) => (
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
                  <Text className="text-xs text-white/45 capitalize">
                    {group.type}
                  </Text>
                </View>
                <View className="items-end">
                  <Text
                    className={`text-xl font-bold ${
                      group.balance > 0
                        ? "text-emerald-400"
                        : group.balance < 0
                        ? "text-rose-400"
                        : "text-white"
                    }`}
                  >
                    {group.balance < 0 ? "-" : ""} {formatBalance(group.balance)}
                  </Text>
                  <Text className="mt-1 text-xs text-white/45">Balance</Text>
                </View>
              </View>
            </Pressable>
          ))}
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
