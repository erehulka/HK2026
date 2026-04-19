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
      className={`rounded-[10px] border px-3 py-[10px] gap-2 ${
        isDisabled
          ? "bg-app-card border-app-border opacity-50"
          : "bg-app-card border-app-border-soft"
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
                  ? "bg-white border-white"
                  : "bg-app-card border-app-input-border"
              }`}
            >
              {isSelected && !isDisabled ? (
                <Text className="font-bold text-app-border-soft">✓</Text>
              ) : null}
            </Pressable>
          ) : null}
          <TextInput
            value={item.name}
            onChangeText={(value) => onNameChange?.(item.id, value)}
            editable
            placeholder="Item name"
            placeholderTextColor="#7c90c6"
            className="flex-1 bg-app-input border border-app-input-border rounded-[10px] px-3 py-[10px] text-app-text"
          />
          <TextInput
            value={item.priceInput}
            onChangeText={(value) => onPriceInputChange?.(item.id, value)}
            onBlur={() => onPriceBlur?.(item.id)}
            editable
            placeholder="0.00"
            placeholderTextColor="#7c90c6"
            keyboardType="decimal-pad"
            className="w-[110px] bg-app-input border border-app-input-border rounded-[10px] px-3 py-[10px] text-app-text text-right"
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
                  ? "bg-white border-white"
                  : "bg-app-card border-app-input-border"
              }`}
            >
              {isSelected && !isDisabled ? (
                <Text className="font-bold text-app-border-soft">✓</Text>
              ) : null}
            </Pressable>
          ) : null}
          <Text className="text-[15px] text-app-text flex-1">{item.name}</Text>
          <Text className="text-[14px] font-semibold text-app-text">{item.priceInput}</Text>
        </View>
      )}
      {isDisabled && showSelection ? (
        <Text className="text-xs text-app-muted">Already added to an expense</Text>
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
                  className="w-[84px] rounded-[10px] bg-app-danger items-center justify-center ml-2"
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
