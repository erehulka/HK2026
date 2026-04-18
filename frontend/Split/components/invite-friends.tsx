import * as Clipboard from "expo-clipboard";
import { Alert, Pressable, Text, View } from "react-native";

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
    <View className="bg-app-surface border border-app-border rounded-xl p-[14px] gap-[10px]">
      <View className="flex-row items-center justify-between">
        <Text className="text-base font-semibold text-app-text">
          Invite Friends
        </Text>
        <Pressable
          onPress={handleCopyInviteLink}
          className="px-[10px] py-[6px] rounded-lg border border-app-border"
        >
          <Text className="text-[13px] font-semibold text-app-muted">
            Copy invite link
          </Text>
        </Pressable>
      </View>

      {friends.length === 0 ? (
        <Text className="italic text-app-muted">You have no friends yet.</Text>
      ) : (
        friends.map((friend) => {
          const isSelected = selectedFriendIds.includes(friend.id);
          return (
            <Pressable
              key={friend.id}
              onPress={() => onToggleFriend(friend.id)}
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
  );
}
