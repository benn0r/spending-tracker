import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { loadReceiptFile, receiptFileSource, uploadReceipt } from '../../api';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { DrawerSheet } from '../../components/DrawerSheet';
import { useDrawerTransition } from '../../components/useDrawerTransition';
import { styles } from '../../styles';
import { colors } from '../../theme';
import type {
  ApiReceipt,
  CategoryReference,
  DraftTransaction,
  EntryMode,
  Reference,
} from '../../types';
import { prepareReceiptDraft } from '../../app-model';
import { DateSectionHeader } from '../transactions/DateSectionHeader';

function receiptItemGroups(receipt: ApiReceipt, categories: CategoryReference[]) {
  const suggestion = receipt.suggestion;
  if (!suggestion) return [];
  const categoryNames = new Map(categories.map(({ id, name }) => [id, name]));
  const groups = new Map<
    string,
    { id: string; name: string; total: number; items: typeof suggestion.items }
  >();
  for (const item of suggestion.items) {
    const id = item.category || suggestion.category || 'uncategorized';
    const group = groups.get(id) ?? {
      id,
      name: categoryNames.get(id) ?? 'Uncategorized',
      total: 0,
      items: [],
    };
    group.items.push(item);
    group.total += item.totalAmount;
    groups.set(id, group);
  }
  return [...groups.values()];
}

