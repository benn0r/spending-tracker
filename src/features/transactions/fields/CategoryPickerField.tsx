import Ionicons from '@expo/vector-icons/Ionicons';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { styles } from '../../../styles';
import { colors } from '../../../theme';
import type { CategoryReference } from '../../../types';
import { categoryVisual } from '../../categories/categoryVisual';
import { DrawerSheet } from '../../../components/DrawerSheet';

export function CategoryPickerField({
  value,
  options,
  onChange,
  open,
  onRequestOpen,
  onDismiss,
  accessibilityLabel = 'Select category',
}: {
  value: string;
  options: CategoryReference[];
  onChange: (value: string) => void;
  open: boolean;
  onRequestOpen: () => void;
  onDismiss: () => void;
  accessibilityLabel?: string;
}) {
  const selected = options.find(({ id }) => id === value);
  return (
    <View style={styles.fieldGroup}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onRequestOpen}
        style={({ pressed }) => [styles.categoryField, pressed && styles.categoryFieldPressed]}
      >
        {selected ? (
          <View style={styles.categoryFieldSelection}>
            <View style={styles.categoryFieldIcon}>
              <Ionicons
                name={categoryVisual(selected, options.indexOf(selected)).icon}
                size={19}
                color={categoryVisual(selected, options.indexOf(selected)).color}
              />
            </View>
            <Text style={styles.categoryFieldText}>{selected.name}</Text>
          </View>
        ) : (
          <View style={styles.categoryFieldSelection}>
            <Ionicons name="grid-outline" size={20} color={colors.muted} />
            <Text style={styles.categoryPlaceholder}>Choose a category</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={onDismiss}>
        <View style={styles.nestedModalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close category picker"
            style={styles.nestedScrim}
            onPress={onDismiss}
          />
          <DrawerSheet style={styles.categorySheet} testID="category-sheet">
            <View style={styles.handle} />
            <View style={styles.categorySheetHeader}>
              <View>
                <Text style={styles.categorySheetTitle}>Transaction category</Text>
                <Text style={styles.categorySheetSubtitle}>
                  Choose from categories enabled on the server.
                </Text>
              </View>
            </View>
            <FlatList
              data={options}
              keyExtractor={({ id }) => id}
              numColumns={3}
              contentContainerStyle={styles.categoryGrid}
              columnWrapperStyle={styles.categoryGridRow}
              ListEmptyComponent={
                <Text style={styles.categoryEmpty}>No categories are enabled on the server.</Text>
              }
              renderItem={({ item, index }) => {
                const visual = categoryVisual(item, index);
                const active = value === item.id;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    aria-checked={active}
                    onPress={() => {
                      onChange(item.id);
                      onDismiss();
                    }}
                    style={styles.categoryTile}
                  >
                    <View
                      style={[styles.categoryTileIcon, active && styles.activeCategoryTileIcon]}
                    >
                      <Ionicons name={visual.icon} size={29} color={visual.color} />
                      {active ? (
                        <View style={styles.categoryCheckBadge}>
                          <Ionicons name="checkmark" size={12} color={colors.white} />
                        </View>
                      ) : null}
                    </View>
                    <Text
                      numberOfLines={2}
                      style={[styles.categoryTileText, active && styles.activeCategoryTileText]}
                    >
                      {item.name}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </DrawerSheet>
        </View>
      </Modal>
    </View>
  );
}
