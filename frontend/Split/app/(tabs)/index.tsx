import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Group, MOCK_GROUPS } from "@/constants/mock-groups";

export default function HomeScreen() {
  const [groups, setGroups] = useState<Group[]>(MOCK_GROUPS);

  useFocusEffect(
    useCallback(() => {
      setGroups([...MOCK_GROUPS]);
    }, [])
  );

  return (
    <SafeAreaView className="flex-1 bg-app-bg">
      <View className="flex-1 px-5 py-4 gap-5">
        <Text className="text-3xl font-bold text-app-text">Groups</Text>
        <Text className="text-sm text-app-muted">
          Simple mock view for existing groups.
        </Text>

        <View className="bg-app-surface border border-app-border rounded-xl p-[14px] gap-[10px]">
          <Text className="text-lg font-semibold text-app-text">
            Existing Groups
          </Text>
          {groups.length === 0 ? (
            <Text className="italic text-app-muted">
              No groups exist at the moment.
            </Text>
          ) : (
            groups.map((group) => (
              <Pressable
                key={group.id}
                onPress={() => router.push(`/group/${group.id}`)}
                className="bg-app-card border border-app-border-soft rounded-[10px] py-[10px] px-3"
              >
                <Text className="text-base text-app-text">{group.name}</Text>
              </Pressable>
            ))
          )}
        </View>

        <Pressable
          onPress={() => router.push("/create-group")}
          className="bg-app-primary rounded-[10px] py-3 items-center"
        >
          <Text className="text-app-text font-semibold">Add Group</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
