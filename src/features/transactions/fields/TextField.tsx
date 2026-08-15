import Ionicons from '@expo/vector-icons/Ionicons';
import type { RefObject } from 'react';
import { TextInput, View } from 'react-native';
import { styles } from '../../../styles';
import { colors } from '../../../theme';

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  multiline,
  keyboardType,
  inputRef,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  multiline?: boolean;
  keyboardType?: 'decimal-pad' | 'number-pad';
  inputRef?: RefObject<TextInput | null>;
}) {
  return (
    <View style={styles.fieldGroup}>
      <View style={[styles.field, multiline && styles.multilineField]}>
        <Ionicons name={icon} size={20} color={colors.muted} />
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#A7A99F"
          style={[styles.input, multiline && styles.multilineInput]}
          multiline={multiline}
          keyboardType={keyboardType}
        />
      </View>
    </View>
  );
}
