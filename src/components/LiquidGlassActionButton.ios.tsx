import { Button, Host, Image } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  frame,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';

import type { LiquidGlassActionButtonProps } from './LiquidGlassActionButton';

export function LiquidGlassActionButton({
  label,
  systemImage,
  size,
  prominent = false,
  disabled = false,
  loading = false,
  onPress,
}: LiquidGlassActionButtonProps) {
  return (
    <Host style={{ width: size, height: size }}>
      <Button
        onPress={onPress}
        modifiers={[
          buttonStyle(prominent ? 'glassProminent' : 'glass'),
          buttonBorderShape('circle'),
          controlSize('extraLarge'),
          tint(prominent ? '#77409A' : '#FFFFFF'),
          accessibilityLabel(label),
          disabledModifier(disabled),
        ]}
      >
        <Image
          systemName={(loading ? 'hourglass' : systemImage) as SFSymbol}
          size={prominent ? 27 : 22}
          color={prominent ? '#FFFFFF' : '#77409A'}
          modifiers={[frame({ width: size - 24, height: size - 24 })]}
        />
      </Button>
    </Host>
  );
}
