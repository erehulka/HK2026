import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { backendClient } from "@/api/generated/client";
import { CURRENT_USER_BACKEND_ID } from "@/constants/mock-user";

const userGroupsQueryKey = (userId: string) =>
  ["users", userId, "groups"] as const;

export default function HomeScreen() {
  const {
    data: groups,
    isPending,
    isError,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: userGroupsQueryKey(CURRENT_USER_BACKEND_ID),
    queryFn: () =>
      backendClient.listUserGroupsUsersUserIdGroupsGet(CURRENT_USER_BACKEND_ID),
    select: (response) => response.data,
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  return (
    <SafeAreaView className="flex-1 bg-app-bg">
      <View className="flex-1 px-5 py-4 gap-5">
        <Text className="text-3xl font-bold text-app-text">Groups</Text>
        <Text className="text-sm text-app-muted">
          Live groups for the signed-in user from the backend.
        </Text>

        <View className="bg-app-surface border border-app-border rounded-xl p-[14px] gap-[10px]">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-semibold text-app-text">
              Existing Groups
            </Text>
            {isRefetching && !isPending ? (
              <ActivityIndicator color="#d7e6ff" />
            ) : null}
          </View>

          {isPending && (
            <View className="flex-row items-center gap-2 py-2">
              <ActivityIndicator color="#d7e6ff" />
              <Text className="text-app-muted">Loading groups…</Text>
            </View>
          )}

          {isError && (
            <View className="gap-2">
              <Text className="text-app-danger">
                Could not load groups
                {error instanceof Error ? `: ${error.message}` : ""}.
              </Text>
              <Pressable
                onPress={() => refetch()}
                className="bg-app-card border border-app-border-soft rounded-[10px] py-[10px] px-3 self-start"
              >
                <Text className="text-app-text font-semibold">Retry</Text>
              </Pressable>
            </View>
          )}

          {!isPending && !isError && groups && groups.length === 0 && (
            <Text className="italic text-app-muted">
              No groups exist at the moment.
            </Text>
          )}

          {!isPending &&
            !isError &&
            groups?.map((group) => (
              <Pressable
                key={group.id}
                onPress={() => router.push(`/group/${group.id}`)}
                className="bg-app-card border border-app-border-soft rounded-[10px] py-[10px] px-3"
              >
                <Text className="text-base text-app-text">{group.name}</Text>
                {group.description ? (
                  <Text className="text-xs text-app-muted mt-[2px]">
                    {group.description}
                  </Text>
                ) : null}
              </Pressable>
            ))}
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
