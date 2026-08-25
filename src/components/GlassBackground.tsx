import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { StyleProp, ViewStyle } from 'react-native';
import { Platform, StyleSheet, View } from 'react-native';

export function GlassBackground({
  intensity = 72,
  interactive = false,
  effectStyle = 'regular',
  tintColor = 'rgba(255, 255, 255, 0.42)',
  showHighlight = true,
  style,
}: {
  intensity?: number;
  interactive?: boolean;
  effectStyle?: 'clear' | 'regular';
  tintColor?: string;
  showHighlight?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const supportsNativeLiquidGlass =
    Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

  if (supportsNativeLiquidGlass) {
    return (
      <GlassView
        colorScheme="light"
        glassEffectStyle={effectStyle}
        isInteractive={interactive}
        tintColor={tintColor}
        style={[StyleSheet.absoluteFill, style]}
        testID="glass-background"
      />
    );
  }

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]} testID="glass-background">
      <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: tintColor }]} />
      {showHighlight ? <View style={styles.highlight} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  highlight: {
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
});
