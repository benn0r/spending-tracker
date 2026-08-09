import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { loadDashboard, submitTransaction } from './src/api';
import {
  createPayload,
  emptyDraft,
  formatCurrency,
  formatTransactionDate,
  isDraftValid,
  summarize,
} from './src/transactions';
import { colors } from './src/theme';
import type {
  ApiTransaction,
  DraftTransaction,
  EntryMode,
  Reference,
  References,
} from './src/types';

const emptyReferences: References = { accounts: [], categories: [], tags: [] };

function SummaryCard({ transactions }: { transactions: ApiTransaction[] }) {
  const totals = useMemo(() => summarize(transactions), [transactions]);
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.eyebrow}>AVAILABLE BALANCE</Text>
      <Text style={styles.balance}>
        CHF {totals.balance.toLocaleString('en-CH', { minimumFractionDigits: 2 })}
      </Text>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryRow}>
        <View style={styles.summaryMetric}>
          <View style={[styles.dot, styles.incomeDot]} />
          <View>
            <Text style={styles.metricLabel}>Income</Text>
            <Text style={styles.metricValue}>CHF {totals.income.toLocaleString('en-CH')}</Text>
          </View>
        </View>
        <View style={styles.summaryMetric}>
          <View style={[styles.dot, styles.spentDot]} />
          <View>
            <Text style={styles.metricLabel}>Spent</Text>
            <Text style={styles.metricValue}>CHF {totals.spent.toLocaleString('en-CH')}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function iconFor(transaction: ApiTransaction): keyof typeof Ionicons.glyphMap {
  if (transaction.isSplit) return 'git-branch-outline';
  if (transaction.amount > 0) return 'wallet-outline';
  const category = transaction.category.toLowerCase();
  if (category.includes('food') || category.includes('grocer')) return 'basket-outline';
  if (category.includes('transport')) return 'train-outline';
  if (category.includes('home')) return 'home-outline';
  return 'receipt-outline';
}

function TransactionRow({ item }: { item: ApiTransaction }) {
  const title = item.payee && item.payee !== '—' ? item.payee : item.category;
  return (
    <View style={styles.transactionRow} testID={`transaction-${item.id}`}>
      <View
        style={[styles.transactionIcon, item.amount > 0 ? styles.incomeIcon : styles.expenseIcon]}
      >
        <Ionicons
          name={iconFor(item)}
          size={21}
          color={item.amount > 0 ? colors.green : colors.accentDark}
        />
      </View>
      <View style={styles.transactionCopy}>
        <Text style={styles.merchant}>{title}</Text>
        <Text style={styles.transactionMeta}>
          {item.category} · {item.account}
        </Text>
        <Text style={styles.transactionDate}>{formatTransactionDate(item.date)}</Text>
      </View>
      <Text style={[styles.amount, item.amount > 0 && styles.incomeAmount]}>
        {formatCurrency(item.amount)}
      </Text>
    </View>
  );
}

