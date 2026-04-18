import { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';

type Group = {
  id: string;
  name: string;
};

const MOCK_GROUPS: Group[] = [
  { id: 'g1', name: 'Family Budget' },
  { id: 'g2', name: 'Vacation Planning' },
  { id: 'g3', name: 'Team Lunches' },
];

export default function HomeScreen() {
  const [groups, setGroups] = useState<Group[]>(MOCK_GROUPS);
  const [newGroupName, setNewGroupName] = useState('');

  const canAddGroup = useMemo(() => newGroupName.trim().length > 0, [newGroupName]);

  const handleAddGroup = () => {
    if (!canAddGroup) return;

    const nextGroup: Group = {
      id: Date.now().toString(),
      name: newGroupName.trim(),
    };

    setGroups((prev) => [...prev, nextGroup]);
    setNewGroupName('');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.title}>Groups</Text>
        <Text style={styles.subtitle}>Simple mock view for existing groups.</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Existing Groups</Text>
          {groups.length === 0 ? (
            <Text style={styles.emptyState}>No groups exist at the moment.</Text>
          ) : (
            groups.map((group) => (
              <View key={group.id} style={styles.groupCard}>
                <Text style={styles.groupName}>{group.name}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add New Group</Text>
          <TextInput
            value={newGroupName}
            onChangeText={setNewGroupName}
            placeholder="Type group name"
            placeholderTextColor="#7f8ca3"
            style={styles.input}
          />
          <Pressable
            onPress={handleAddGroup}
            disabled={!canAddGroup}
            style={[styles.button, !canAddGroup && styles.buttonDisabled]}>
            <Text style={styles.buttonText}>Add Group</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#ffffff',
  },
  subtitle: {
    color: '#9fb8ff',
    fontSize: 14,
  },
  section: {
    backgroundColor: '#090d1a',
    borderWidth: 1,
    borderColor: '#2563eb',
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  groupCard: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1d4ed8',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  groupName: {
    color: '#ffffff',
    fontSize: 16,
  },
  emptyState: {
    color: '#9fb8ff',
    fontStyle: 'italic',
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#1f3b74',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});
