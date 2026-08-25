import Ionicons from '@expo/vector-icons/Ionicons';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { DrawerSheet } from '../../../components/DrawerSheet';
import { useDrawerTransition } from '../../../components/useDrawerTransition';
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
  const drawer = useDrawerTransition(open, onDismiss);
  const selected = options.find(({ id }) => String(id) === value);
  const selectedLabel =
    value === '__new__' ? 'Create shared expense' : selected?.title || 'Choose shared expense';
  const choices = [
    ...options.map((split) => ({
      value: String(split.id),
      label: split.title,
      detail: `${split.splitCount} people · ${split.transactionCount} transactions`,
    })),
    { value: '__new__', label: 'Create shared expense', detail: 'Start a new shared expense' },
  ];
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Shared expense"
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
        visible={drawer.mounted}
        transparent
        animationType="none"
        onShow={drawer.onShow}
        onRequestClose={drawer.dismiss}
      >
        <View
          style={styles.nestedModalRoot}
          pointerEvents={open ? 'auto' : 'none'}
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close shared expenses"
            style={styles.nestedScrim}
            onPress={drawer.dismiss}
          />
          <DrawerSheet
            visible={drawer.sheetVisible}
            onHidden={drawer.onHidden}
            onPullDown={drawer.dismiss}
            style={styles.expenseSplitSheet}
            testID="expense-split-sheet"
          >
            <View style={styles.handle} />
            <View style={styles.categorySheetHeader}>
              <View>
                <Text style={styles.categorySheetTitle}>Shared expenses</Text>
                <Text style={styles.categorySheetSubtitle}>
                  Add this transaction to an existing shared expense or create a new one.
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
                      drawer.dismiss();
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