function receiptAmount(currency: string, amount: number) {
  return `${currency} ${Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ReceiptsScreen({
  receipts,
  loading,
  refresh,
  accounts,
  categories,
  tags,
  defaultAccount,
  onAdd,
  onDelete,
  onBack,
}: {
  receipts: ApiReceipt[];
  loading: boolean;
  refresh: () => Promise<void>;
  accounts: Reference[];
  categories: CategoryReference[];
  tags: Reference[];
  defaultAccount: string;
  onAdd: (receipt: ApiReceipt, draft: DraftTransaction, mode: EntryMode) => void;
  onDelete: (receipt: ApiReceipt) => void;
  onBack?: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [previewReceipt, setPreviewReceipt] = useState<ApiReceipt | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [webPreviewUri, setWebPreviewUri] = useState<string | null>(null);
  const [detailsReceipt, setDetailsReceipt] = useState<ApiReceipt | null>(null);
  const detailsDrawer = useDrawerTransition(detailsReceipt !== null, () => setDetailsReceipt(null));
  const previewDrawer = useDrawerTransition(previewReceipt !== null, () => setPreviewReceipt(null));
  const receiptDates = useMemo(
    () => receipts.map((receipt) => receipt.suggestion?.date ?? receipt.createdAt.slice(0, 10)),
    [receipts],
  );
  const receiptDayTotals = useMemo(
    () =>
      receipts.reduce<Record<string, number>>((totals, receipt, index) => {
        const date = receiptDates[index];
        if (date) totals[date] = (totals[date] ?? 0) + (receipt.suggestion?.amount ?? 0);
        return totals;
      }, {}),
    [receiptDates, receipts],
  );
  const detailsPrepared = useMemo(
    () =>
      detailsReceipt ? prepareReceiptDraft(detailsReceipt, { accounts, categories, tags }) : null,
    [accounts, categories, detailsReceipt, tags],
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || !previewReceipt || !previewReceipt.mimeType.startsWith('image/'))
      return;

    let active = true;
    let objectUrl: string | null = null;
    void loadReceiptFile(previewReceipt.id)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setWebPreviewUri(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        if (!active) return;
        setPreviewLoading(false);
        setPreviewError(true);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [previewReceipt]);

  const scanReceipt = async () => {
    const account = defaultAccount || accounts[0]?.id;
    if (!account) {
      setError('Enable an account before scanning a receipt.');
      return;
    }
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('Camera access is required to scan a receipt.');
        return;
      }
      const capture = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: false,
      });
      if (capture.canceled || !capture.assets[0]) return;
      setUploading(true);
      setError('');
      await uploadReceipt(capture.assets[0], account);
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not open the camera or upload receipt.',
      );
    } finally {
      setUploading(false);
    }
  };

  const chooseReceipt = async () => {
    const account = defaultAccount || accounts[0]?.id;
    if (!account) {
      setError('Enable an account before choosing a receipt photo.');
      return;
    }
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('Photo library access is required to choose a receipt.');
        return;
      }
      const selection = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.85,
        allowsEditing: false,
        selectionLimit: 1,
      });
      if (selection.canceled || !selection.assets[0]) return;
      setUploading(true);
      setError('');
      await uploadReceipt(selection.assets[0], account);
      await refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not open the photo library or upload receipt.',
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.receiptsScreen}>
      <View style={styles.receiptsHeader}>
        <View style={styles.nestedHeaderContent}>
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to More"
              onPress={onBack}
              style={styles.nestedBackButton}
            >
              <Ionicons name="chevron-back" size={24} color={colors.ink} />
            </Pressable>
          ) : null}
          <View>
            <Text style={styles.secondaryEyebrow}>MORE</Text>
            <Text style={styles.secondaryTitle}>Receipts</Text>
          </View>
        </View>
        <View style={styles.receiptHeaderActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose receipt photo"
            disabled={uploading}
            onPress={() => void chooseReceipt()}
            style={({ pressed }) => [styles.receiptLibraryButton, pressed && styles.fabPressed]}
          >
            <Ionicons name="images-outline" size={24} color={colors.accentDark} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scan receipt"
            disabled={uploading}
            onPress={() => void scanReceipt()}
            style={({ pressed }) => [styles.receiptFab, pressed && styles.fabPressed]}
          >
            {uploading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Ionicons name="camera-outline" size={26} color={colors.white} />
            )}
          </Pressable>
        </View>
      </View>
      {error ? <Text style={[styles.errorText, styles.receiptsError]}>{error}</Text> : null}
      <ScrollView
        contentContainerStyle={styles.receiptsContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void refresh()}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.white}
          />
        }
      >
        {loading && !receipts.length ? (
          <ActivityIndicator color={colors.accent} style={styles.loadingMore} />
        ) : (
          <>
            {uploading ? (
              <View style={styles.receiptCard}>
                <ActivityIndicator color={colors.accent} />
                <Text style={styles.receiptCardTitle}>Uploading receipt…</Text>
              </View>
            ) : null}
            {receipts.map((receipt, index) => {
              const currency = receipt.suggestion?.currency ?? '';
              const date = receiptDates[index] ?? receipt.createdAt.slice(0, 10);
              return (
                <Fragment key={receipt.id}>
                  {index === 0 || receiptDates[index - 1] !== date ? (
                    <DateSectionHeader
                      date={date}
                      total={receiptDayTotals[date] ?? 0}
                      flushTop={index === 0}
                    />
                  ) : null}
                  <SwipeToDelete
                    id={`receipt-${receipt.id}`}
                    label={receipt.suggestion?.merchant || receipt.filename}
                    rounded={false}
                    revealSpacing={12}
                    onDelete={() => onDelete(receipt)}
                  >
                    <View style={styles.receiptCard} testID={`receipt-${receipt.id}`}>
                      <View style={styles.receiptCardHeader}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`View details for ${receipt.suggestion?.merchant || receipt.filename}`}
                          onPress={() => setDetailsReceipt(receipt)}
                          style={styles.receiptCardSummary}
                        >
                          <View style={styles.receiptCardIcon}>
                            <Ionicons name="receipt-outline" size={23} color={colors.accent} />
                          </View>
                          <View style={styles.receiptCardCopy}>
                            <Text style={styles.receiptCardTitle}>
                              {receipt.suggestion?.merchant || receipt.filename}
                            </Text>
                            <View style={styles.receiptCardMetaRow}>
                              {receipt.submitted ? (
                                <View
                                  accessibilityLabel="Receipt added"
                                  style={styles.receiptSubmittedPill}
                                >
                                  <Ionicons name="checkmark" size={12} color={colors.green} />
                                </View>
                              ) : null}
                              <Text numberOfLines={1} style={styles.receiptCardMeta}>
                                {receipt.status === 'processed' && receipt.suggestion
                                  ? receiptAmount(currency, receipt.suggestion.amount)
                                  : receipt.status === 'failed'
                                    ? receipt.error || 'Processing failed'
                                    : 'Processing receipt…'}
                              </Text>
                            </View>
                          </View>
                          <Ionicons
                            accessibilityLabel="Receipt details"
                            name="ellipsis-horizontal-circle-outline"
                            size={21}
                            color={colors.muted}
                          />
                        </Pressable>
                      </View>
                    </View>
                  </SwipeToDelete>
                </Fragment>
              );
            })}
            {!receipts.length && !uploading && !loading ? (
              <View style={styles.emptyScreenCard}>
                <View style={styles.emptyScreenIcon}>
                  <Ionicons name="receipt-outline" size={34} color={colors.accent} />
                </View>
                <Text style={styles.emptyScreenTitle}>No receipts yet</Text>
                <Text style={styles.emptyScreenText}>Tap + to scan your first receipt.</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
      <Modal
        visible={detailsDrawer.mounted}
        transparent
        animationType="none"
        onShow={detailsDrawer.onShow}
        onRequestClose={detailsDrawer.dismiss}
      >
        <View style={styles.receiptDetailsModalRoot}>
          <Pressable
            accessibilityLabel="Close receipt details"
            style={styles.receiptDetailsScrim}
            onPress={detailsDrawer.dismiss}
          />
          <DrawerSheet
            visible={detailsDrawer.sheetVisible}
            onHidden={detailsDrawer.onHidden}
            style={styles.receiptDetailsSheet}
            testID="receipt-details-sheet"
          >
            <View style={styles.handle} />
            <View style={styles.receiptDetailsHeading}>
              <View style={styles.sheetTitleGroup}>
                <View style={styles.sheetTitleIcon}>
                  <Ionicons name="receipt-outline" size={20} color={colors.accent} />
                </View>
                <Text numberOfLines={1} style={styles.receiptDetailsTitle}>
                  {detailsReceipt?.suggestion?.merchant || detailsReceipt?.filename}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close receipt details"
                onPress={detailsDrawer.dismiss}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={22} color={colors.ink} />
              </Pressable>
            </View>
            <View style={styles.receiptDetailsActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View ${detailsReceipt?.suggestion?.merchant || detailsReceipt?.filename}`}
                onPress={() => {
                  if (!detailsReceipt) return;
                  setWebPreviewUri(null);
                  setPreviewLoading(detailsReceipt.mimeType.startsWith('image/'));
                  setPreviewError(false);
                  setPreviewReceipt(detailsReceipt);
                  detailsDrawer.dismiss();
                }}
                style={styles.receiptDetailsSecondaryAction}
              >
                <Ionicons name="eye-outline" size={20} color={colors.accentDark} />
                <Text style={styles.receiptDetailsSecondaryActionText}>View photo</Text>
              </Pressable>
              {detailsReceipt?.status === 'processed' &&
              !detailsReceipt.submitted &&
              detailsPrepared ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${detailsReceipt.suggestion?.merchant || 'receipt'}`}
                  onPress={() => {
                    onAdd(detailsReceipt, detailsPrepared.draft, detailsPrepared.mode);
                    detailsDrawer.dismiss();
                  }}
                  style={styles.receiptDetailsPrimaryAction}
                >
                  <Ionicons name="add" size={21} color={colors.white} />
                  <Text style={styles.receiptDetailsPrimaryActionText}>Add transaction</Text>
                </Pressable>
              ) : detailsReceipt?.submitted ? (
                <View style={styles.receiptDetailsSubmitted}>
                  <Ionicons name="checkmark-circle" size={21} color={colors.green} />
                  <Text style={styles.receiptDetailsSubmittedText}>Added</Text>
                </View>
              ) : null}
            </View>
            <ScrollView contentContainerStyle={styles.receiptDetailsSheetContent}>
              {detailsReceipt?.suggestion ? (
                <>
                  {receiptItemGroups(detailsReceipt, categories).length ? (
                    receiptItemGroups(detailsReceipt, categories).map((group) => (
                      <View key={group.id} style={styles.receiptItemGroup}>
                        <View style={styles.receiptItemGroupHeader}>
                          <Text style={styles.receiptItemGroupTitle}>{group.name}</Text>
                          <Text style={styles.receiptItemGroupTotal}>
                            {receiptAmount(detailsReceipt.suggestion!.currency, group.total)}
                          </Text>
                        </View>
                        {group.items.map((item, index) => (
                          <View key={`${item.description}-${index}`} style={styles.receiptItemRow}>
                            <View style={styles.receiptItemCopy}>
                              <Text style={styles.receiptItemName}>{item.description}</Text>
                              <Text style={styles.receiptItemQuantity}>
                                {item.quantity} ×{' '}
                                {receiptAmount(
                                  detailsReceipt.suggestion!.currency,
                                  item.unitAmount,
                                )}
                              </Text>
                            </View>
                            <Text style={styles.receiptItemAmount}>
                              {receiptAmount(detailsReceipt.suggestion!.currency, item.totalAmount)}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ))
                  ) : (
                    <Text style={styles.receiptNoItems}>No line items extracted.</Text>
                  )}
                  <View style={styles.receiptFinalTotal}>
                    <Text style={styles.receiptFinalTotalLabel}>Total</Text>
                    <Text style={styles.receiptFinalTotalAmount}>
                      {receiptAmount(
                        detailsReceipt.suggestion.currency,
                        detailsReceipt.suggestion.amount,
                      )}
                    </Text>
                  </View>
                </>
              ) : null}
            </ScrollView>
          </DrawerSheet>
        </View>
      </Modal>
      <Modal
        animationType="none"
        transparent
        visible={previewDrawer.mounted}
        onShow={previewDrawer.onShow}
        onRequestClose={previewDrawer.dismiss}
      >
        <View style={styles.receiptPreviewBackdrop} testID="receipt-preview">
          <Pressable
            accessibilityLabel="Close receipt photo"
            style={styles.receiptPreviewScrim}
            onPress={previewDrawer.dismiss}
          />
          <DrawerSheet
            visible={previewDrawer.sheetVisible}
            onHidden={previewDrawer.onHidden}
            style={styles.receiptPreviewCard}
          >
            <View style={styles.handle} />
            <View style={styles.receiptPreviewHeader}>
              <Text numberOfLines={1} style={styles.receiptPreviewTitle}>
                {previewReceipt?.suggestion?.merchant || previewReceipt?.filename}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close receipt photo"
                onPress={previewDrawer.dismiss}
                style={styles.receiptPreviewClose}
              >
                <Ionicons name="close" size={24} color={colors.ink} />
              </Pressable>
            </View>
            {previewReceipt?.mimeType.startsWith('image/') &&
            (Platform.OS !== 'web' || webPreviewUri) ? (
              <Image
                accessibilityLabel={`Receipt photo ${previewReceipt.filename}`}
                onError={() => {
                  setPreviewLoading(false);
                  setPreviewError(true);
                }}
                onLoad={() => setPreviewLoading(false)}
                resizeMode="contain"
                source={
                  Platform.OS === 'web'
                    ? { uri: webPreviewUri ?? '' }
                    : receiptFileSource(previewReceipt.id)
                }
                style={styles.receiptPreviewImage}
              />
            ) : previewReceipt && !previewReceipt.mimeType.startsWith('image/') ? (
              <View style={styles.receiptPreviewUnavailable}>
                <Ionicons name="document-outline" size={38} color={colors.accent} />
                <Text style={styles.emptyScreenText}>
                  Photo preview is unavailable for this file.
                </Text>
              </View>
            ) : null}
            {previewLoading ? (
              <View style={styles.receiptPreviewStatus}>
                <ActivityIndicator color={colors.white} />
              </View>
            ) : null}
            {previewError ? (
              <View style={styles.receiptPreviewStatus}>
                <Ionicons name="image-outline" size={38} color={colors.white} />
                <Text style={styles.receiptPreviewErrorText}>
                  Could not load this receipt photo.
                </Text>
              </View>
            ) : null}
          </DrawerSheet>
        </View>
      </Modal>
    </View>
  );
}
