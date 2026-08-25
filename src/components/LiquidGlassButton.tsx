import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, Text } from 'react-native';

import { colors } from '../theme';
import { GlassBackground } from './GlassBackground';

export type LiquidGlassButtonProps = {
  label: string;
  accessibilityLabel?: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  systemImage: string;
  compact?: boolean;
  prominent?: boolean;
  destructive?: boolean;
  onPress: () => void;
};

export function LiquidGlassButton({
  label,
  accessibilityLabel = label,
  icon,
  compact = false,
  prominent = false,
  destructive = false,
  onPress,
}: LiquidGlassButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({
        width: compact ? 42 : '100%',
        height: compact ? 42 : 48,
        borderRadius: compact ? 21 : 24,
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        opacity: pressed ? 0.82 : 1,
      })}
    >
      <GlassBackground
        interactive
        intensity={62}
        tintColor={
          prominent
            ? 'rgba(119, 64, 154, 0.72)'
            : destructive
              ? 'rgba(216, 74, 74, 0.18)'
              : 'rgba(255, 255, 255, 0.58)'
        }
      />
      <Ionicons
        name={icon}
        size={compact ? 21 : 18}
        color={prominent ? colors.white : destructive ? '#D84A4A' : colors.ink}
      />
      {compact ? null : (
        <Text
          style={{
            color: prominent ? colors.white : destructive ? '#D84A4A' : colors.ink,
            fontWeight: '800',
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
