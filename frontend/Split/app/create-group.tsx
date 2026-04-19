import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
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

import { InviteFriends } from "@/components/invite-friends";
import type { GroupOut } from "@/api/generated/api";
import { backendClient } from "@/api/generated/client";
import { GroupType } from "@/constants/mock-groups";
import { CURRENT_USER_BACKEND_ID } from "@/constants/mock-user";

const GROUP_TYPES: GroupType[] = ["basic", "trip", "household"];

type CreateGroupInput = {
  name: string;
  description: string;
};

async function createGroupForCurrentUser(
  input: CreateGroupInput
): Promise<GroupOut> {
  console.log("[createGroup] POST /groups/", input);
  const { data: group } = await backendClient.createGroupGroupsPost({
    name: input.name,
    description: input.description,
  });
  console.log("[createGroup] created", group.id);
  // Make sure the creator is a member so the new group appears in their list.
  await backendClient.addUserToGroupGroupsGroupIdUsersUserIdPost(
    group.id,
    CURRENT_USER_BACKEND_ID
  );
  console.log("[createGroup] member added", CURRENT_USER_BACKEND_ID);
  return group;
}

export default function CreateGroupScreen() {
  const queryClient = useQueryClient();

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
    createGroupMutation.mutate({
      name: trimmedName,
      description: trimmedDescription,
    });
  };

  const errorMessage =
    createGroupMutation.error instanceof Error
      ? createGroupMutation.error.message
      : null;

  return (
    <SafeAreaView className="flex-1 bg-app-bg" edges={["top"]}>
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
          <Text className="text-sm text-white/45">Choose a name and group type.</Text>
        </View>

        <View className="gap-4 rounded-[22px] border border-white/8 bg-[#171a20] p-4">
          <Text className="text-lg font-bold text-white">Details</Text>

          <View className="gap-2 rounded-[14px] border border-white/5 bg-[#2a3038] p-4">
            <Text className="text-base font-semibold text-white">Group name</Text>
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
            <Text className="text-base font-semibold text-white">Description</Text>
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

        <View className="gap-4 rounded-[22px] border border-white/8 bg-[#171a20] p-4">
          <Text className="text-lg font-bold text-white">Group type</Text>
          <View className="flex-row gap-3">
            {GROUP_TYPES.map((type) => {
              const isActive = type === groupType;
              return (
                <Pressable
                  key={type}
                  onPress={() => setGroupType(type)}
                  disabled={isSubmitting}
                  className={`flex-1 items-center rounded-[12px] border py-3 ${
                    isActive
                      ? "border-sky-400/50 bg-[#2b6fff]"
                      : "border-white/10 bg-[#232831]"
                  }`}
                >
                  <Text
                    className={`text-[15px] font-semibold capitalize ${
                      isActive ? "text-white" : "text-white/70"
                    }`}
                  >
                    {type}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <InviteFriends
          selectedFriendIds={selectedFriendIds}
          onToggleFriend={toggleFriend}
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
