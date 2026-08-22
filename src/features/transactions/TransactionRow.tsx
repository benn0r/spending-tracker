import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { DrawerSheet } from '../../components/DrawerSheet';
import { useDrawerTransition } from '../../components/useDrawerTransition';
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
  onEdit,
}: {
  item: ApiTransaction;
  categories: CategoryReference[];
  onDelete: (item: ApiTransaction) => void;
  onEdit?: (item: ApiTransaction) => void;
}) {
  const isTransfer = item.type === 'Transfer';
  const categoryLabel = item.expenseSplitId
    ? 'Shared expense'
    : item.isSplit
      ? 'Split transaction'
      : item.category;
  const title = isTransfer
    ? 'Transfer'
    : item.payee && item.payee !== '—'
      ? item.payee
      : categoryLabel;
  const transferDescription = item.transferAccount
    ? `${item.amount < 0 ? 'To' : 'From'} ${item.transferAccount}`
    : null;
  const notes =
    transferDescription ??
    (item.notes && item.notes !== title && item.notes !== item.category ? item.notes : null);
  const serverCategory = isTransfer
    ? undefined
    : categories.find(({ name }) => name.toLowerCase() === item.category.toLowerCase());
  const serverVisual = serverCategory ? categoryVisual(serverCategory, 0) : null;
  const icon = serverVisual?.icon ?? transactionIcon(item);
  const iconColor = isTransfer
    ? '#397A9B'
    : (serverVisual?.color ?? (item.amount > 0 ? colors.green : colors.accentDark));
  const iconBackground = serverVisual
    ? `${iconColor}1A`
    : item.amount > 0
      ? '#DDF0E5'
      : `${iconColor}1A`;
  const accountColor = walletColor(item.account);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const editAfterDismiss = useRef(false);
  const detailsDrawer = useDrawerTransition(detailsOpen, () => {
    setDetailsOpen(false);
    if (editAfterDismiss.current) {
      editAfterDismiss.current = false;
      onEdit?.(item);
    }
  });
  return (
    <>
      <SwipeToDelete
        id={`transaction-${item.id}`}
        label={title}
        rounded={false}
        revealSpacing={12}
        onDelete={() => onDelete(item)}
      >
        <View style={item.isSplit ? styles.splitTransactionGroup : undefined}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View details for ${title}`}
            onPress={() => setDetailsOpen(true)}
            style={[styles.transactionRow, item.isSplit && styles.splitTransactionParent]}
            testID={`transaction-${item.id}`}
          >
            <View style={[styles.transactionIcon, { backgroundColor: iconBackground }]}>
              <Ionicons name={icon} size={19} color={iconColor} />
            </View>
            <View style={styles.transactionCopy}>
              <Text style={styles.merchant}>{title}</Text>
              <View style={styles.transactionMetaRow}>
                {item.isSplit ? (
                  <View accessibilityLabel="Split transaction" style={styles.transactionSplitPill}>
                    <Ionicons name="git-branch-outline" size={11} color={colors.accentDark} />
                    <Text style={styles.transactionSplitPillText}>
                      {(item.children?.length ?? 0) || 'Split'}
                    </Text>
                  </View>
                ) : null}
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
          {(item.children ?? []).map((child, index) => {
            const childCategory = categories.find(
              ({ name }) => name.toLowerCase() === child.category.toLowerCase(),
            );
            const childVisual = childCategory ? categoryVisual(childCategory, index) : null;
            const childColor = childVisual?.color ?? colors.accentDark;
            return (
              <View
                accessible
                accessibilityLabel={`Split entry ${index + 1} of ${item.children?.length}: ${child.category}`}
                key={child.id}
                style={styles.splitTransactionChild}
              >
                <View
                  style={[styles.splitTransactionChildIcon, { backgroundColor: `${childColor}1A` }]}
                >
                  <Ionicons
                    name={childVisual?.icon ?? 'git-branch-outline'}
                    size={14}
                    color={childColor}
                  />
                </View>
                <View style={styles.transactionCopy}>
                  <Text style={styles.splitTransactionChildTitle}>{child.category}</Text>
                  <View style={[styles.transactionMetaRow, styles.splitTransactionChildMeta]}>
                    {(child.tags ?? []).map((tag) => (
                      <View key={tag} style={styles.transactionTagPill}>
                        <Text style={styles.transactionTagText}>#{tag}</Text>
                      </View>
                    ))}
                    {child.notes ? (
                      <Text
                        ellipsizeMode="tail"
                        numberOfLines={1}
                        style={[styles.transactionMeta, styles.transactionMetaDetails]}
                      >
                        {child.notes}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <Text
                  style={[
                    styles.amount,
                    styles.splitTransactionChildAmount,
                    child.amount > 0 && styles.incomeAmount,
                  ]}
                >
                  {formatCurrency(child.amount)}
                </Text>
              </View>
            );
          })}
        </View>
      </SwipeToDelete>
      <Modal
        visible={detailsDrawer.mounted}
        transparent
        animationType="none"
        onShow={detailsDrawer.onShow}
        onRequestClose={detailsDrawer.dismiss}
      >
        <View style={styles.receiptDetailsModalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close transaction details"
            style={styles.receiptDetailsScrim}
            onPress={detailsDrawer.dismiss}
          />
          <DrawerSheet
            visible={detailsDrawer.sheetVisible}
            onHidden={detailsDrawer.onHidden}
            style={styles.receiptDetailsSheet}
            testID="transaction-details-sheet"
          >
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
                onPress={detailsDrawer.dismiss}
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
              {item.children?.length ? (
                <View style={styles.transactionDetailsSection}>
                  <Text style={styles.transactionDetailsLabel}>Split entries</Text>
                  <View style={styles.transactionDetailsSplitList}>
                    {item.children.map((child) => (
                      <View key={child.id} style={styles.transactionDetailsSplitRow}>
                        <View style={styles.transactionCopy}>
                          <Text style={styles.transactionDetailsSplitTitle}>{child.category}</Text>
                          {child.notes ? (
                            <Text style={styles.transactionDetailsNotes}>{child.notes}</Text>
                          ) : null}
                        </View>
                        <Text style={styles.transactionDetailsSplitAmount}>
                          {formatCurrency(child.amount)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              <View style={styles.transactionDetailsRow}>
                <Text style={styles.transactionDetailsLabel}>Account</Text>
                <Text style={styles.transactionDetailsValue}>{item.account}</Text>
              </View>
              <View style={styles.transactionDetailsRow}>
                <Text style={styles.transactionDetailsLabel}>Category</Text>
                <Text style={styles.transactionDetailsValue}>
                  {isTransfer ? 'Transfer' : categoryLabel}
                </Text>
              </View>
              {item.transferAccount ? (
                <View style={styles.transactionDetailsRow}>
                  <Text style={styles.transactionDetailsLabel}>
                    {item.amount < 0 ? 'To account' : 'From account'}
                  </Text>
                  <Text style={styles.transactionDetailsValue}>{item.transferAccount}</Text>
                </View>
              ) : null}
              <View style={styles.transactionDetailsRow}>
                <Text style={styles.transactionDetailsLabel}>Type</Text>
                <Text style={styles.transactionDetailsValue}>
                  {isTransfer
                    ? 'Transfer'
                    : item.expenseSplitId
                      ? 'Shared expense'
                      : item.isSplit
                        ? 'Split transaction'
                        : item.amount > 0
                          ? 'Income'
                          : 'Expense'}
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
            {!isTransfer && onEdit ? (
              <View style={styles.sheetActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Edit transaction"
                  onPress={() => {
                    editAfterDismiss.current = true;
                    detailsDrawer.dismiss();
                  }}
                  style={styles.saveButton}
                >
                  <Ionicons name="create-outline" size={18} color={colors.white} />
                  <Text style={styles.saveText}>Edit transaction</Text>
                </Pressable>
              </View>
            ) : null}
          </DrawerSheet>
        </View>
      </Modal>
    </>
  );
}
