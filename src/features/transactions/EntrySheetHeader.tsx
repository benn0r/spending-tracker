import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { styles } from '../../styles';
import { colors } from '../../theme';
import type { EntryMode } from '../../types';

export function EntrySheetHeader({
  editing,
  mode,
  onModeChange,
}: {
  editing: boolean;
  mode: EntryMode;
  onModeChange: (mode: EntryMode) => void;
}) {
  return (
    <View style={styles.sheetHeading}>
      <View style={styles.sheetTitleGroup}>
        <View style={styles.sheetTitleIcon}>
          <Ionicons name="card-outline" size={20} color={colors.accent} />
        </View>
        <Text style={styles.sheetTitle}>{editing ? 'Edit transaction' : 'New transaction'}</Text>
      </View>
      <View style={styles.sheetHeadingActions}>
        <View accessibilityRole="tablist" style={styles.modeToggle}>
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel="Transaction"
            accessibilityState={{ selected: mode === 'transaction' }}
            onPress={() => onModeChange('transaction')}
            style={[styles.modeButton, mode === 'transaction' && styles.activeModeButton]}
          >
            <Ionicons
              name="receipt-outline"
              size={18}
              color={mode === 'transaction' ? colors.white : colors.muted}
            />
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel="Split transaction"
            accessibilityState={{ selected: mode === 'split' }}
            onPress={() => onModeChange('split')}
            style={[styles.modeButton, mode === 'split' && styles.activeModeButton]}
          >
            <Ionicons
              name="git-branch-outline"
              size={18}
              color={mode === 'split' ? colors.white : colors.muted}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
