import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import { styles } from '../styles';
import { colors } from '../theme';
import type { Reference } from '../types';

export function AccountDropdown({
  value,
  options,
  onChange,
  label = 'Default account',
  hint = 'Preselected for every new expense',
  accessibilityLabel = 'Select default account',
  variant = 'default',
}: {
  value: string;
  options: Reference[];
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
  accessibilityLabel?: string;
  variant?: 'default' | 'header';
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(({ id }) => id === value);
  return (
    <View style={variant === 'header' ? styles.headerAccountDropdown : undefined}>
      {variant === 'default' ? <Text style={styles.settingsLabel}>{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => setOpen(true)}
        style={variant === 'header' ? styles.headerAccountSelect : styles.settingsSelect}
      >
        {variant === 'header' ? (
          <>
            <Text style={styles.headerAccountValue} numberOfLines={1}>
              {selected?.name ?? 'Choose an account'}
            </Text>
            <Ionicons name="chevron-down" size={22} color={colors.ink} />
          </>
        ) : (
          <>
            <View style={styles.settingsSelectCopy}>
              <View style={styles.settingsSelectIcon}>
                <Ionicons name="wallet-outline" size={21} color={colors.accent} />
              </View>
              <View>
                <Text style={styles.settingsSelectValue}>
                  {selected?.name ?? 'Choose an account'}
                </Text>
                <Text style={styles.settingsSelectHint}>{hint}</Text>
              </View>
            </View>
          </>
        )}
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.nestedModalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close account selector"
            style={styles.nestedScrim}
            onPress={() => setOpen(false)}
          />
          <View style={styles.accountSheet} testID="account-sheet">
            <View style={styles.handle} />
            <Text style={styles.categorySheetTitle}>{label}</Text>
            <Text style={styles.categorySheetSubtitle}>
              Choose from accounts enabled on the server.
            </Text>
            <ScrollView contentContainerStyle={styles.accountOptions}>
              {options.map((option) => {
                const active = option.id === value;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    aria-checked={active}
                    onPress={() => {
                      onChange(option.id);
                      setOpen(false);
                    }}
                    style={[styles.accountOption, active && styles.activeAccountOption]}
                  >
                    <View style={styles.accountOptionIcon}>
                      <Ionicons name="card-outline" size={20} color={colors.accent} />
                    </View>
                    <Text
                      style={[styles.accountOptionText, active && styles.activeAccountOptionText]}
                    >
                      {option.name}
                    </Text>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                    ) : null}
                  </Pressable>
                );
              })}
              {!options.length ? (
                <Text style={styles.categoryEmpty}>No accounts are enabled on the server.</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
