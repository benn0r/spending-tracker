import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { DrawerSheet } from '../../../components/DrawerSheet';
import { styles } from '../../../styles';
import { colors } from '../../../theme';
import type { ExpenseSplitSummary } from '../../../types';

export function ExpenseSplitPickerField({
  value,
  options,
  open,
  disabled,
  onRequestOpen,
  onChange,
  onDismiss,
}: {
  value: string;
  options: ExpenseSplitSummary[];
  open: boolean;
  disabled: boolean;
  onRequestOpen: () => void;
  onChange: (value: string) => void;
  onDismiss: () => void;
}) {
  const [closing, setClosing] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const selected = options.find(({ id }) => String(id) === value);
  const selectedLabel =
    value === '__new__' ? 'Create new split' : selected?.title || 'Choose split';
  const choices = [
    ...options.map((split) => ({
      value: String(split.id),
      label: split.title,
      detail: `${split.splitCount} people · ${split.transactionCount} transactions`,
    })),
    { value: '__new__', label: 'Create new split', detail: 'Start a new shared expense' },
  ];
  const dismiss = () => {
    setClosing(true);
    onDismiss();
  };
  const finishDismiss = () => {
    if (!open) {
      setClosing(false);
      setSheetVisible(false);
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Expense split"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onRequestOpen}
        style={({ pressed }) => [
          styles.expenseSplitPickerButton,
          disabled && styles.expenseSplitPickerDisabled,
          pressed && styles.categoryFieldPressed,
        ]}
      >
        <Text numberOfLines={1} style={styles.expenseSplitPickerText}>
          {selectedLabel}
        </Text>
        <Ionicons name="chevron-forward" size={17} color={colors.muted} />
      </Pressable>
      <Modal
        visible={open || closing}
        transparent
        animationType="none"
        onShow={() => setSheetVisible(true)}
        onRequestClose={dismiss}
      >
        <View
          style={styles.nestedModalRoot}
          pointerEvents={open ? 'auto' : 'none'}
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close expense split picker"
            style={styles.nestedScrim}
            onPress={dismiss}
          />
          <DrawerSheet
            visible={open && sheetVisible}
            onHidden={finishDismiss}
            style={styles.expenseSplitSheet}
            testID="expense-split-sheet"
          >
            <View style={styles.handle} />
            <View style={styles.categorySheetHeader}>
              <View>
                <Text style={styles.categorySheetTitle}>Split this expense</Text>
                <Text style={styles.categorySheetSubtitle}>
                  Add it to an existing split or create a new one.
                </Text>
              </View>
            </View>
            <FlatList
              data={choices}
              keyExtractor={(item) => item.value}
              contentContainerStyle={styles.expenseSplitList}
              renderItem={({ item }) => {
                const active = value === item.value;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityLabel={
                      item.value === '__new__'
                        ? item.label
                        : `${item.label} · ${options.find(({ id }) => String(id) === item.value)?.splitCount} people`
                    }
                    accessibilityState={{ checked: active }}
                    onPress={() => {
                      onChange(item.value);
                      dismiss();
                    }}
                    style={({ pressed }) => [
                      styles.expenseSplitOption,
                      active && styles.expenseSplitOptionActive,
                      pressed && styles.categoryFieldPressed,
                    ]}
                  >
                    <View style={styles.expenseSplitOptionIcon}>
                      <Ionicons
                        name={item.value === '__new__' ? 'add' : 'people-outline'}
                        size={20}
                        color={colors.accentDark}
                      />
                    </View>
                    <View style={styles.expenseSplitOptionCopy}>
                      <Text style={styles.expenseSplitOptionTitle}>{item.label}</Text>
                      <Text style={styles.expenseSplitOptionDetail}>{item.detail}</Text>
                    </View>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                    )}
                  </Pressable>
                );
              }}
            />
          </DrawerSheet>
        </View>
      </Modal>
    </>
  );
}
