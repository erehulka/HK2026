import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
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
import { MOCK_FRIENDS } from "@/constants/mock-friends";
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
    queryKey: ["users", CURRENT_USER_BACKEND_ID, "friends", "mock"],
    queryFn: async () => MOCK_FRIENDS,
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
      <SafeAreaView className="flex-1 bg-app-bg">
        <View className="flex-1 items-center justify-center gap-2">
          <ActivityIndicator color="#d7e6ff" />
          <Text className="text-app-muted">Loading users…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!groupQuery.data) {
    return (
      <SafeAreaView className="flex-1 bg-app-bg">
        <View className="flex-1 px-5 pt-16">
          <Text className="text-3xl font-bold text-app-text">Group not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-app-bg">
      <ScrollView contentContainerClassName="px-5 pt-16 pb-6 gap-5">
        <Text className="text-3xl font-bold text-app-text">{groupQuery.data.name}</Text>

        <View className="bg-app-surface border border-app-border rounded-xl p-[14px] gap-[10px]">
          <Text className="text-base font-semibold text-app-text">
            Active users ({members.length})
          </Text>
          {members.map((member) => (
            <View
              key={member.id}
              className="bg-app-card border border-app-border-soft rounded-[10px] py-[10px] px-3 flex-row items-center justify-between"
            >
              <View className="flex-row items-center gap-2">
                <Text className="text-[15px] text-app-text">{member.display_name}</Text>
                {member.id === CURRENT_USER_BACKEND_ID ? (
                  <Text className="text-[11px] text-app-muted">(you)</Text>
                ) : null}
              </View>
              <Text
                className={`text-[14px] font-semibold ${
                  (balancesByUserId.get(member.id) ?? 0) > 0
                    ? "text-app-success"
                    : (balancesByUserId.get(member.id) ?? 0) < 0
                    ? "text-app-danger"
                    : "text-app-muted"
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
            className="bg-app-card border border-app-border-soft rounded-[10px] py-[10px] px-3 flex-row items-center justify-between"
          >
            <Text className="text-[15px] text-app-text">Add new user</Text>
            <Ionicons name="add" size={18} color="#d7e6ff" />
          </Pressable>
          {addMembersMutation.isError ? (
            <Text className="text-app-danger">
              Could not add user
              {addMembersMutation.error instanceof Error
                ? `: ${addMembersMutation.error.message}`
                : ""}
              .
            </Text>
          ) : null}
        </View>

        <View className="bg-app-surface border border-app-border rounded-xl p-[14px] gap-[10px]">
          <Text className="text-base font-semibold text-app-text">Leave group</Text>
          {currentUserBalanceCents === 0 ? (
            <Text className="text-app-muted">
              You are settled up. You can safely leave this group.
            </Text>
          ) : (
            <Text className="text-app-muted">
              Settle up first. Your current balance is{" "}
              <Text className="font-semibold">{formatCents(currentUserBalanceCents)}</Text>.
            </Text>
          )}
          {leaveGroupMutation.isError ? (
            <Text className="text-app-danger">
              Could not leave group
              {leaveGroupMutation.error instanceof Error
                ? `: ${leaveGroupMutation.error.message}`
                : ""}
              .
            </Text>
          ) : null}
        </View>

        <View className="flex-row gap-3">
          <Pressable
            onPress={() => router.back()}
            className="flex-1 rounded-[10px] py-3 items-center bg-app-cancel"
          >
            <Text className="text-app-text font-semibold">Back</Text>
          </Pressable>
          <Pressable
            onPress={() => leaveGroupMutation.mutate()}
            disabled={addMembersMutation.isPending || leaveGroupMutation.isPending || !canLeaveGroup}
            className={`flex-1 rounded-[10px] py-3 items-center ${
              canLeaveGroup ? "bg-app-primary" : "bg-app-primary-dim"
            }`}
          >
            {addMembersMutation.isPending || leaveGroupMutation.isPending ? (
              <ActivityIndicator color="#f4f7ff" />
            ) : (
              <Text className="text-app-text font-semibold">Leave group</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={isAddUsersModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddUsersModalOpen(false)}
      >
        <View className="flex-1 bg-black/50 items-center justify-center px-5">
          <View className="w-full max-w-[360px] bg-app-surface border border-app-border rounded-2xl p-4 gap-3 max-h-[70%]">
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-semibold text-app-text">Add your friends</Text>
              <Pressable onPress={() => setIsAddUsersModalOpen(false)}>
                <Ionicons name="close" size={20} color="#d7e6ff" />
              </Pressable>
            </View>
            <Pressable
              onPress={async () => {
                await Share.share({
                  message: `Join my Split group: ${inviteLink}`,
                });
              }}
              className="bg-app-card border border-app-border-soft rounded-[10px] py-[10px] px-3 flex-row items-center justify-center gap-2"
            >
              <Ionicons name="share-outline" size={16} color="#d7e6ff" />
              <Text className="text-app-text font-semibold">Share invite link</Text>
            </Pressable>

            {friendsQuery.isFetching ? (
              <View className="flex-row items-center gap-2 py-2">
                <ActivityIndicator color="#d7e6ff" />
                <Text className="text-app-muted">Loading your friends…</Text>
              </View>
            ) : availableFriends.length === 0 ? (
              <Text className="text-app-muted italic">
                All your friends are already in this group.
              </Text>
            ) : (
              <ScrollView contentContainerClassName="gap-2 pb-2">
                {availableFriends.map((friend) => (
                  <Pressable
                    key={friend.id}
                    onPress={() => addMembersMutation.mutate(friend.id)}
                    disabled={addMembersMutation.isPending}
                    className="bg-app-card border border-app-border-soft rounded-[10px] py-[10px] px-3 flex-row items-center justify-between"
                  >
                    <Text className="text-[15px] text-app-text">{friend.name}</Text>
                    <Ionicons name="add-circle-outline" size={18} color="#d7e6ff" />
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
