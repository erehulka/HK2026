import { useLocalSearchParams } from "expo-router";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { getGroupById } from "@/constants/mock-groups";
import { getPaymentsForGroup } from "@/constants/mock-payments";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = getGroupById(id);
  const payments = getPaymentsForGroup(id);

  if (!group) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.container}>
          <Text style={styles.title}>Group not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const balanceColor =
    group.balance > 0
      ? styles.balancePositive
      : group.balance < 0
      ? styles.balanceNegative
      : styles.balanceNeutral;

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{group.name}</Text>

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Your balance</Text>
          <Text style={[styles.balanceValue, balanceColor]}>
            {group.balance > 0 ? "+" : ""}
            {group.balance.toFixed(2)}
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable style={[styles.actionButton, styles.settingsButton]}>
            <Text style={styles.actionText}>Settings</Text>
          </Pressable>
          <Pressable style={[styles.actionButton, styles.cardButton]}>
            <Text style={styles.actionText}>Group Card</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payments</Text>
          {payments.length === 0 ? (
            <Text style={styles.emptyState}>No payments yet.</Text>
          ) : (
            payments.map((payment) => (
              <View key={payment.id} style={styles.paymentRow}>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentName}>{payment.name}</Text>
                  <Text style={styles.paymentMeta}>
                    {payment.date} · {payment.paidBy}
                  </Text>
                </View>
                <Text style={styles.paymentAmount}>
                  {payment.amount.toFixed(2)}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000000",
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 24,
    gap: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#ffffff",
  },
  balanceCard: {
    backgroundColor: "#090d1a",
    borderWidth: 1,
    borderColor: "#2563eb",
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  balanceLabel: {
    color: "#9fb8ff",
    fontSize: 13,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: "700",
  },
  balancePositive: {
    color: "#22c55e",
  },
  balanceNegative: {
    color: "#ef4444",
  },
  balanceNeutral: {
    color: "#ffffff",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  settingsButton: {
    backgroundColor: "#374151",
  },
  cardButton: {
    backgroundColor: "#2563eb",
  },
  actionText: {
    color: "#ffffff",
    fontWeight: "600",
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
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
  },
  emptyState: {
    color: "#9fb8ff",
    fontStyle: "italic",
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1d4ed8",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  paymentMeta: {
    color: "#9fb8ff",
    fontSize: 12,
    marginTop: 2,
  },
  paymentAmount: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
