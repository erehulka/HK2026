import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
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
    <ScrollView style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.title}>Create Group</Text>
        <Text style={styles.subtitle}>Choose a name and group type.</Text>

        <View style={styles.section}>
          <Text style={styles.label}>Group Name</Text>
          <TextInput
            value={groupName}
            onChangeText={setGroupName}
            placeholder="Enter group name"
            placeholderTextColor="#7c90c6"
            style={styles.input}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Group Type</Text>
          <View style={styles.typeList}>
            {GROUP_TYPES.map((type) => {
              const isActive = type === groupType;
              return (
                <Pressable
                  key={type}
                  onPress={() => setGroupType(type)}
                  style={[
                    styles.typeOption,
                    isActive && styles.typeOptionActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.typeOptionText,
                      isActive && styles.typeOptionTextActive,
                    ]}
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

        <View style={styles.actions}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.actionButton, styles.cancelButton]}
          >
            <Text style={styles.actionText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            disabled={!canConfirm}
            style={[
              styles.actionButton,
              styles.confirmButton,
              !canConfirm && styles.confirmButtonDisabled,
            ]}
          >
            <Text style={styles.actionText}>Confirm</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000000",
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#ffffff",
  },
  subtitle: {
    color: "#9fb8ff",
    fontSize: 14,
  },
  section: {
    backgroundColor: "#090d1a",
    borderWidth: 1,
    borderColor: "#2563eb",
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  label: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#3b82f6",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#ffffff",
  },
  typeList: {
    flexDirection: "row",
    gap: 8,
  },
  typeOption: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1d4ed8",
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#0f172a",
  },
  typeOptionActive: {
    backgroundColor: "#1d4ed8",
  },
  typeOptionText: {
    color: "#9fb8ff",
    fontWeight: "600",
    textTransform: "capitalize",
  },
  typeOptionTextActive: {
    color: "#ffffff",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: "auto",
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#374151",
  },
  confirmButton: {
    backgroundColor: "#2563eb",
  },
  confirmButtonDisabled: {
    backgroundColor: "#1f3b74",
  },
  actionText: {
    color: "#ffffff",
    fontWeight: "600",
  },
});
