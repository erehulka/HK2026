import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { MOCK_FRIENDS } from "@/constants/mock-friends";
import {
  addPayment,
  getPaymentById,
  Payment,
  SplitMethod,
  updatePayment,
} from "@/constants/mock-payments";
import { CURRENT_USER, User } from "@/constants/mock-user";

const SPLIT_METHODS: SplitMethod[] = ["equal", "percentage", "exact"];

type DropdownKey = "paidBy" | "splitBetween" | null;

export default function AddPaymentScreen() {
  const { id: groupId, paymentId } = useLocalSearchParams<{
    id: string;
    paymentId?: string;
  }>();

  const members = useMemo<User[]>(() => [CURRENT_USER, ...MOCK_FRIENDS], []);

  const existingPayment = paymentId
    ? getPaymentById(groupId, paymentId)
    : undefined;
  const isEditing = !!existingPayment;

  const initialPaidById = (() => {
    if (!existingPayment) return CURRENT_USER.id;
    if (existingPayment.paidById) return existingPayment.paidById;
    const matchByName = members.find((m) => m.name === existingPayment.paidBy);
    return matchByName?.id ?? CURRENT_USER.id;
  })();

  const [name, setName] = useState(existingPayment?.name ?? "");
  const [amount, setAmount] = useState(
    existingPayment ? String(existingPayment.amount) : ""
  );
  const [paidById, setPaidById] = useState<string>(initialPaidById);
  const [owesIds, setOwesIds] = useState<string[]>(
    existingPayment?.owesIds ?? members.map((m) => m.id)
  );
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(
    existingPayment?.splitMethod ?? "equal"
  );
  const [splitValues, setSplitValues] = useState<Record<string, string>>(
    existingPayment?.splitValues ?? {}
  );
  const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null);

  const trimmedName = name.trim();
  const numericAmount = parseFloat(amount.replace(",", "."));
  const canSave =
    trimmedName.length > 0 &&
    !isNaN(numericAmount) &&
    numericAmount > 0 &&
    owesIds.length > 0;

  const toggleDropdown = (key: Exclude<DropdownKey, null>) => {
    setOpenDropdown((prev) => (prev === key ? null : key));
  };

  const toggleOwes = (id: string) => {
    setOwesIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const setSplitValue = (id: string, value: string) => {
    setSplitValues((prev) => ({ ...prev, [id]: value }));
  };

  const paidByName =
    members.find((m) => m.id === paidById)?.name ?? CURRENT_USER.name;

  const owesSummary =
    owesIds.length === members.length
      ? "Everyone"
      : owesIds.length === 0
      ? "Nobody"
      : owesIds
          .map((id) => members.find((m) => m.id === id)?.name)
          .filter(Boolean)
          .join(", ");

  const handleSave = () => {
    const patch: Partial<Payment> = {
      name: trimmedName,
      amount: numericAmount,
      paidBy: paidByName,
      paidById,
      owesIds,
      splitMethod,
      splitValues,
    };

    if (isEditing && existingPayment) {
      updatePayment(groupId, existingPayment.id, patch);
    } else {
      addPayment(groupId, {
        id: `p${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        name: trimmedName,
        paidBy: paidByName,
        amount: numericAmount,
        paidById,
        owesIds,
        splitMethod,
        splitValues,
      });
    }

    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-app-bg">
      <ScrollView contentContainerClassName="px-5 pt-16 pb-6 gap-4">
        <Text className="text-3xl font-bold text-app-text">
          {isEditing ? "Edit Payment" : "Add Payment"}
        </Text>

        <View className="bg-app-surface border border-app-border rounded-xl p-[14px] gap-[10px]">
          <View className="flex-row gap-2">
            <View className="flex-1 gap-1">
              <Text className="text-[13px] text-app-muted">Expense</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Groceries"
                placeholderTextColor="#7c90c6"
                className="bg-app-input border border-app-input-border rounded-[10px] px-3 py-[10px] text-app-text"
              />
            </View>
            <View className="w-[110px] gap-1">
              <Text className="text-[13px] text-app-muted">Amount</Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor="#7c90c6"
                keyboardType="decimal-pad"
                className="bg-app-input border border-app-input-border rounded-[10px] px-3 py-[10px] text-app-text text-right"
              />
            </View>
          </View>
        </View>

        <View className="bg-app-surface border border-app-border rounded-xl p-[14px] gap-[10px]">
          <Pressable
            onPress={() => toggleDropdown("paidBy")}
            className="flex-row items-center justify-between bg-app-card border border-app-border-soft rounded-[10px] py-[10px] px-3"
          >
            <View className="flex-1">
              <Text className="text-[13px] text-app-muted">Paid by</Text>
              <Text className="text-[15px] font-semibold text-app-text">
                {paidByName}
              </Text>
            </View>
            <Text className="text-app-muted">
              {openDropdown === "paidBy" ? "▲" : "▼"}
            </Text>
          </Pressable>

          {openDropdown === "paidBy" && (
            <View className="gap-1">
              {members.map((member) => {
                const isActive = member.id === paidById;
                return (
                  <Pressable
                    key={member.id}
                    onPress={() => {
                      setPaidById(member.id);
                      setOpenDropdown(null);
                    }}
                    className={`flex-row items-center justify-between rounded-[10px] py-[10px] px-3 border border-app-border-soft ${
                      isActive ? "bg-app-border-soft" : "bg-app-card"
                    }`}
                  >
                    <Text
                      className={`text-[15px] ${
                        isActive
                          ? "text-app-text font-semibold"
                          : "text-app-muted"
                      }`}
                    >
                      {member.name}
                    </Text>
                    {isActive && (
                      <Text className="text-app-text font-bold">✓</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}

          <Pressable
            onPress={() => toggleDropdown("splitBetween")}
            className="flex-row items-center justify-between bg-app-card border border-app-border-soft rounded-[10px] py-[10px] px-3"
          >
            <View className="flex-1 pr-2">
              <Text className="text-[13px] text-app-muted">Split between</Text>
              <Text
                numberOfLines={1}
                className="text-[15px] font-semibold text-app-text"
              >
                {owesSummary} ({owesIds.length})
              </Text>
            </View>
            <Text className="text-app-muted">
              {openDropdown === "splitBetween" ? "▲" : "▼"}
            </Text>
          </Pressable>

          {openDropdown === "splitBetween" && (
            <View className="gap-1">
              {members.map((member) => {
                const isSelected = owesIds.includes(member.id);
                return (
                  <Pressable
                    key={member.id}
                    onPress={() => toggleOwes(member.id)}
                    className={`flex-row items-center justify-between rounded-[10px] py-[10px] px-3 border border-app-border-soft ${
                      isSelected ? "bg-app-border-soft" : "bg-app-card"
                    }`}
                  >
                    <Text className="text-[15px] text-app-text">
                      {member.name}
                    </Text>
                    <View
                      className={`w-[22px] h-[22px] rounded-md border items-center justify-center ${
                        isSelected
                          ? "bg-white border-white"
                          : "bg-app-card border-app-input-border"
                      }`}
                    >
                      {isSelected && (
                        <Text className="font-bold text-app-border-soft">
                          ✓
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View className="bg-app-surface border border-app-border rounded-xl p-[14px] gap-[10px]">
          <Text className="text-base font-semibold text-app-text">
            Split method
          </Text>
          <View className="flex-row gap-2">
            {SPLIT_METHODS.map((method) => {
              const isActive = method === splitMethod;
              return (
                <Pressable
                  key={method}
                  onPress={() => setSplitMethod(method)}
                  className={`flex-1 rounded-[10px] border border-app-border-soft py-[10px] items-center ${
                    isActive ? "bg-app-border-soft" : "bg-app-card"
                  }`}
                >
                  <Text
                    className={`font-semibold capitalize ${
                      isActive ? "text-app-text" : "text-app-muted"
                    }`}
                  >
                    {method}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {splitMethod !== "equal" && owesIds.length > 0 && (
            <View className="gap-2 mt-1">
              <Text className="text-[13px] text-app-muted">
                {splitMethod === "percentage"
                  ? "Enter percentage per person"
                  : "Enter exact amount per person"}
              </Text>
              {owesIds.map((personId) => {
                const member = members.find((m) => m.id === personId);
                if (!member) return null;
                return (
                  <View
                    key={personId}
                    className="flex-row items-center justify-between bg-app-card border border-app-border-soft rounded-[10px] py-[6px] px-3"
                  >
                    <Text className="text-[15px] text-app-text">
                      {member.name}
                    </Text>
                    <TextInput
                      value={splitValues[personId] ?? ""}
                      onChangeText={(v) => setSplitValue(personId, v)}
                      placeholder={splitMethod === "percentage" ? "%" : "0.00"}
                      placeholderTextColor="#7c90c6"
                      keyboardType="decimal-pad"
                      className="bg-app-input border border-app-input-border rounded-md px-2 py-[4px] text-app-text w-[80px] text-right"
                    />
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View className="flex-row gap-3 mt-2">
          <Pressable
            onPress={() => router.back()}
            className="flex-1 rounded-[10px] py-3 items-center bg-app-cancel"
          >
            <Text className="text-app-text font-semibold">Cancel</Text>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            className={`flex-1 rounded-[10px] py-3 items-center ${
              canSave ? "bg-app-primary" : "bg-app-primary-dim"
            }`}
          >
            <Text className="text-app-text font-semibold">
              {isEditing ? "Confirm" : "Save"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
