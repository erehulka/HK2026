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
    <View className="gap-4 rounded-[22px] border border-white/8 bg-[#171a20] p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold text-white">Invite friends</Text>
        <Pressable
          onPress={handleCopyInviteLink}
          className="rounded-[10px] border border-sky-400/40 bg-sky-500/10 px-3 py-2"
        >
          <Text className="text-[13px] font-semibold text-sky-300">Copy invite link</Text>
        </Pressable>
      </View>

      {friends.length === 0 ? (
        <Text className="italic text-white/45">You have no friends yet.</Text>
      ) : (
        friends.map((friend) => {
          const isSelected = selectedFriendIds.includes(friend.id);
          return (
            <Pressable
              key={friend.id}
              onPress={() => onToggleFriend(friend.id)}
              className={`flex-row items-center justify-between rounded-[14px] border px-3 py-[11px] ${
                isSelected
                  ? "border-sky-400/40 bg-sky-500/10"
                  : "border-white/10 bg-[#232831]"
              }`}
            >
              <Text className="text-[15px] text-white">{friend.name}</Text>
              <View
                className={`h-[24px] w-[24px] items-center justify-center rounded-md border ${
                  isSelected
                    ? "border-sky-400 bg-sky-400"
                    : "border-sky-400/60 bg-transparent"
                }`}
              >
                {isSelected && (
                  <Text className="font-bold text-[#0f1115]">✓</Text>
                )}
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}
