import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Animated, Dimensions, Easing, type StyleProp, type ViewStyle } from 'react-native';

export function DrawerSheet({
  children,
  style,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const [translateY] = useState(() => new Animated.Value(Dimensions.get('window').height));

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: 0,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  return (
    <Animated.View style={[style, { transform: [{ translateY }] }]} testID={testID}>
      {children}
    </Animated.View>
  );
}
