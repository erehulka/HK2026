import { useMutation, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

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
    <ScrollView className="flex-1 bg-app-bg">
      <View className="flex-1 px-5 pt-10 pb-4 gap-5">
        <Text className="text-3xl font-bold text-app-text">Create Group</Text>
        <Text className="text-sm text-app-muted">
          Choose a name and group type.
        </Text>

        <View className="bg-app-surface border border-app-border rounded-xl p-[14px] gap-[10px]">
          <Text className="text-base font-semibold text-app-text">
            Group Name
          </Text>
          <TextInput
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Enter group name"
            placeholderTextColor="#7c90c6"
            editable={!isSubmitting}
            className="bg-app-input border border-app-input-border rounded-[10px] px-3 py-[10px] text-app-text"
          />
        </View>

        <View className="bg-app-surface border border-app-border rounded-xl p-[14px] gap-[10px]">
          <Text className="text-base font-semibold text-app-text">
            Description
          </Text>
          <TextInput
            value={groupDescription}
            onChangeText={setGroupDescription}
            placeholder="Optional short description"
            placeholderTextColor="#7c90c6"
            editable={!isSubmitting}
            multiline
            className="bg-app-input border border-app-input-border rounded-[10px] px-3 py-[10px] text-app-text min-h-[60px]"
          />
        </View>

        <View className="bg-app-surface border border-app-border rounded-xl p-[14px] gap-[10px]">
          <Text className="text-base font-semibold text-app-text">
            Group Type
          </Text>
          <View className="flex-row gap-2">
            {GROUP_TYPES.map((type) => {
              const isActive = type === groupType;
              return (
                <Pressable
                  key={type}
                  onPress={() => setGroupType(type)}
                  disabled={isSubmitting}
                  className={`flex-1 rounded-[10px] border border-app-border-soft py-3 items-center ${
                    isActive ? "bg-app-border-soft" : "bg-app-card"
                  }`}
                >
                  <Text
                    className={`font-semibold capitalize ${
                      isActive ? "text-app-text" : "text-app-muted"
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
          <Text className="text-app-danger">
            Could not create group: {errorMessage}
          </Text>
        ) : null}

        <View className="flex-row gap-3 mt-auto">
          <Pressable
            onPress={() => router.back()}
            disabled={isSubmitting}
            className="flex-1 rounded-[10px] py-3 items-center bg-app-cancel"
          >
            <Text className="text-app-text font-semibold">Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            disabled={!canConfirm}
            className={`flex-1 rounded-[10px] py-3 items-center ${
              canConfirm ? "bg-app-primary" : "bg-app-primary-dim"
            }`}
          >
            {isSubmitting ? (
              <View className="flex-row items-center gap-2">
                <ActivityIndicator color="#f4f7ff" />
                <Text className="text-app-text font-semibold">Creating…</Text>
              </View>
            ) : (
              <Text className="text-app-text font-semibold">Confirm</Text>
            )}
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
