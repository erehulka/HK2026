import * as Clipboard from "expo-clipboard";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import {
  FRIEND_INVITE_LINK,
  Friend,
  MOCK_FRIENDS,
} from "@/constants/mock-friends";

type InviteFriendsProps = {
  selectedFriendIds: string[];
  onToggleFriend: (id: string) => void;
  friends?: Friend[];
  inviteLink?: string;
};

export function InviteFriends({
  selectedFriendIds,
  onToggleFriend,
  friends = MOCK_FRIENDS,
  inviteLink = FRIEND_INVITE_LINK,
}: InviteFriendsProps) {
  const handleCopyInviteLink = async () => {
    await Clipboard.setStringAsync(inviteLink);
    Alert.alert("Invite link copied", inviteLink);
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.label}>Invite Friends</Text>
        <Pressable onPress={handleCopyInviteLink} style={styles.linkButton}>
          <Text style={styles.linkButtonText}>Copy invite link</Text>
        </Pressable>
      </View>

      {friends.length === 0 ? (
        <Text style={styles.emptyState}>You have no friends yet.</Text>
      ) : (
        friends.map((friend) => {
          const isSelected = selectedFriendIds.includes(friend.id);
          return (
            <Pressable
              key={friend.id}
              onPress={() => onToggleFriend(friend.id)}
              style={[styles.friendRow, isSelected && styles.friendRowSelected]}
            >
              <Text style={styles.friendName}>{friend.name}</Text>
              <View
                style={[styles.checkbox, isSelected && styles.checkboxSelected]}
              >
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: "#090d1a",
    borderWidth: 1,
    borderColor: "#2563eb",
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  linkButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2563eb",
  },
  linkButtonText: {
    color: "#9fb8ff",
    fontWeight: "600",
    fontSize: 13,
  },
  emptyState: {
    color: "#9fb8ff",
    fontStyle: "italic",
  },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  friendRowSelected: {
    backgroundColor: "#1d4ed8",
  },
  friendName: {
    color: "#ffffff",
    fontSize: 15,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f172a",
  },
  checkboxSelected: {
    backgroundColor: "#ffffff",
    borderColor: "#ffffff",
  },
  checkmark: {
    color: "#1d4ed8",
    fontWeight: "700",
  },
});
