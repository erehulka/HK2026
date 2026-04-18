import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { Group, MOCK_GROUPS } from "@/constants/mock-groups";

export default function HomeScreen() {
  const [groups, setGroups] = useState<Group[]>(MOCK_GROUPS);

  useFocusEffect(
    useCallback(() => {
      setGroups([...MOCK_GROUPS]);
    }, [])
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.title}>Groups</Text>
        <Text style={styles.subtitle}>
          Simple mock view for existing groups.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Existing Groups</Text>
          {groups.length === 0 ? (
            <Text style={styles.emptyState}>
              No groups exist at the moment.
            </Text>
          ) : (
            groups.map((group) => (
              <Pressable
                key={group.id}
                onPress={() => router.push(`/group/${group.id}`)}
                style={styles.groupCard}
              >
                <Text style={styles.groupName}>{group.name}</Text>
              </Pressable>
            ))
          )}
        </View>

        <Pressable
          onPress={() => router.push("/create-group")}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Add Group</Text>
        </Pressable>
      </View>
    </SafeAreaView>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
  },
  groupCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  groupName: {
    color: "#ffffff",
    fontSize: 16,
  },
  emptyState: {
    color: "#9fb8ff",
    fontStyle: "italic",
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
});
