import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useEffect, useState } from 'react';
import { Animated, Pressable, Text, useWindowDimensions, View } from 'react-native';

import { styles } from '../../styles';
import { colors } from '../../theme';

export type MorePage = 'shared' | 'receipts';

export function MoreNavigator({
  selected,
  receiptCount,
  onSelect,
  leaving = false,
  onExitComplete,
  children,
}: {
  selected: MorePage | null;
  receiptCount: number;
  onSelect: (page: MorePage) => void;
  leaving?: boolean;
  onExitComplete?: () => void;
  children: ReactNode;
}) {
  const [slide] = useState(() => new Animated.Value(0));
  const [entering, setEntering] = useState(selected !== null);
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (!selected) return;
    slide.setValue(1);
    Animated.timing(slide, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setEntering(false);
    });
  }, [selected, slide]);

  useEffect(() => {
    if (!leaving) return;
    Animated.timing(slide, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onExitComplete?.();
    });
  }, [leaving, onExitComplete, slide]);

  if (selected) {
    if (!entering && !leaving) {
      return (
        <View testID="more-detail-page" style={styles.moreDetailPage}>
          {children}
        </View>
      );
    }
    return (
      <Animated.View
        testID="more-detail-page"
        style={[
          styles.moreDetailPage,
          {
            transform: [
              {
                translateX: slide.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, width],
                }),
              },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    );
  }

  return (
    <View style={styles.moreScreen}>
      <View style={styles.secondaryHeader}>
        <Text style={styles.secondaryEyebrow}>EXPLORE</Text>
        <Text style={styles.secondaryTitle}>More</Text>
      </View>
      <View style={styles.moreMenu}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Shared expenses"
          onPress={() => onSelect('shared')}
          style={styles.moreMenuItem}
        >
          <View style={styles.moreMenuIcon}>
            <Ionicons name="people-outline" size={21} color={colors.accent} />
          </View>
          <View style={styles.transactionCopy}>
            <Text style={styles.moreMenuTitle}>Shared expenses</Text>
            <Text style={styles.moreMenuDescription}>Balances and shared transactions</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Receipts"
          onPress={() => onSelect('receipts')}
          style={styles.moreMenuItem}
        >
          <View style={styles.moreMenuIcon}>
            <Ionicons name="receipt-outline" size={21} color={colors.accent} />
            {receiptCount > 0 ? (
              <View style={styles.moreMenuBadge}>
                <Text style={styles.receiptBadgeText}>
                  {receiptCount > 99 ? '99+' : receiptCount}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.transactionCopy}>
            <Text style={styles.moreMenuTitle}>Receipts</Text>
            <Text style={styles.moreMenuDescription}>Scan and review documents</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}
