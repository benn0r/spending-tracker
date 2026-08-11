import Ionicons from '@expo/vector-icons/Ionicons';
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import { Animated, Easing, Modal, PanResponder, Pressable, Text, View } from 'react-native';

import { styles } from '../styles';
import { colors } from '../theme';

const SwipeContext = createContext<{
  closeVersion: number;
  openId: string | null;
  setOpenId: (id: string | null) => void;
}>({ closeVersion: 0, openId: null, setOpenId: () => undefined });

export function SwipeProvider({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [closeVersion, setCloseVersion] = useState(0);
  return (
    <SwipeContext.Provider value={{ closeVersion, openId, setOpenId }}>
      <View
        testID="swipe-dismiss-area"
        onTouchStart={() => {
          setOpenId(null);
          setCloseVersion((current) => current + 1);
        }}
        style={styles.swipeProvider}
      >
        {children}
      </View>
    </SwipeContext.Provider>
  );
}

export function SwipeToDelete({
  id,
  children,
  label,
  bordered = false,
  revealSpacing = 0,
  onDelete,
}: {
  id: string;
  children: ReactNode;
  label: string;
  bordered?: boolean;
  revealSpacing?: number;
  onDelete: () => void;
}) {
  const { closeVersion, openId, setOpenId } = useContext(SwipeContext);
  const [offset] = useState(() => new Animated.Value(0));
  const [confirming, setConfirming] = useState(false);
  const isOpen = openId === id;
  const revealDistance = 82 + revealSpacing;
  const translateX = offset.interpolate({
    inputRange: [-revealDistance, 0],
    outputRange: [-revealDistance, 0],
    extrapolate: 'clamp',
  });
  const settle = (open: boolean) => {
    setOpenId(open ? id : null);
    Animated.timing(offset, {
      toValue: open ? -revealDistance : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };
  useEffect(() => {
    if (!isOpen)
      Animated.timing(offset, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
  }, [isOpen, offset]);
  useEffect(() => {
    Animated.timing(offset, {
      toValue: 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [closeVersion, offset]);
  const [responder] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 5 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.15,
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        Math.abs(gesture.dx) > 5 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.15,
      onPanResponderGrant: () => {
        setOpenId(id);
        offset.stopAnimation();
        offset.extractOffset();
      },
      onPanResponderMove: (_, gesture) => {
        offset.setValue(gesture.dx);
        if (gesture.dx < -10) setOpenId(id);
        if (gesture.dx > 10) setOpenId(null);
      },
      onPanResponderRelease: (_, gesture) => {
        offset.flattenOffset();
        const open = gesture.vx < -0.25 || gesture.dx < -36;
        settle(open);
      },
      onPanResponderTerminate: (_, gesture) => {
        offset.flattenOffset();
        settle(gesture.dx < -36);
      },
      onPanResponderTerminationRequest: () => false,
    }),
  );
  return (
    <View
      style={[
        styles.swipeContainer,
        bordered && styles.borderedSwipeContainer,
        isOpen && styles.openSwipeContainer,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Delete ${label}`}
        onPress={() => setConfirming(true)}
        style={styles.swipeDeleteButton}
      >
        <Ionicons name="trash-outline" size={22} color={colors.white} />
        <Text style={styles.swipeDeleteText}>Delete</Text>
      </Pressable>
      <Animated.View
        {...responder.panHandlers}
        style={[
          styles.swipeForeground,
          bordered && styles.borderedSwipeForeground,
          { transform: [{ translateX }] },
        ]}
      >
        {children}
        {revealSpacing > 0 ? (
          <View
            pointerEvents="none"
            style={[styles.swipeRevealSpacer, { right: -revealSpacing, width: revealSpacing }]}
          />
        ) : null}
      </Animated.View>
      <Modal
        transparent
        animationType="fade"
        visible={confirming}
        onRequestClose={() => setConfirming(false)}
      >
        <View style={styles.deleteConfirmBackdrop}>
          <View style={styles.deleteConfirmCard}>
            <View style={styles.deleteConfirmIcon}>
              <Ionicons name="trash-outline" size={24} color="#D84A4A" />
            </View>
            <Text style={styles.deleteConfirmTitle}>Delete {label}?</Text>
            <Text style={styles.deleteConfirmText}>This action cannot be undone.</Text>
            <View style={styles.deleteConfirmActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel delete"
                onPress={() => setConfirming(false)}
                style={styles.deleteCancelButton}
              >
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Confirm delete ${label}`}
                onPress={() => {
                  setConfirming(false);
                  setOpenId(null);
                  onDelete();
                }}
                style={styles.deleteConfirmButton}
              >
                <Text style={styles.deleteConfirmButtonText}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