function ChoiceField({
  label,
  value,
  options,
  onChange,
  multiple = false,
}: {
  label: string;
  value: string | string[];
  options: Reference[];
  onChange: (value: never) => void;
  multiple?: boolean;
}) {
  const selected = Array.isArray(value) ? value : [value];
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.choiceRow}
      >
        {options.map((option) => {
          const active = selected.includes(option.id);
          return (
            <Pressable
              key={option.id}
              accessibilityRole={multiple ? 'checkbox' : 'radio'}
              accessibilityState={{ checked: active }}
              onPress={() => {
                if (multiple)
                  onChange(
                    (active
                      ? selected.filter((id) => id !== option.id)
                      : [...selected, option.id]) as never,
                  );
                else onChange(option.id as never);
              }}
              style={[styles.choice, active && styles.activeChoice]}
            >
              <Text style={[styles.choiceText, active && styles.activeChoiceText]}>
                {option.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  multiline?: boolean;
  keyboardType?: 'decimal-pad';
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.field, multiline && styles.multilineField]}>
        <Ionicons name={icon} size={20} color={colors.muted} />
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#A7A99F"
          style={[styles.input, multiline && styles.multilineInput]}
          multiline={multiline}
          keyboardType={keyboardType}
        />
      </View>
    </View>
  );
}

function EntrySheet({
  visible,
  references,
  onClose,
  onSave,
}: {
  visible: boolean;
  references: References;
  onClose: () => void;
  onSave: (draft: DraftTransaction, mode: EntryMode) => Promise<void>;
}) {
  const [mode, setMode] = useState<EntryMode>('transaction');
  const [draft, setDraft] = useState<DraftTransaction>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const update = <K extends keyof DraftTransaction>(key: K, value: DraftTransaction[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const updateSplit = (
    index: number,
    key: 'category' | 'amount' | 'tags',
    value: string | string[],
  ) =>
    setDraft((current) => ({
      ...current,
      splits: current.splits.map((split, splitIndex) =>
        splitIndex === index ? { ...split, [key]: value } : split,
      ),
    }));
  const reset = () => {
    setDraft(emptyDraft);
    setMode('transaction');
    setError('');
  };
  const close = () => {
    if (!saving) {
      reset();
      onClose();
    }
  };
  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(draft, mode);
      reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the transaction.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          accessibilityLabel="Close transaction form"
          style={styles.scrim}
          onPress={close}
        />
        <View style={styles.sheet} testID="entry-sheet">
          <View style={styles.handle} />
          <View style={styles.sheetHeading}>
            <View>
              <Text style={styles.sheetTitle}>New expense</Text>
              <Text style={styles.sheetSubtitle}>Saved directly to your budget.</Text>
            </View>
            <Pressable accessibilityLabel="Close" onPress={close} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={colors.ink} />
            </Pressable>
          </View>
          <View accessibilityRole="tablist" style={styles.segmented}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === 'transaction' }}
              onPress={() => setMode('transaction')}
              style={[styles.segment, mode === 'transaction' && styles.activeSegment]}
            >
              <Text
                style={[styles.segmentText, mode === 'transaction' && styles.activeSegmentText]}
              >
                Transaction
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === 'split' }}
              onPress={() => setMode('split')}
              style={[styles.segment, mode === 'split' && styles.activeSegment]}
            >
              <Text style={[styles.segmentText, mode === 'split' && styles.activeSegmentText]}>
                Split transaction
              </Text>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
            <ChoiceField
              label="Account"
              value={draft.account}
              options={references.accounts}
              onChange={(value) => update('account', value)}
            />
            <TextField
              label="Amount"
              value={draft.amount}
              onChangeText={(value) => update('amount', value)}
              placeholder="0.00"
              icon="cash-outline"
              keyboardType="decimal-pad"
            />
            {mode === 'transaction' ? (
              <>
                <ChoiceField
                  label="Category"
                  value={draft.category}
                  options={references.categories}
                  onChange={(value) => update('category', value)}
                />
                <ChoiceField
                  label="Tags (optional)"
                  value={draft.tags}
                  options={references.tags}
                  multiple
                  onChange={(value) => update('tags', value)}
                />
              </>
            ) : (
              <>
                {draft.splits.map((split, index) => (
                  <View key={index} style={styles.splitCard}>
                    <Text style={styles.splitTitle}>Split {index + 1}</Text>
                    <ChoiceField
                      label="Category"
                      value={split.category}
                      options={references.categories}
                      onChange={(value) => updateSplit(index, 'category', value)}
                    />
                    <TextField
                      label="Split amount"
                      value={split.amount}
                      onChangeText={(value) => updateSplit(index, 'amount', value)}
                      placeholder="0.00"
                      icon="pie-chart-outline"
                      keyboardType="decimal-pad"
                    />
                    <ChoiceField
                      label="Tags (optional)"
                      value={split.tags}
                      options={references.tags}
                      multiple
                      onChange={(value) => updateSplit(index, 'tags', value)}
                    />
                  </View>
                ))}
              </>
            )}
            <TextField
              label="Comment"
              value={draft.comment}
              onChangeText={(value) => update('comment', value)}
              placeholder="What was this for?"
              icon="chatbubble-ellipses-outline"
              multiline
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </ScrollView>
          <View style={styles.sheetActions}>
            <Pressable onPress={close} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: !isDraftValid(draft, mode) || saving }}
              disabled={!isDraftValid(draft, mode) || saving}
              onPress={save}
              style={[
                styles.saveButton,
                (!isDraftValid(draft, mode) || saving) && styles.disabledButton,
              ]}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Text style={styles.saveText}>Save expense</Text>
                  <Ionicons name="arrow-forward" size={18} color={colors.white} />
                </>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function App() {
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [references, setReferences] = useState(emptyReferences);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await loadDashboard();
      setTransactions(result.page.transactions);
      setReferences(result.references);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not connect to Spending Tracker Server.',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const initialLoad = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(initialLoad);
  }, [refresh]);
  const addTransaction = async (draft: DraftTransaction, mode: EntryMode) => {
    await submitTransaction(createPayload(draft, mode));
    await refresh();
    setSheetOpen(false);
  };
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.appShell}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good morning</Text>
            <Text style={styles.title}>Your money, at a glance.</Text>
          </View>
          <Pressable
            accessibilityLabel="Refresh transactions"
            onPress={() => void refresh()}
            style={styles.avatar}
          >
            <Ionicons name="refresh" size={20} color={colors.white} />
          </Pressable>
        </View>
        {loading && !transactions.length ? (
          <View style={styles.state}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.stateText}>Loading your budget…</Text>
          </View>
        ) : error && !transactions.length ? (
          <View style={styles.state}>
            <Ionicons name="cloud-offline-outline" size={42} color={colors.accentDark} />
            <Text style={styles.stateTitle}>Couldn’t load your budget</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable onPress={() => void refresh()} style={styles.retryButton}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <TransactionRow item={item} />}
            ListHeaderComponent={
              <>
                <SummaryCard transactions={transactions} />
                {error ? (
                  <Pressable onPress={() => void refresh()} style={styles.inlineError}>
                    <Text style={styles.inlineErrorText}>{error} Tap to retry.</Text>
                  </Pressable>
                ) : null}
                <View style={styles.listHeading}>
                  <Text style={styles.sectionTitle}>Recent transactions</Text>
                  <Text style={styles.filterText}>{transactions.length} loaded</Text>
                </View>
              </>
            }
            ListEmptyComponent={<Text style={styles.emptyText}>No transactions yet.</Text>}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
        {!loading && !error && (
          <Pressable
            accessibilityLabel="Add transaction"
            onPress={() => setSheetOpen(true)}
            style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          >
            <Ionicons name="add" size={32} color={colors.white} />
          </Pressable>
        )}
      </View>
      <EntrySheet
        visible={sheetOpen}
        references={references}
        onClose={() => setSheetOpen(false)}
        onSave={addTransaction}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  appShell: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },
  content: { paddingHorizontal: 22, paddingBottom: 120 },
  header: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: { color: colors.muted, fontSize: 14, marginBottom: 5 },
  title: { color: colors.ink, fontSize: 25, fontWeight: '700', letterSpacing: -0.6 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    backgroundColor: colors.ink,
    borderRadius: 25,
    padding: 24,
    marginBottom: 30,
    shadowColor: '#28231D',
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 6,
  },
  eyebrow: { color: '#B8B9B1', fontSize: 11, letterSpacing: 1.4, fontWeight: '700' },
  balance: {
    color: colors.white,
    fontSize: 33,
    fontWeight: '700',
    marginTop: 8,
    letterSpacing: -1,
  },
  summaryDivider: { height: 1, backgroundColor: '#41443E', marginVertical: 20 },
  summaryRow: { flexDirection: 'row', gap: 38 },
  summaryMetric: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  incomeDot: { backgroundColor: '#71C69E' },
  spentDot: { backgroundColor: '#F18860' },
  metricLabel: { color: '#AEB0A8', fontSize: 12 },
  metricValue: { color: colors.white, fontSize: 15, fontWeight: '600', marginTop: 2 },
  listHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: '700' },
  filterText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  transactionRow: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  transactionIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  expenseIcon: { backgroundColor: '#FBE6D9' },
  incomeIcon: { backgroundColor: '#DDF0E5' },
  transactionCopy: { flex: 1 },
  merchant: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  transactionMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  transactionDate: { color: '#A0A299', fontSize: 11, marginTop: 3 },
  amount: { color: colors.ink, fontSize: 14, fontWeight: '700', marginLeft: 8 },
  incomeAmount: { color: colors.green },
  separator: { height: 1, backgroundColor: colors.line, marginLeft: 58 },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 28,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accentDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 13,
    elevation: 9,
  },
  fabPressed: { transform: [{ scale: 0.96 }], backgroundColor: colors.accentDark },
  state: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { color: colors.ink, fontSize: 20, fontWeight: '700', marginTop: 16 },
  stateText: { color: colors.muted, textAlign: 'center', lineHeight: 20, marginTop: 9 },
  retryButton: {
    backgroundColor: colors.ink,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  retryText: { color: colors.white, fontWeight: '700' },
  inlineError: { backgroundColor: '#FBE6D9', borderRadius: 12, padding: 12, marginBottom: 18 },
  inlineErrorText: { color: colors.accentDark, fontSize: 12 },
  emptyText: { color: colors.muted, textAlign: 'center', padding: 40 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', inset: 0, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: '92%',
    paddingHorizontal: 22,
    paddingBottom: Platform.OS === 'ios' ? 28 : 22,
  },
  handle: {
    width: 42,
    height: 5,
    backgroundColor: '#D3CEC4',
    borderRadius: 4,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 17,
  },
  sheetHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  sheetTitle: { color: colors.ink, fontSize: 24, fontWeight: '700' },
  sheetSubtitle: { color: colors.muted, fontSize: 13, marginTop: 4 },
  closeButton: {
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmented: {
    backgroundColor: colors.canvas,
    borderRadius: 13,
    padding: 4,
    flexDirection: 'row',
    marginBottom: 18,
  },
  segment: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  activeSegment: {
    backgroundColor: colors.white,
    shadowColor: '#403A32',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  segmentText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  activeSegmentText: { color: colors.ink, fontWeight: '700' },
  form: { paddingBottom: 8 },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { color: colors.ink, fontSize: 12, fontWeight: '700', marginBottom: 7 },
  choiceRow: { gap: 8, paddingRight: 8 },
  choice: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 13,
    minHeight: 39,
    justifyContent: 'center',
    borderRadius: 20,
  },
  activeChoice: { borderColor: colors.accent, backgroundColor: '#FBE6D9' },
  choiceText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  activeChoiceText: { color: colors.accentDark },
  field: {
    height: 49,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    gap: 9,
  },
  multilineField: { height: 70, alignItems: 'flex-start', paddingTop: 13 },
  input: { flex: 1, color: colors.ink, fontSize: 14, outlineStyle: 'none' } as never,
  multilineInput: { minHeight: 44, textAlignVertical: 'top' },
  splitCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 13,
    marginBottom: 13,
    backgroundColor: '#FAF7F1',
  },
  splitTitle: { color: colors.ink, fontWeight: '700', marginBottom: 12 },
  errorText: { color: colors.accentDark, fontSize: 12, marginBottom: 12 },
  sheetActions: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: 15,
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    minHeight: 49,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  saveButton: {
    flex: 1,
    minHeight: 49,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  disabledButton: { opacity: 0.42 },
  saveText: { color: colors.white, fontWeight: '700', fontSize: 14 },
});
