import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { SimplifiedGroupDebtsOut } from "@/api/generated/api";
import { backendClient } from "@/api/generated/client";
import { CURRENT_USER_BACKEND_ID } from "@/constants/mock-user";

function computeMemberNetBalancesCents(debts: SimplifiedGroupDebtsOut) {
  const byUserId = new Map<string, number>();

  for (let i = 0; i < debts.member_ids.length; i += 1) {
    let owedByUser = 0;
    let owedToUser = 0;
    for (let j = 0; j < debts.member_ids.length; j += 1) {
      owedByUser += debts.matrix[i]?.[j] ?? 0;
      owedToUser += debts.matrix[j]?.[i] ?? 0;
    }
    byUserId.set(debts.member_ids[i], owedToUser - owedByUser);
  }

  return byUserId;
}

function formatCents(cents: number) {
  const eur = Math.abs(cents) / 100;
  const sign = cents > 0 ? "+" : cents < 0 ? "-" : "";
  return `${sign}${eur.toFixed(2)} €`;
}

export default function GroupMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [isAddUsersModalOpen, setIsAddUsersModalOpen] = useState(false);

  const groupQuery = useQuery({
    queryKey: ["groups", id],
    queryFn: () => backendClient.getGroupGroupsGroupIdGet(id),
    select: (response) => response.data,
    enabled: !!id,
  });

  const membersQuery = useQuery({
    queryKey: ["groups", id, "members"],
    queryFn: () => backendClient.listGroupUsersGroupsGroupIdUsersGet(id),
    select: (response) => response.data,
    enabled: !!id,
  });

  const debtsQuery = useQuery({
    queryKey: ["groups", id, "debts", "simplified"],
    queryFn: () =>
      backendClient.getSimplifiedGroupDebtsGroupsGroupIdDebtsSimplifiedGet(id),
    select: (response) => response.data,
    enabled: !!id,
  });
  const friendsQuery = useQuery({
    queryKey: ["users", CURRENT_USER_BACKEND_ID, "friends"],
    queryFn: () =>
      backendClient.listUserFriendsUsersUserIdFriendsGet(CURRENT_USER_BACKEND_ID),
    select: (response) =>
      response.data.map((user) => ({
        id: user.id,
        name: user.display_name,
      })),
    enabled: false,
  });

  const leaveGroupMutation = useMutation({
    mutationFn: () =>
      backendClient.removeUserFromGroupGroupsGroupIdUsersUserIdDelete(
        id,
        CURRENT_USER_BACKEND_ID
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", CURRENT_USER_BACKEND_ID, "groups"] });
      queryClient.invalidateQueries({ queryKey: ["groups", id] });
      queryClient.invalidateQueries({ queryKey: ["groups", id, "members"] });
      queryClient.invalidateQueries({ queryKey: ["groups", id, "debts"] });
      router.replace("/");
    },
  });
  const addMembersMutation = useMutation({
    mutationFn: async (userId: string) => {
      await backendClient.addUserToGroupGroupsGroupIdUsersUserIdPost(id, userId);
    },
    onSuccess: () => {
      setIsAddUsersModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["groups", id] });
      queryClient.invalidateQueries({ queryKey: ["groups", id, "members"] });
      queryClient.invalidateQueries({ queryKey: ["groups", id, "debts"] });
      queryClient.invalidateQueries({
        queryKey: ["users", CURRENT_USER_BACKEND_ID, "groups"],
      });
    },
  });

  const members = membersQuery.data ?? [];
  const currentMemberIds = new Set(members.map((member) => member.id));
  const availableFriends = (friendsQuery.data ?? []).filter(
    (friend) => !currentMemberIds.has(friend.id)
  );
  const balancesByUserId = debtsQuery.data
    ? computeMemberNetBalancesCents(debtsQuery.data)
    : new Map<string, number>();

  const currentUserBalanceCents =
    balancesByUserId.get(CURRENT_USER_BACKEND_ID) ?? 0;
  const canLeaveGroup =
    members.some((member) => member.id === CURRENT_USER_BACKEND_ID) &&
    currentUserBalanceCents === 0 &&
    !leaveGroupMutation.isPending;
  const inviteLink = `split://group/${id}/join`;

  if (groupQuery.isPending || membersQuery.isPending) {
    return (
      <SafeAreaView className="flex-1 bg-[#0f1115]">
        <View className="flex-1 items-center justify-center gap-2">
          <ActivityIndicator color="#38bdf8" />
          <Text className="text-white/55">Loading users...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!groupQuery.data) {
    return (
      <SafeAreaView className="flex-1 bg-[#0f1115]">
        <View className="flex-1 px-5 pt-16">
          <Text className="text-3xl font-bold text-white">Group not found</Text>
        </View>
      </SafeAreaView>
    );
  }

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
          <Text className="text-4xl font-bold text-white">{groupQuery.data.name}</Text>
          <Text className="text-sm text-white/45">Members and balances</Text>
        </View>

        <View className="gap-3 rounded-[22px] border border-white/8 bg-[#171a20] p-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-white">Active users</Text>
            <Text className="text-sm text-sky-400">{members.length} total</Text>
          </View>
          {members.map((member) => (
            <View
              key={member.id}
              className="flex-row items-center justify-between rounded-[14px] border border-white/5 bg-[#2a3038] px-4 py-3"
            >
              <View className="flex-row items-center gap-2">
                <Text className="text-[16px] text-white">{member.display_name}</Text>
                {member.id === CURRENT_USER_BACKEND_ID ? (
                  <Text className="text-[11px] text-white/45">(you)</Text>
                ) : null}
              </View>
              <Text
                className={`text-[14px] font-semibold ${
                  (balancesByUserId.get(member.id) ?? 0) > 0
                    ? "text-emerald-400"
                    : (balancesByUserId.get(member.id) ?? 0) < 0
                    ? "text-rose-400"
                    : "text-white/50"
                }`}
              >
                {debtsQuery.isPending
                  ? "…"
                  : formatCents(balancesByUserId.get(member.id) ?? 0)}
              </Text>
            </View>
          ))}
          <Pressable
            onPress={() => {
              friendsQuery.refetch();
              setIsAddUsersModalOpen(true);
            }}
            disabled={addMembersMutation.isPending}
            className="flex-row items-center justify-between rounded-[14px] border border-white/5 bg-[#2a3038] px-4 py-3"
          >
            <Text className="text-[15px] text-white">Add new user</Text>
            <Ionicons name="add" size={18} color="#38bdf8" />
          </Pressable>
          {addMembersMutation.isError ? (
            <Text className="text-rose-400">
              Could not add user
              {addMembersMutation.error instanceof Error
                ? `: ${addMembersMutation.error.message}`
                : ""}
              .
            </Text>
          ) : null}
        </View>

        <View className="flex-row gap-3">
          <Pressable
            onPress={() => router.back()}
            className="flex-1 rounded-[12px] border border-white/10 bg-[#232831] py-3 items-center"
          >
            <Text className="font-semibold text-white">Back</Text>
          </Pressable>
          <Pressable
            onPress={() => leaveGroupMutation.mutate()}
            disabled={addMembersMutation.isPending || leaveGroupMutation.isPending || !canLeaveGroup}
            className={`flex-1 rounded-[12px] py-3 items-center ${
              canLeaveGroup ? "bg-rose-600" : "bg-rose-600/40"
            }`}
          >
            {addMembersMutation.isPending || leaveGroupMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="font-semibold text-white">Leave group</Text>
            )}
          </Pressable>
        </View>
        {leaveGroupMutation.isError ? (
          <Text className="text-rose-400">
            Could not leave group
            {leaveGroupMutation.error instanceof Error
              ? `: ${leaveGroupMutation.error.message}`
              : ""}
            .
          </Text>
        ) : null}
      </ScrollView>

      <Modal
        visible={isAddUsersModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddUsersModalOpen(false)}
      >
        <View className="flex-1 bg-black/50 items-center justify-center px-5">
          <View className="w-full max-w-[360px] max-h-[70%] rounded-2xl border border-white/10 bg-[#171a20] p-4 gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-white">Add your friends</Text>
              <Pressable onPress={() => setIsAddUsersModalOpen(false)}>
                <Ionicons name="close" size={20} color="#dbe4f5" />
              </Pressable>
            </View>
            <Pressable
              onPress={async () => {
                await Share.share({
                  message: `Join my Split group: ${inviteLink}`,
                });
              }}
              className="flex-row items-center justify-center gap-2 rounded-[12px] border border-white/10 bg-[#232831] py-[10px] px-3"
            >
              <Ionicons name="share-outline" size={16} color="#dbe4f5" />
              <Text className="font-semibold text-white">Share invite link</Text>
            </Pressable>

            {friendsQuery.isFetching ? (
              <View className="flex-row items-center gap-2 py-2">
                <ActivityIndicator color="#38bdf8" />
                <Text className="text-white/55">Loading your friends...</Text>
              </View>
            ) : availableFriends.length === 0 ? (
              <Text className="italic text-white/55">
                All your friends are already in this group.
              </Text>
            ) : (
              <ScrollView contentContainerClassName="gap-2 pb-2">
                {availableFriends.map((friend) => (
                  <Pressable
                    key={friend.id}
                    onPress={() => addMembersMutation.mutate(friend.id)}
                    disabled={addMembersMutation.isPending}
                    className="flex-row items-center justify-between rounded-[12px] border border-white/10 bg-[#232831] py-[10px] px-3"
                  >
                    <Text className="text-[15px] text-white">{friend.name}</Text>
                    <Ionicons name="add-circle-outline" size={18} color="#38bdf8" />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
