import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { InviteFriends } from "@/components/invite-friends";
import { addGroup, GroupType } from "@/constants/mock-groups";

const GROUP_TYPES: GroupType[] = ["basic", "trip", "household"];

export default function CreateGroupScreen() {
  const [groupName, setGroupName] = useState("");
  const [groupType, setGroupType] = useState<GroupType>("basic");
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);

  const trimmedName = groupName.trim();
  const canConfirm = trimmedName.length > 0;

  const toggleFriend = (id: string) => {
    setSelectedFriendIds((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    const newId = `g${Date.now()}`;
    addGroup({
      id: newId,
      name: trimmedName,
      type: groupType,
      balance: 0,
    });
    router.replace(`/group/${newId}`);
  };

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
            className="bg-app-input border border-app-input-border rounded-[10px] px-3 py-[10px] text-app-text"
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

        <View className="flex-row gap-3 mt-auto">
          <Pressable
            onPress={() => router.back()}
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
            <Text className="text-app-text font-semibold">Confirm</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
