import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Image, Modal, Platform, Pressable, Text, View } from 'react-native';
import { receiptFileSource } from '../../api';
import { DrawerSheet } from '../../components/DrawerSheet';
import { useDrawerTransition } from '../../components/useDrawerTransition';
import { styles } from '../../styles';
import { colors } from '../../theme';
import type { ApiReceipt } from '../../types';

export function ReceiptPreviewDrawer({
  receipt,
  webUri,
  loading,
  error,
  onLoad,
  onError,
  onClose,
}: {
  receipt: ApiReceipt | null;
  webUri: string | null;
  loading: boolean;
  error: boolean;
  onLoad: () => void;
  onError: () => void;
  onClose: () => void;
}) {
  const drawer = useDrawerTransition(receipt !== null, onClose);
  return (
    <Modal
      animationType="none"
      transparent
      visible={drawer.mounted}
      onShow={drawer.onShow}
      onRequestClose={drawer.dismiss}
    >
      <View style={styles.receiptPreviewBackdrop} testID="receipt-preview">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close receipt photo"
          style={styles.receiptPreviewScrim}
          onPress={drawer.dismiss}
        />
        <DrawerSheet
          visible={drawer.sheetVisible}
          onHidden={drawer.onHidden}
          style={styles.receiptPreviewCard}
        >
          <View style={styles.handle} />
          <View style={styles.receiptPreviewHeader}>
            <Text numberOfLines={1} style={styles.receiptPreviewTitle}>
              {receipt?.suggestion?.merchant || receipt?.filename}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close receipt photo"
              onPress={drawer.dismiss}
              style={styles.receiptPreviewClose}
            >
              <Ionicons name="close" size={24} color={colors.ink} />
            </Pressable>
          </View>
          {receipt?.mimeType.startsWith('image/') && (Platform.OS !== 'web' || webUri) ? (
            <Image
              accessibilityLabel={`Receipt photo ${receipt.filename}`}
              onError={onError}
              onLoad={onLoad}
              resizeMode="contain"
              source={Platform.OS === 'web' ? { uri: webUri ?? '' } : receiptFileSource(receipt.id)}
              style={styles.receiptPreviewImage}
            />
          ) : receipt && !receipt.mimeType.startsWith('image/') ? (
            <View style={styles.receiptPreviewUnavailable}>
              <Ionicons name="document-outline" size={38} color={colors.accent} />
              <Text style={styles.emptyScreenText}>
                Photo preview is unavailable for this file.
              </Text>
            </View>
          ) : null}
          {loading ? (
            <View style={styles.receiptPreviewStatus}>
              <ActivityIndicator color={colors.white} />
            </View>
          ) : null}
          {error ? (
            <View style={styles.receiptPreviewStatus}>
              <Ionicons name="image-outline" size={38} color={colors.white} />
              <Text style={styles.receiptPreviewErrorText}>Could not load this receipt photo.</Text>
            </View>
          ) : null}
        </DrawerSheet>
      </View>
    </Modal>
  );
}
