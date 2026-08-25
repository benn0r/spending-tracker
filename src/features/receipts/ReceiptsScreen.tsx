import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { loadReceiptFile, uploadReceipt } from '../../api';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { GlassBackground } from '../../components/GlassBackground';
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
import { ReceiptPreviewDrawer } from './ReceiptPreviewDrawer';
import { ReceiptDetailsDrawer } from './ReceiptDetailsDrawer';

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
        <GlassBackground />
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
      <ReceiptDetailsDrawer
        receipt={detailsReceipt}
        categories={categories}
        prepared={detailsPrepared}
        onAdd={onAdd}
        onView={(receipt) => {
          setWebPreviewUri(null);
          setPreviewLoading(receipt.mimeType.startsWith('image/'));
          setPreviewError(false);
          setPreviewReceipt(receipt);
        }}
        onClose={() => setDetailsReceipt(null)}
      />
      <ReceiptPreviewDrawer
        receipt={previewReceipt}
        webUri={webPreviewUri}
        loading={previewLoading}
        error={previewError}
        onLoad={() => setPreviewLoading(false)}
        onError={() => {
          setPreviewLoading(false);
          setPreviewError(true);
        }}
        onClose={() => setPreviewReceipt(null)}
      />
    </View>
  );
}
