import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { GlassBackground } from './GlassBackground';

export function DrawerSheet({
  children,
  style,
  testID,
  visible = true,
  onHidden,
  delay = 0,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  visible?: boolean;
  onHidden?: () => void;
  delay?: number;
}) {
  const [translateY] = useState(() => new Animated.Value(Dimensions.get('window').height));
  const onHiddenRef = useRef(onHidden);

  useEffect(() => {
    onHiddenRef.current = onHidden;
  }, [onHidden]);

  useEffect(() => {
    translateY.stopAnimation();
    if (visible) translateY.setValue(Dimensions.get('window').height);
    Animated.timing(translateY, {
      toValue: visible ? 0 : Dimensions.get('window').height,
      duration: 200,
      delay: visible ? delay : 0,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) onHiddenRef.current?.();
    });
  }, [delay, translateY, visible]);

  return (
    <Animated.View style={[style, { transform: [{ translateY }] }]} testID={testID}>
      <GlassBackground intensity={76} tintColor="rgba(255, 255, 255, 0.5)" />
      {children}
    </Animated.View>
  );
}
