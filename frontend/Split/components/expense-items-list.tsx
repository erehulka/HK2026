import { Pressable, Text, TextInput, View } from "react-native";
import Swipeable from "react-native-gesture-handler/Swipeable";

export type ExpenseItemsListItem = {
  id: string;
  name: string;
  priceInput: string;
  isDisabled?: boolean;
};

type ExpenseItemsListProps = {
  items: ExpenseItemsListItem[];
  showSelection?: boolean;
  selectedItemIds?: string[];
  onToggleSelection?: (itemId: string) => void;
  editable?: boolean;
  onNameChange?: (itemId: string, value: string) => void;
  onPriceInputChange?: (itemId: string, value: string) => void;
  onPriceBlur?: (itemId: string) => void;
  enableSwipeDelete?: boolean;
  onDelete?: (itemId: string) => void;
};

export function ExpenseItemsList({
  items,
  showSelection = false,
  selectedItemIds = [],
  onToggleSelection,
  editable = false,
  onNameChange,
  onPriceInputChange,
  onPriceBlur,
  enableSwipeDelete = false,
  onDelete,
}: ExpenseItemsListProps) {
  const renderRow = (
    item: ExpenseItemsListItem,
    isSelected: boolean,
    isDisabled: boolean,
    canEdit: boolean
  ) => (
    <View
      className={`rounded-[14px] border px-3 py-[10px] gap-2 ${
        isDisabled
          ? "bg-[#171a20] border-white/8 opacity-55"
          : "bg-[#171a20] border-white/8"
      }`}
    >
      {canEdit ? (
        <View className="flex-row items-center gap-2">
          {showSelection ? (
            <Pressable
              onPress={() => {
                if (!isDisabled && onToggleSelection) onToggleSelection(item.id);
              }}
              className={`w-[22px] h-[22px] rounded-md border items-center justify-center ${
                isSelected && !isDisabled
                  ? "bg-sky-400 border-sky-400"
                  : "bg-transparent border-[#475264]"
              }`}
            >
              {isSelected && !isDisabled ? (
                <Text className="font-bold text-[#0f1115]">✓</Text>
              ) : null}
            </Pressable>
          ) : null}
          <TextInput
            value={item.name}
            onChangeText={(value) => onNameChange?.(item.id, value)}
            editable
            placeholder="Item name"
            placeholderTextColor="#9aa1ad"
            className="flex-1 rounded-[10px] border border-white/5 bg-[#2a3038] px-3 py-[10px] text-white"
          />
          <TextInput
            value={item.priceInput}
            onChangeText={(value) => onPriceInputChange?.(item.id, value)}
            onBlur={() => onPriceBlur?.(item.id)}
            editable
            placeholder="0.00"
            placeholderTextColor="#9aa1ad"
            keyboardType="decimal-pad"
            className="w-[92px] rounded-[10px] border border-white/5 bg-[#2a3038] px-3 py-[10px] text-right text-white"
          />
        </View>
      ) : (
        <View className="flex-row items-center gap-2">
          {showSelection ? (
            <Pressable
              onPress={() => {
                if (!isDisabled && onToggleSelection) onToggleSelection(item.id);
              }}
              className={`w-[22px] h-[22px] rounded-md border items-center justify-center ${
                isSelected && !isDisabled
                  ? "bg-sky-400 border-sky-400"
                  : "bg-transparent border-[#475264]"
              }`}
            >
              {isSelected && !isDisabled ? (
                <Text className="font-bold text-[#0f1115]">✓</Text>
              ) : null}
            </Pressable>
          ) : null}
          <Text className="flex-1 text-[15px] text-white/95">{item.name}</Text>
          <Text className="text-[14px] font-semibold text-white/95">{item.priceInput}</Text>
        </View>
      )}
      {isDisabled && showSelection ? (
        <Text className="text-xs text-white/45">Already added to an expense</Text>
      ) : null}
    </View>
  );

  return (
    <View className="gap-2">
      {items.map((item) => {
        const isSelected = selectedItemIds.includes(item.id);
        const isDisabled = !!item.isDisabled;
        const canEdit = editable && !isDisabled;

        if (enableSwipeDelete && onDelete && !isDisabled) {
          return (
            <Swipeable
              key={item.id}
              renderRightActions={() => (
                <Pressable
                  onPress={() => onDelete(item.id)}
                  className="ml-2 w-[84px] items-center justify-center rounded-[12px] bg-rose-600"
                >
                  <Text className="text-white font-semibold">Delete</Text>
                </Pressable>
              )}
            >
              {renderRow(item, isSelected, isDisabled, canEdit)}
            </Swipeable>
          );
        }

        return (
          <View key={item.id}>{renderRow(item, isSelected, isDisabled, canEdit)}</View>
        );
      })}
    </View>
  );
}
