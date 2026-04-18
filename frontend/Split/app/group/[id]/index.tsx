import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MOCK_FRIENDS } from "@/constants/mock-friends";
import { getGroupById, getGroupMembers } from "@/constants/mock-groups";
import {
  computeUserBalanceEffect,
  getPaymentsForGroup,
  Payment,
} from "@/constants/mock-payments";
import { CURRENT_USER } from "@/constants/mock-user";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = getGroupById(id);
  const [payments, setPayments] = useState<Payment[]>(() =>
    getPaymentsForGroup(id)
  );
  const fallbackMemberIds = useMemo(
    () => [CURRENT_USER.id, ...MOCK_FRIENDS.map((f) => f.id)],
    []
  );

  useFocusEffect(
    useCallback(() => {
      setPayments([...getPaymentsForGroup(id)]);
    }, [id])
  );

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
        <View className="flex-row items-center justify-between">
          <Text className="text-[28px] font-bold text-app-text flex-1 pr-3">
            {group.name}
          </Text>
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => router.push(`/group/${id}/members`)}
              className="h-10 px-3 rounded-full bg-app-surface border border-app-border items-center justify-center"
            >
              <Text className="text-app-text font-semibold text-[13px]">
                {getGroupMembers(id).length} users
              </Text>
            </Pressable>
            <Pressable className="w-10 h-10 rounded-full bg-app-surface border border-app-border items-center justify-center">
              <Ionicons name="settings-outline" size={20} color="#d7e6ff" />
            </Pressable>
          </View>
        </View>

        <View className="flex-row gap-3 items-stretch">
          <View className="flex-1 bg-app-surface border border-app-border rounded-xl p-4 gap-[6px]">
            <Text className="text-[13px] text-app-muted">Your balance</Text>
            <Text className={`text-[28px] font-bold ${balanceColor}`}>
              {group.balance > 0 ? "+" : ""}
              {group.balance.toFixed(2)}
            </Text>
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
          <Text className="text-lg font-semibold text-app-text">Payments</Text>
          {payments.length === 0 ? (
            <Text className="italic text-app-muted">No payments yet.</Text>
          ) : (
            payments.map((payment) => {
              const effect = computeUserBalanceEffect(
                payment,
                CURRENT_USER.id,
                CURRENT_USER.name,
                fallbackMemberIds
              );
              const effectColor =
                effect > 0
                  ? "text-app-success"
                  : effect < 0
                  ? "text-app-danger"
                  : "text-app-muted";
              const sign = effect > 0 ? "+" : effect < 0 ? "-" : "";
              return (
                <Pressable
                  key={payment.id}
                  onPress={() =>
                    router.push(
                      `/group/${id}/add-payment?paymentId=${payment.id}`
                    )
                  }
                  className="flex-row items-center justify-between bg-app-card border border-app-border-soft rounded-[10px] py-[10px] px-3"
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-[15px] font-semibold text-app-text">
                      {payment.name}
                    </Text>
                    <Text className="text-xs text-app-muted mt-[2px]">
                      {payment.paidBy} paid {payment.amount.toFixed(2)}
                    </Text>
                  </View>
                  <Text className={`text-base font-bold ${effectColor}`}>
                    {sign}
                    {Math.abs(effect).toFixed(2)}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
