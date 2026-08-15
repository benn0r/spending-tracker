import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { formatLocalDate } from '../../app-model';
import { DrawerSheet } from '../../components/DrawerSheet';
import { styles } from '../../styles';
import { colors } from '../../theme';
import { emptyDraft, isDraftValid } from '../../transactions';
import type {
  DraftTransaction,
  EntryMode,
  ExpenseSplitSelection,
  ExpenseSplitSummary,
  References,
} from '../../types';
import { CategoryPickerField } from './fields/CategoryPickerField';
import { ChoiceField } from './fields/ChoiceField';
import { DatePickerField } from './fields/DatePickerField';
import { TextField } from './fields/TextField';

export function EntrySheet({
  visible,
  references,
  expenseSplits = [],
  defaultAccount,
  initialDraft,
  initialMode = 'transaction',
  onClose,
  onSave,
}: {
  visible: boolean;
  references: References;
  expenseSplits?: ExpenseSplitSummary[];
  defaultAccount: string;
  initialDraft?: DraftTransaction | null;
  initialMode?: EntryMode;
  onClose: () => void;
  onSave: (
    draft: DraftTransaction,
    mode: EntryMode,
    expenseSplit?: ExpenseSplitSelection,
  ) => Promise<void>;
}) {
  const [mode, setMode] = useState<EntryMode>('transaction');
  const [draft, setDraft] = useState<DraftTransaction>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [categoryPicker, setCategoryPicker] = useState<'main' | `split-${number}` | null>(null);
  const [shareExpense, setShareExpense] = useState(false);
  const [expenseSplitChoice, setExpenseSplitChoice] = useState('');
  const [newSplitTitle, setNewSplitTitle] = useState('');
  const [newSplitCount, setNewSplitCount] = useState('2');
  const amountInputRef = useRef<TextInput>(null);
  const wasVisible = useRef(false);
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
    setCategoryPicker(null);
    setShareExpense(false);
    setExpenseSplitChoice('');
    setNewSplitTitle('');
    setNewSplitCount('2');
  };
  const closeCategoryAndFocusAmount = () => {
    setCategoryPicker(null);
    setTimeout(() => amountInputRef.current?.focus(), 300);
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
      const expenseSplit = !shareExpense
        ? undefined
        : expenseSplitChoice === '__new__'
          ? {
              mode: 'new' as const,
              ...(newSplitTitle.trim() ? { title: newSplitTitle.trim() } : {}),
              splitCount: Number(newSplitCount),
            }
          : { mode: 'existing' as const, splitId: Number(expenseSplitChoice) };
      if (expenseSplit) await onSave(draft, mode, expenseSplit);
      else await onSave(draft, mode);
      reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the transaction.');
    } finally {
      setSaving(false);
    }
  };
  useEffect(() => {
    if (visible && !wasVisible.current) {
      setDraft(
        initialDraft ?? {
          ...emptyDraft,
          account: defaultAccount,
          date: formatLocalDate(new Date()),
        },
      );
      setMode(initialMode);
      setCategoryPicker(initialDraft?.category ? null : 'main');
    }
    wasVisible.current = visible;
  }, [defaultAccount, initialDraft, initialMode, visible]);
  const expenseSplitValid =
    !shareExpense ||
    (expenseSplitChoice === '__new__'
      ? Number.isInteger(Number(newSplitCount)) && Number(newSplitCount) > 0
      : Number.isInteger(Number(expenseSplitChoice)) && Number(expenseSplitChoice) > 0);
  const formValid = isDraftValid(draft, mode) && expenseSplitValid;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          accessibilityLabel="Close transaction form"
          style={styles.scrim}
          onPress={close}
        />
        <DrawerSheet style={styles.sheet} testID="entry-sheet">
          <View style={styles.handle} />
          <View style={styles.sheetHeading}>
            <View style={styles.sheetTitleGroup}>
              <View style={styles.sheetTitleIcon}>
                <Ionicons name="card-outline" size={20} color={colors.accent} />
              </View>
              <Text style={styles.sheetTitle}>New expense</Text>
            </View>
            <View style={styles.sheetHeadingActions}>
              <View accessibilityRole="tablist" style={styles.modeToggle}>
                <Pressable
                  accessibilityRole="tab"
                  accessibilityLabel="Transaction"
                  accessibilityState={{ selected: mode === 'transaction' }}
                  onPress={() => setMode('transaction')}
                  style={[styles.modeButton, mode === 'transaction' && styles.activeModeButton]}
                >
                  <Ionicons
                    name="receipt-outline"
                    size={18}
                    color={mode === 'transaction' ? colors.white : colors.muted}
                  />
                </Pressable>
                <Pressable
                  accessibilityRole="tab"
                  accessibilityLabel="Split transaction"
                  accessibilityState={{ selected: mode === 'split' }}
                  onPress={() => setMode('split')}
                  style={[styles.modeButton, mode === 'split' && styles.activeModeButton]}
                >
                  <Ionicons
                    name="git-branch-outline"
                    size={18}
                    color={mode === 'split' ? colors.white : colors.muted}
                  />
                </Pressable>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={close}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={21} color={colors.ink} />
              </Pressable>
            </View>
          </View>
          <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={styles.form}>
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
              inputRef={amountInputRef}
            />
            <DatePickerField value={draft.date} onChange={(value) => update('date', value)} />
            {!initialDraft ? (
              <>
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityLabel="Add to expense split"
                  accessibilityState={{ checked: shareExpense }}
                  onPress={() => setShareExpense((current) => !current)}
                  style={styles.expenseSplitToggle}
                >
                  <View
                    style={[
                      styles.expenseSplitCheckbox,
                      shareExpense && styles.expenseSplitCheckboxChecked,
                    ]}
                  >
                    {shareExpense ? (
                      <Ionicons name="checkmark" size={15} color={colors.white} />
                    ) : null}
                  </View>
                  <View style={styles.expenseSplitToggleCopy}>
                    <Text style={styles.expenseSplitToggleTitle}>Split this expense</Text>
                    <Text style={styles.expenseSplitToggleText}>
                      Add it to an expense-sharing split.
                    </Text>
                  </View>
                </Pressable>
                {shareExpense ? (
                  <View style={styles.expenseSplitFields}>
                    <ChoiceField
                      label="Expense split"
                      value={expenseSplitChoice}
                      options={[
                        ...expenseSplits.map((split) => ({
                          id: String(split.id),
                          name: `${split.title} · ${split.splitCount} people`,
                        })),
                        { id: '__new__', name: 'Create new split' },
                      ]}
                      onChange={setExpenseSplitChoice}
                    />
                    {expenseSplitChoice === '__new__' ? (
                      <>
                        <TextField
                          label="Split name"
                          value={newSplitTitle}
                          onChangeText={setNewSplitTitle}
                          placeholder={`Split from ${(draft.date || formatLocalDate(new Date()))
                            .split('-')
                            .reverse()
                            .join('.')}`}
                          icon="people-outline"
                        />
                        <TextField
                          label="Number of people"
                          value={newSplitCount}
                          onChangeText={setNewSplitCount}
                          placeholder="2"
                          icon="person-add-outline"
                          keyboardType="number-pad"
                        />
                      </>
                    ) : null}
                  </View>
                ) : null}
              </>
            ) : null}
            {mode === 'transaction' ? (
              <>
                <CategoryPickerField
                  key={`main-category-${visible}`}
                  value={draft.category}
                  options={references.categories}
                  onChange={(value) => update('category', value)}
                  open={categoryPicker === 'main'}
                  onRequestOpen={() => setCategoryPicker('main')}
                  onDismiss={closeCategoryAndFocusAmount}
                />
                <ChoiceField
                  label="Tags"
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
                    <CategoryPickerField
                      key={`split-category-${index}-${visible}`}
                      value={split.category}
                      options={references.categories}
                      onChange={(value) => updateSplit(index, 'category', value)}
                      open={categoryPicker === `split-${index}`}
                      onRequestOpen={() => setCategoryPicker(`split-${index}`)}
                      onDismiss={closeCategoryAndFocusAmount}
                      accessibilityLabel={`Select category for Split ${index + 1}`}
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
                      label="Tags"
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
              accessibilityLabel="Save expense"
              accessibilityState={{ disabled: !formValid || saving }}
              disabled={!formValid || saving}
              onPress={save}
              style={[styles.saveButton, (!formValid || saving) && styles.disabledButton]}
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
        </DrawerSheet>
      </KeyboardAvoidingView>
    </Modal>
  );
}
