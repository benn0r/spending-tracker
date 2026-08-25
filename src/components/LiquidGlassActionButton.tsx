import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';

import { colors } from '../theme';
import { GlassBackground } from './GlassBackground';

export type LiquidGlassActionButtonProps = {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  systemImage: string;
  size: 50 | 64;
  prominent?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
};

export function LiquidGlassActionButton({
  label,
  icon,
  size,
  prominent = false,
  disabled = false,
  loading = false,
  onPress,
}: LiquidGlassActionButtonProps) {
  const tintColor = prominent ? 'rgba(119, 64, 154, 0.72)' : 'rgba(255, 255, 255, 0.58)';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.82 : 1,
        transform: [{ scale: pressed ? 0.96 : 1 }],
      })}
    >
      <GlassBackground interactive intensity={58} tintColor={tintColor} />
      {loading ? (
        <ActivityIndicator color={prominent ? colors.white : colors.accent} />
      ) : (
        <Ionicons
          name={icon}
          size={prominent ? 32 : 25}
          color={prominent ? colors.white : colors.accent}
        />
      )}
    </Pressable>
  );
}
