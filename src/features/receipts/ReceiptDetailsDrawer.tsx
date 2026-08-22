import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import type { PreparedReceiptDraft } from '../../app-model';
import { DrawerSheet } from '../../components/DrawerSheet';
import { useDrawerTransition } from '../../components/useDrawerTransition';
import { styles } from '../../styles';
import { colors } from '../../theme';
import type { ApiReceipt, CategoryReference, DraftTransaction, EntryMode } from '../../types';

function amount(currency: string, value: number) {
  return `${currency} ${Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function itemGroups(receipt: ApiReceipt, categories: CategoryReference[]) {
  const suggestion = receipt.suggestion;
  if (!suggestion) return [];
  const names = new Map(categories.map(({ id, name }) => [id, name]));
  const groups = new Map<
    string,
    { id: string; name: string; total: number; items: typeof suggestion.items }
  >();
  for (const item of suggestion.items) {
    const id = item.category || suggestion.category || 'uncategorized';
    const group = groups.get(id) ?? {
      id,
      name: names.get(id) ?? 'Uncategorized',
      total: 0,
      items: [],
    };
    group.items.push(item);
    group.total += item.totalAmount;
    groups.set(id, group);
  }
  return [...groups.values()];
}

export function ReceiptDetailsDrawer({
  receipt,
  categories,
  prepared,
  onAdd,
  onView,
  onClose,
}: {
  receipt: ApiReceipt | null;
  categories: CategoryReference[];
  prepared: PreparedReceiptDraft | null;
  onAdd: (receipt: ApiReceipt, draft: DraftTransaction, mode: EntryMode) => void;
  onView: (receipt: ApiReceipt) => void;
  onClose: () => void;
}) {
  const drawer = useDrawerTransition(receipt !== null, onClose);
  const groups = receipt ? itemGroups(receipt, categories) : [];
  return (
    <Modal
      visible={drawer.mounted}
      transparent
      animationType="none"
      onShow={drawer.onShow}
      onRequestClose={drawer.dismiss}
    >
      <View style={styles.receiptDetailsModalRoot}>
        <Pressable
          accessibilityLabel="Close receipt details"
          style={styles.receiptDetailsScrim}
          onPress={drawer.dismiss}
        />
        <DrawerSheet
          visible={drawer.sheetVisible}
          onHidden={drawer.onHidden}
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
                {receipt?.suggestion?.merchant || receipt?.filename}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close receipt details"
              onPress={drawer.dismiss}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={22} color={colors.ink} />
            </Pressable>
          </View>
          <View style={styles.receiptDetailsActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${receipt?.suggestion?.merchant || receipt?.filename}`}
              onPress={() => {
                if (receipt) onView(receipt);
                drawer.dismiss();
              }}
              style={styles.receiptDetailsSecondaryAction}
            >
              <Ionicons name="eye-outline" size={20} color={colors.accentDark} />
              <Text style={styles.receiptDetailsSecondaryActionText}>View photo</Text>
            </Pressable>
            {receipt?.status === 'processed' && !receipt.submitted && prepared ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Add ${receipt.suggestion?.merchant || 'receipt'}`}
                onPress={() => {
                  onAdd(receipt, prepared.draft, prepared.mode);
                  drawer.dismiss();
                }}
                style={styles.receiptDetailsPrimaryAction}
              >
                <Ionicons name="add" size={21} color={colors.white} />
                <Text style={styles.receiptDetailsPrimaryActionText}>Add transaction</Text>
              </Pressable>
            ) : receipt?.submitted ? (
              <View style={styles.receiptDetailsSubmitted}>
                <Ionicons name="checkmark-circle" size={21} color={colors.green} />
                <Text style={styles.receiptDetailsSubmittedText}>Added</Text>
              </View>
            ) : null}
          </View>
          <ScrollView contentContainerStyle={styles.receiptDetailsSheetContent}>
            {receipt?.suggestion ? (
              <>
                {groups.length ? (
                  groups.map((group) => (
                    <View key={group.id} style={styles.receiptItemGroup}>
                      <View style={styles.receiptItemGroupHeader}>
                        <Text style={styles.receiptItemGroupTitle}>{group.name}</Text>
                        <Text style={styles.receiptItemGroupTotal}>
                          {amount(receipt.suggestion!.currency, group.total)}
                        </Text>
                      </View>
                      {group.items.map((item, index) => (
                        <View key={`${item.description}-${index}`} style={styles.receiptItemRow}>
                          <View style={styles.receiptItemCopy}>
                            <Text style={styles.receiptItemName}>{item.description}</Text>
                            <Text style={styles.receiptItemQuantity}>
                              {item.quantity} ×{' '}
                              {amount(receipt.suggestion!.currency, item.unitAmount)}
                            </Text>
                          </View>
                          <Text style={styles.receiptItemAmount}>
                            {amount(receipt.suggestion!.currency, item.totalAmount)}
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
                    {amount(receipt.suggestion.currency, receipt.suggestion.amount)}
                  </Text>
                </View>
              </>
            ) : null}
          </ScrollView>
        </DrawerSheet>
      </View>
    </Modal>
  );
}
