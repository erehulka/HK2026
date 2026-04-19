import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosResponse } from "axios";
import { router, Stack } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { GroupOut, UserOut } from "@/api/generated/api";
import { backendClient } from "@/api/generated/client";
import { InviteFriends } from "@/components/invite-friends";
import type { Friend } from "@/constants/mock-friends";
import { GroupType } from "@/constants/mock-groups";
import { CURRENT_USER_BACKEND_ID } from "@/constants/mock-user";

const MONGO_OBJECT_ID_REGEX = /^[a-f\d]{24}$/i;

type CreateGroupInput = {
  name: string;
  description: string;
  memberUserIds: string[];
};

async function createGroupForCurrentUser(
  input: CreateGroupInput
): Promise<GroupOut> {
  console.log("[createGroup] POST /groups/", input);
  const { data: group } = await backendClient.createGroupGroupsPost({
    name: input.name,
    description: input.description,
    member_user_ids: input.memberUserIds,
  });
  console.log("[createGroup] created", group.id);
  return group;
}

export default function CreateGroupScreen() {
  const queryClient = useQueryClient();

  const { data: friends = [] } = useQuery({
    queryKey: ["users", CURRENT_USER_BACKEND_ID, "friends"],
    queryFn: () =>
      backendClient.listUserFriendsUsersUserIdFriendsGet(
        CURRENT_USER_BACKEND_ID
      ),
    select: (response: AxiosResponse<UserOut[]>) =>
      response.data.map(
        (user): Friend => ({
          id: user.id,
          name: user.display_name,
        })
      ),
  });

  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupType, setGroupType] = useState<GroupType>("basic");
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);

  const trimmedName = groupName.trim();
  const trimmedDescription = groupDescription.trim();

  const createGroupMutation = useMutation({
    mutationFn: createGroupForCurrentUser,
    onSuccess: (group) => {
      queryClient.invalidateQueries({
        queryKey: ["users", CURRENT_USER_BACKEND_ID, "groups"],
      });
      router.replace(`/group/${group.id}`);
    },
    onError: (err) => {
      console.warn("[createGroup] failed", err);
    },
  });

  const isSubmitting = createGroupMutation.isPending;
  const canConfirm = trimmedName.length > 0 && !isSubmitting;

  const toggleFriend = (id: string) => {
    setSelectedFriendIds((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    console.log("[createGroup] confirm pressed", {
      canConfirm,
      isSubmitting,
      trimmedName,
    });
    if (!canConfirm) return;
    const memberUserIds = Array.from(
      new Set(
        [CURRENT_USER_BACKEND_ID, ...selectedFriendIds].filter((userId) =>
          MONGO_OBJECT_ID_REGEX.test(userId)
        )
      )
    );
    createGroupMutation.mutate({
      name: trimmedName,
      description: trimmedDescription,
      memberUserIds,
    });
  };

  const errorMessage =
    createGroupMutation.error instanceof Error
      ? createGroupMutation.error.message
      : null;

  return (
    <SafeAreaView className="flex-1 bg-[#0f1115]" edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1 bg-[#0f1115]"
        contentContainerClassName="px-5 pt-4 pb-8 gap-5"
        showsVerticalScrollIndicator={false}
      >
        <View className="mt-2 flex-row items-center justify-between">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-start justify-center"
            disabled={isSubmitting}
          >
            <Ionicons name="chevron-back" size={26} color="#2b6fff" />
          </Pressable>
          <View className="w-10" />
        </View>

        <View className="gap-1">
          <Text className="text-4xl font-bold text-white">Create Group</Text>
        </View>

        <View className="gap-4 rounded-[22px] border border-white/8 bg-[#171a20] p-4">
          <Text className="text-lg font-bold text-white">Details</Text>

          <View className="gap-2 rounded-[14px] border border-white/5 bg-[#2a3038] p-4">
            <Text className="text-base font-semibold text-white">
              Group name
            </Text>
            <TextInput
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Enter group name"
              placeholderTextColor="#8fa0cb"
              editable={!isSubmitting}
              className="rounded-[12px] border border-white/10 bg-[#232831] px-3 py-[11px] text-white"
            />
          </View>

          <View className="gap-2 rounded-[14px] border border-white/5 bg-[#2a3038] p-4">
            <Text className="text-base font-semibold text-white">
              Description
            </Text>
            <TextInput
              value={groupDescription}
              onChangeText={setGroupDescription}
              placeholder="Optional short description"
              placeholderTextColor="#8fa0cb"
              editable={!isSubmitting}
              multiline
              className="min-h-[64px] rounded-[12px] border border-white/10 bg-[#232831] px-3 py-[11px] text-white"
            />
          </View>
        </View>

        <InviteFriends
          selectedFriendIds={selectedFriendIds}
          onToggleFriend={toggleFriend}
          friends={friends}
        />

        {errorMessage ? (
          <Text className="rounded-[12px] border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-rose-300">
            Could not create group: {errorMessage}
          </Text>
        ) : null}

        <View className="mt-1 flex-row gap-3">
          <Pressable
            onPress={() => router.back()}
            disabled={isSubmitting}
            className="flex-1 items-center rounded-[12px] border border-white/10 bg-[#232831] py-3"
          >
            <Text className="font-semibold text-white">Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            disabled={!canConfirm}
            className={`flex-1 items-center rounded-[12px] py-3 ${
              canConfirm ? "bg-[#2b6fff]" : "bg-[#2b6fff]/50"
            }`}
          >
            {isSubmitting ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator color="#fff" />
                <Text className="font-semibold text-white">Creating...</Text>
              </View>
            ) : (
              <Text className="font-semibold text-white">Create group</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
