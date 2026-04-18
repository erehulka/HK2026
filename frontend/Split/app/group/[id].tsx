import { useLocalSearchParams } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getGroupById } from "@/constants/mock-groups";
import { getPaymentsForGroup } from "@/constants/mock-payments";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = getGroupById(id);
  const payments = getPaymentsForGroup(id);

  if (!group) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg">
        <View className="flex-1 px-5 py-4 gap-5">
          <Text className="text-3xl font-bold text-app-text">
            Group not found
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const balanceColor =
    group.balance > 0
      ? "text-app-success"
      : group.balance < 0
      ? "text-app-danger"
      : "text-app-text";

  return (
    <SafeAreaView className="flex-1 bg-app-bg">
      <ScrollView contentContainerClassName="px-5 pt-16 pb-6 gap-5">
        <Text className="text-[28px] font-bold text-app-text">
          {group.name}
        </Text>

        <View className="bg-app-surface border border-app-border rounded-xl p-4 gap-[6px]">
          <Text className="text-[13px] text-app-muted">Your balance</Text>
          <Text className={`text-[28px] font-bold ${balanceColor}`}>
            {group.balance > 0 ? "+" : ""}
            {group.balance.toFixed(2)}
          </Text>
        </View>

        <View className="flex-row gap-3">
          <Pressable className="flex-1 rounded-[10px] py-3 items-center bg-app-cancel">
            <Text className="text-app-text font-semibold">Settings</Text>
          </Pressable>
          <Pressable className="flex-1 rounded-[10px] py-3 items-center bg-app-primary">
            <Text className="text-app-text font-semibold">Group Card</Text>
          </Pressable>
        </View>

        <View className="bg-app-surface border border-app-border rounded-xl p-[14px] gap-[10px]">
          <Text className="text-lg font-semibold text-app-text">Payments</Text>
          {payments.length === 0 ? (
            <Text className="italic text-app-muted">No payments yet.</Text>
          ) : (
            payments.map((payment) => (
              <View
                key={payment.id}
                className="flex-row items-center justify-between bg-app-card border border-app-border-soft rounded-[10px] py-[10px] px-3"
              >
                <View className="flex-1">
                  <Text className="text-[15px] font-semibold text-app-text">
                    {payment.name}
                  </Text>
                  <Text className="text-xs text-app-muted mt-[2px]">
                    {payment.date} · {payment.paidBy}
                  </Text>
                </View>
                <Text className="text-base font-bold text-app-text">
                  {payment.amount.toFixed(2)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
