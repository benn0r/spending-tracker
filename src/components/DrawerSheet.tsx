import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { GlassBackground } from './GlassBackground';

export function DrawerSheet({
  children,
  style,
  testID,
  visible = true,
  onHidden,
  onPullDown,
  delay = 0,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  visible?: boolean;
  onHidden?: () => void;
  onPullDown?: () => void;
  delay?: number;
}) {
  const [translateY] = useState(() => new Animated.Value(Dimensions.get('window').height));
  const onHiddenRef = useRef(onHidden);

  useEffect(() => {
    onHiddenRef.current = onHidden;
  }, [onHidden]);

  const pullDownGesture = useMemo(
    () =>
      Gesture.Pan()
        .withTestId(`${testID ?? 'drawer'}-pull-down`)
        .enabled(Boolean(onPullDown))
        .activeOffsetY(8)
        .failOffsetX([-24, 24])
        .runOnJS(true)
        .onBegin(() => translateY.stopAnimation())
        .onUpdate(({ translationY }) => translateY.setValue(Math.max(0, translationY)))
        .onEnd(({ translationY, velocityY }) => {
          if (translationY > 72 || velocityY > 850) {
            onPullDown?.();
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            speed: 24,
            bounciness: 4,
            useNativeDriver: true,
          }).start();
        }),
    [onPullDown, testID, translateY],
  );

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
    <GestureDetector gesture={pullDownGesture}>
      <Animated.View style={[style, { transform: [{ translateY }] }]} testID={testID}>
        <GlassBackground intensity={76} tintColor="rgba(255, 255, 255, 0.5)" />
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
