import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
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
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [previewReceipt, setPreviewReceipt] = useState<ApiReceipt | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [webPreviewUri, setWebPreviewUri] = useState<string | null>(null);
  const [expandedReceipts, setExpandedReceipts] = useState<Set<number>>(() => new Set());

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

  return (
    <View style={styles.receiptsScreen}>
      <View style={styles.receiptsHeader}>
        <View>
          <Text style={styles.secondaryEyebrow}>DOCUMENTS</Text>
          <Text style={styles.secondaryTitle}>Receipts</Text>
        </View>
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
            <Ionicons name="add" size={30} color={colors.white} />
          )}
        </Pressable>
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
            {receipts.map((receipt) => {
              const prepared = prepareReceiptDraft(receipt, { accounts, categories, tags });
              const expanded = expandedReceipts.has(receipt.id);
              const itemGroups = receiptItemGroups(receipt, categories);
              const currency = receipt.suggestion?.currency ?? '';
              return (
                <SwipeToDelete
                  id={`receipt-${receipt.id}`}
                  key={receipt.id}
                  label={receipt.suggestion?.merchant || receipt.filename}
                  bordered
                  onDelete={() => onDelete(receipt)}
                >
                  <View style={styles.receiptCard} testID={`receipt-${receipt.id}`}>
                    <View style={styles.receiptCardHeader}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} ${receipt.suggestion?.merchant || receipt.filename}`}
                        accessibilityState={{ expanded }}
                        onPress={() =>
                          setExpandedReceipts((current) => {
                            const next = new Set(current);
                            if (next.has(receipt.id)) next.delete(receipt.id);
                            else next.add(receipt.id);
                            return next;
                          })
                        }
                        style={styles.receiptCardSummary}
                      >
                        <View style={styles.receiptCardIcon}>
                          <Ionicons name="receipt-outline" size={23} color={colors.accent} />
                        </View>
                        <View style={styles.receiptCardCopy}>
                          <Text style={styles.receiptCardTitle}>
                            {receipt.suggestion?.merchant || receipt.filename}
                          </Text>
                          <Text style={styles.receiptCardMeta}>
                            {receipt.status === 'processed' && receipt.suggestion
                              ? receiptAmount(currency, receipt.suggestion.amount)
                              : receipt.status === 'failed'
                                ? receipt.error || 'Processing failed'
                                : 'Processing receipt…'}
                          </Text>
                        </View>
                        {receipt.status === 'processed' ? (
                          <Ionicons
                            name={expanded ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={colors.muted}
                          />
                        ) : null}
                      </Pressable>
                      <View style={styles.receiptActions}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`View ${receipt.suggestion?.merchant || receipt.filename}`}
                          onPress={() => {
                            setWebPreviewUri(null);
                            setPreviewLoading(receipt.mimeType.startsWith('image/'));
                            setPreviewError(false);
                            setPreviewReceipt(receipt);
                          }}
                          style={styles.viewReceiptButton}
                        >
                          <Ionicons name="eye-outline" size={19} color={colors.accentDark} />
                        </Pressable>
                        {receipt.status === 'processed' && !receipt.submitted && prepared ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Add ${receipt.suggestion?.merchant || 'receipt'}`}
                            onPress={() => onAdd(receipt, prepared.draft, prepared.mode)}
                            style={styles.addReceiptButton}
                          >
                            <Ionicons name="add" size={22} color={colors.white} />
                          </Pressable>
                        ) : receipt.submitted ? (
                          <Ionicons name="checkmark-circle" size={24} color={colors.green} />
                        ) : null}
                      </View>
                    </View>
                    {expanded && receipt.suggestion ? (
                      <View style={styles.receiptDetails}>
                        {itemGroups.length ? (
                          itemGroups.map((group) => (
                            <View key={group.id} style={styles.receiptItemGroup}>
                              <View style={styles.receiptItemGroupHeader}>
                                <Text style={styles.receiptItemGroupTitle}>{group.name}</Text>
                                <Text style={styles.receiptItemGroupTotal}>
                                  {receiptAmount(currency, group.total)}
                                </Text>
                              </View>
                              {group.items.map((item, index) => (
                                <View
                                  key={`${item.description}-${index}`}
                                  style={styles.receiptItemRow}
                                >
                                  <View style={styles.receiptItemCopy}>
                                    <Text style={styles.receiptItemName}>{item.description}</Text>
                                    <Text style={styles.receiptItemQuantity}>
                                      {item.quantity} × {receiptAmount(currency, item.unitAmount)}
                                    </Text>
                                  </View>
                                  <Text style={styles.receiptItemAmount}>
                                    {receiptAmount(currency, item.totalAmount)}
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
                            {receiptAmount(currency, receipt.suggestion.amount)}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </View>
                </SwipeToDelete>
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
        animationType="fade"
        transparent
        visible={previewReceipt !== null}
        onRequestClose={() => setPreviewReceipt(null)}
      >
        <View style={styles.receiptPreviewBackdrop} testID="receipt-preview">
          <View style={styles.receiptPreviewCard}>
            <View style={styles.receiptPreviewHeader}>
              <Text numberOfLines={1} style={styles.receiptPreviewTitle}>
                {previewReceipt?.suggestion?.merchant || previewReceipt?.filename}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close receipt photo"
                onPress={() => setPreviewReceipt(null)}
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
          </View>
        </View>
      </Modal>
    </View>
  );
}
