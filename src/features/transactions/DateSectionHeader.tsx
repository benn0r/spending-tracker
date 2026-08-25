import { useEffect, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Animated, Easing, Text, View } from 'react-native';

import { GlassBackground } from '../../components/GlassBackground';
import { styles } from '../../styles';
import { nativeDeviceLocale } from '../../device-locale';
import { formatCurrency, formatDateHeader } from '../../transactions';

export function DateSectionHeader({
  date,
  total,
  flushTop = false,
  sticky = false,
  elevated = false,
  animateContent = false,
  animationDirection = 1,
  topInset = 0,
  onLayout,
}: {
  date: string;
  total: number;
  flushTop?: boolean;
  sticky?: boolean;
  elevated?: boolean;
  animateContent?: boolean;
  animationDirection?: 1 | -1;
  topInset?: number;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  return (
    <View
      onLayout={onLayout}
      style={[
        styles.dateSectionHeader,
        flushTop && styles.dateSectionHeaderFlushTop,
        sticky && styles.stickyDateSectionHeader,
        elevated && styles.glassDateSectionHeader,
        topInset > 0 && { paddingTop: 24 + topInset },
      ]}
    >
      <View
        pointerEvents="none"
        style={[styles.elevatedDateSectionHeaderOverlay, { opacity: elevated ? 1 : 0 }]}
        testID="sticky-date-effect"
      >
        <GlassBackground
          effectStyle="regular"
          intensity={68}
          showHighlight={false}
          tintColor="rgba(255, 255, 255, 0.12)"
        />
        <View pointerEvents="none" style={styles.stickyDateGlassTopMask} />
      </View>
      <DateSectionHeaderContent
        key={animateContent ? date : 'static'}
        date={date}
        total={total}
        animate={animateContent}
        direction={animationDirection}
      />
    </View>
  );
}

function DateSectionHeaderContent({
  date,
  total,
  animate,
  direction,
}: {
  date: string;
  total: number;
  animate: boolean;
  direction: 1 | -1;
}) {
  const [progress] = useState(() => new Animated.Value(animate ? 0 : 1));

  useEffect(() => {
    if (!animate) return;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 70,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [animate, progress]);

  return (
    <Animated.View
      style={[
        styles.dateSectionHeaderContent,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [12 * direction, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Text style={styles.dateSectionTitle}>
        {formatDateHeader(date, new Date(), nativeDeviceLocale())}
      </Text>
      <Text style={[styles.amount, styles.dateSectionAmount]}>{formatCurrency(total)}</Text>
    </Animated.View>
  );
}
