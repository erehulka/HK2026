import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MOCK_FRIENDS } from "@/constants/mock-friends";
import {
  addMembersToGroup,
  getGroupById,
  getGroupMemberIds,
  getGroupMembers,
} from "@/constants/mock-groups";

export default function GroupMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = getGroupById(id);
  const [selectedNewMemberIds, setSelectedNewMemberIds] = useState<string[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>(() => getGroupMemberIds(id));
  const [members, setMembers] = useState(() => getGroupMembers(id));

  const availableFriends = MOCK_FRIENDS.filter(
    (friend) => !memberIds.includes(friend.id)
  );

  const toggleNewMember = (memberId: string) => {
    setSelectedNewMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleAddSelectedMembers = () => {
    if (selectedNewMemberIds.length === 0) return;
    addMembersToGroup(id, selectedNewMemberIds);
    setSelectedNewMemberIds([]);
    setMemberIds(getGroupMemberIds(id));
    setMembers(getGroupMembers(id));
  };

  if (!group) {
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
        <Text className="text-3xl font-bold text-app-text">{group.name}</Text>

        <View className="bg-app-surface border border-app-border rounded-xl p-[14px] gap-[10px]">
          <Text className="text-base font-semibold text-app-text">
            Members ({members.length})
          </Text>
          {members.map((member) => (
            <View
              key={member.id}
              className="bg-app-card border border-app-border-soft rounded-[10px] py-[10px] px-3"
            >
              <Text className="text-[15px] text-app-text">{member.name}</Text>
            </View>
          ))}
        </View>

        <View className="bg-app-surface border border-app-border rounded-xl p-[14px] gap-[10px]">
          <Text className="text-base font-semibold text-app-text">Add new members</Text>
          {availableFriends.length === 0 ? (
            <Text className="text-app-muted italic">
              Everyone from your friend list is already in this group.
            </Text>
          ) : (
            availableFriends.map((friend) => {
              const isSelected = selectedNewMemberIds.includes(friend.id);
              return (
                <Pressable
                  key={friend.id}
                  onPress={() => toggleNewMember(friend.id)}
                  className={`flex-row items-center justify-between border border-app-border-soft rounded-[10px] py-[10px] px-3 ${
                    isSelected ? "bg-app-border-soft" : "bg-app-card"
                  }`}
                >
                  <Text className="text-[15px] text-app-text">{friend.name}</Text>
                  <View
                    className={`w-[22px] h-[22px] rounded-md border items-center justify-center ${
                      isSelected
                        ? "bg-white border-white"
                        : "bg-app-card border-app-input-border"
                    }`}
                  >
                    {isSelected && (
                      <Text className="font-bold text-app-border-soft">✓</Text>
                    )}
                  </View>
                </Pressable>
              );
            })
          )}
        </View>

        <View className="flex-row gap-3">
          <Pressable
            onPress={() => router.back()}
            className="flex-1 rounded-[10px] py-3 items-center bg-app-cancel"
          >
            <Text className="text-app-text font-semibold">Back</Text>
          </Pressable>
          <Pressable
            onPress={handleAddSelectedMembers}
            disabled={selectedNewMemberIds.length === 0}
            className={`flex-1 rounded-[10px] py-3 items-center ${
              selectedNewMemberIds.length > 0
                ? "bg-app-primary"
                : "bg-app-primary-dim"
            }`}
          >
            <Text className="text-app-text font-semibold">Add selected</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
