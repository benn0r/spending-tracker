import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { nativeDeviceLocale } from '../../device-locale';
import { styles } from '../../styles';
import { colors } from '../../theme';
import { formatCurrency, formatTransactionDate } from '../../transactions';
import type { ApiTransaction, CategoryReference } from '../../types';
import { categoryVisual, transactionIcon } from '../categories/categoryVisual';

const walletColors = ['#7B3FA1', '#2D83B7', '#2A9D78', '#C27A32', '#C34F70', '#5D6F91'];

function walletColor(account: string) {
  const index = [...account].reduce((total, character) => total + character.charCodeAt(0), 0);
  return walletColors[index % walletColors.length] ?? walletColors[0];
}

export function TransactionRow({
  item,
  categories,
  onDelete,
}: {
  item: ApiTransaction;
  categories: CategoryReference[];
  onDelete: (item: ApiTransaction) => void;
}) {
  const title = item.payee && item.payee !== '—' ? item.payee : item.category;
  const notes =
    item.notes && item.notes !== title && item.notes !== item.category ? item.notes : null;
  const serverCategory = categories.find(
    ({ name }) => name.toLowerCase() === item.category.toLowerCase(),
  );
  const serverVisual = serverCategory ? categoryVisual(serverCategory, 0) : null;
  const icon = serverVisual?.icon ?? transactionIcon(item);
  const iconColor = serverVisual?.color ?? (item.amount > 0 ? colors.green : colors.accentDark);
  const iconBackground = serverVisual
    ? `${iconColor}1A`
    : item.amount > 0
      ? '#DDF0E5'
      : `${iconColor}1A`;
  const accountColor = walletColor(item.account);
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    <>
      <SwipeToDelete
        id={`transaction-${item.id}`}
        label={title}
        rounded={false}
        revealSpacing={12}
        onDelete={() => onDelete(item)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View details for ${title}`}
          onPress={() => setDetailsOpen(true)}
          style={styles.transactionRow}
          testID={`transaction-${item.id}`}
        >
          <View style={[styles.transactionIcon, { backgroundColor: iconBackground }]}>
            <Ionicons name={icon} size={19} color={iconColor} />
          </View>
          <View style={styles.transactionCopy}>
            <Text style={styles.merchant}>{title}</Text>
            <View style={styles.transactionMetaRow}>
              <View
                accessible
                accessibilityLabel={`Account ${item.account}`}
                accessibilityRole="image"
                style={[styles.transactionWalletPill, { backgroundColor: `${accountColor}1A` }]}
              >
                <Ionicons name="wallet-outline" size={11} color={accountColor} />
              </View>
              {item.cleared ? (
                <View
                  accessible
                  accessibilityLabel="Verified in Actual Budget"
                  style={styles.transactionClearedPill}
                >
                  <Ionicons name="checkmark" size={12} color={colors.green} />
                </View>
              ) : null}
              {(item.tags ?? []).map((tag) => (
                <View key={tag} style={styles.transactionTagPill}>
                  <Text ellipsizeMode="tail" numberOfLines={1} style={styles.transactionTagText}>
                    #{tag}
                  </Text>
                </View>
              ))}
              {notes ? (
                <Text
                  ellipsizeMode="tail"
                  numberOfLines={1}
                  style={[styles.transactionMeta, styles.transactionMetaDetails]}
                >
                  {notes}
                </Text>
              ) : null}
            </View>
          </View>
          <Text style={[styles.amount, item.amount > 0 && styles.incomeAmount]}>
            {formatCurrency(item.amount)}
          </Text>
        </Pressable>
      </SwipeToDelete>
      <Modal
        visible={detailsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailsOpen(false)}
      >
        <View style={styles.receiptDetailsModalRoot}>
          <Pressable
            accessibilityLabel="Close transaction details"
            style={styles.receiptDetailsScrim}
            onPress={() => setDetailsOpen(false)}
          />
          <View style={styles.receiptDetailsSheet} testID="transaction-details-sheet">
            <View style={styles.handle} />
            <View style={styles.receiptDetailsHeading}>
              <View style={styles.sheetTitleGroup}>
                <View style={[styles.sheetTitleIcon, { backgroundColor: iconBackground }]}>
                  <Ionicons name={icon} size={20} color={iconColor} />
                </View>
                <Text numberOfLines={1} style={styles.receiptDetailsTitle}>
                  {title}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close transaction details"
                onPress={() => setDetailsOpen(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={22} color={colors.ink} />
              </Pressable>
            </View>
            <Text style={[styles.transactionDetailsAmount, item.amount > 0 && styles.incomeAmount]}>
              {formatCurrency(item.amount)}
            </Text>
            <ScrollView contentContainerStyle={styles.transactionDetailsContent}>
              <View style={styles.transactionDetailsRow}>
                <Text style={styles.transactionDetailsLabel}>Date</Text>
                <Text style={styles.transactionDetailsValue}>
                  {formatTransactionDate(item.date, nativeDeviceLocale())}
                </Text>
              </View>
              <View style={styles.transactionDetailsRow}>
                <Text style={styles.transactionDetailsLabel}>Account</Text>
                <Text style={styles.transactionDetailsValue}>{item.account}</Text>
              </View>
              <View style={styles.transactionDetailsRow}>
                <Text style={styles.transactionDetailsLabel}>Category</Text>
                <Text style={styles.transactionDetailsValue}>{item.category}</Text>
              </View>
              <View style={styles.transactionDetailsRow}>
                <Text style={styles.transactionDetailsLabel}>Type</Text>
                <Text style={styles.transactionDetailsValue}>
                  {item.isSplit ? 'Split transaction' : item.amount > 0 ? 'Income' : 'Expense'}
                </Text>
              </View>
              {item.tags?.length ? (
                <View style={styles.transactionDetailsSection}>
                  <Text style={styles.transactionDetailsLabel}>Tags</Text>
                  <View style={styles.transactionDetailsTags}>
                    {item.tags.map((tag) => (
                      <View key={tag} style={styles.transactionTagPill}>
                        <Text style={styles.transactionTagText}>#{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {item.notes ? (
                <View style={styles.transactionDetailsSection}>
                  <Text style={styles.transactionDetailsLabel}>Notes</Text>
                  <Text style={styles.transactionDetailsNotes}>{item.notes}</Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
