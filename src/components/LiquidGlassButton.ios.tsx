import { Button, Host, HStack, Image, Text } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  foregroundStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { LiquidGlassButtonProps } from './LiquidGlassButton';

export function LiquidGlassButton({
  label,
  accessibilityLabel: accessibleLabel = label,
  systemImage,
  compact = false,
  prominent = false,
  destructive = false,
  onPress,
}: LiquidGlassButtonProps) {
  const handlePress = () => setTimeout(onPress, 0);
  const modifiers = [
    buttonStyle(prominent ? 'glassProminent' : 'glass'),
    buttonBorderShape(compact ? 'circle' : 'capsule'),
    controlSize(compact ? 'large' : 'extraLarge'),
    tint(prominent ? '#77409A' : destructive ? '#D84A4A' : '#FFFFFF'),
    accessibilityLabel(accessibleLabel),
  ];
  return (
    <Host style={{ width: compact ? 42 : '100%', height: compact ? 42 : 48 }}>
      {compact ? (
        <Button onPress={handlePress} modifiers={modifiers}>
          <Image
            systemName={systemImage as SFSymbol}
            size={19}
            color={destructive ? '#D84A4A' : '#2D2631'}
          />
        </Button>
      ) : prominent ? (
        <Button
          label={label}
          systemImage={systemImage as SFSymbol}
          onPress={handlePress}
          modifiers={modifiers}
        />
      ) : (
        <Button onPress={handlePress} modifiers={modifiers}>
          <HStack spacing={7} alignment="center">
            <Image
              systemName={systemImage as SFSymbol}
              size={17}
              color={destructive ? '#D84A4A' : '#2D2631'}
            />
            <Text modifiers={[foregroundStyle(destructive ? '#D84A4A' : '#2D2631')]}>{label}</Text>
          </HStack>
        </Button>
      )}
    </Host>
  );
}
