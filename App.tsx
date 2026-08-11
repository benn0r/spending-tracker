import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Animated,
  Easing,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ApiError,
  deleteReceipt,
  deleteTransaction,
  describeSubmissionError,
  loadDashboard,
  loadReceipts,
  loadTransactionPage,
  receiptFileSource,
  submitReceiptTransaction,
  submitTransaction,
  uploadReceipt,
} from './src/api';
import {
  createPayload,
  emptyDraft,
  formatCurrency,
  formatDateHeader,
  isDraftValid,
  limitTransactionCache,
  parseTransactionCache,
  summarize,
} from './src/transactions';
import { colors } from './src/theme';
import type {
  ApiTransaction,
  ApiReceipt,
  CategoryReference,
  DraftTransaction,
  EntryMode,
  Reference,
  References,
  TransactionPayload,
} from './src/types';

const emptyReferences: References = { accounts: [], categories: [], tags: [] };
const defaultAccountStorageKey = 'spending-tracker.default-account';
const transactionQueueStorageKey = 'spending-tracker.transaction-queue';
const transactionCacheStorageKey = 'spending-tracker.transactions-v1';
const referenceCacheStorageKey = 'spending-tracker.references-v1';

function parseReferenceCache(value: string | null): References | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<References>;
    if (
      !Array.isArray(parsed.accounts) ||
      !Array.isArray(parsed.categories) ||
      !Array.isArray(parsed.tags)
    )
      return null;
    return parsed as References;
  } catch {
    return null;
  }
}
type AppTab = 'transactions' | 'wallets' | 'receipts' | 'settings';
type QueuedTransaction = {
  id: string;
  payload: TransactionPayload;
  mode: EntryMode;
  account: string;
  category: string;
  error: string;
};

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

const SwipeContext = createContext<{
  closeVersion: number;
  openId: string | null;
  setOpenId: (id: string | null) => void;
}>({ closeVersion: 0, openId: null, setOpenId: () => undefined });

function SwipeProvider({ children }: { children: ReactNode }) {
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

function SwipeToDelete({
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

function TransactionRow({
  item,
  categories,
  onDelete,
}: {
  item: ApiTransaction;
  categories: CategoryReference[];
  onDelete: (item: ApiTransaction) => void;
}) {
  const title = item.payee && item.payee !== '—' ? item.payee : item.category;
  const serverCategory = categories.find(
    ({ name }) => name.toLowerCase() === item.category.toLowerCase(),
  );
  const serverVisual = serverCategory ? categoryVisual(serverCategory, 0) : null;
  const icon = item.amount > 0 ? 'wallet-outline' : (serverVisual?.icon ?? iconFor(item));
  const iconColor = item.amount > 0 ? colors.green : (serverVisual?.color ?? colors.accentDark);
  const iconBackground = item.amount > 0 ? '#DDF0E5' : `${iconColor}1A`;
  return (
    <SwipeToDelete
      id={`transaction-${item.id}`}
      label={title}
      revealSpacing={12}
      onDelete={() => onDelete(item)}
    >
      <View style={styles.transactionRow} testID={`transaction-${item.id}`}>
        <View style={[styles.transactionIcon, { backgroundColor: iconBackground }]}>
          <Ionicons name={icon} size={21} color={iconColor} />
        </View>
        <View style={styles.transactionCopy}>
          <Text style={styles.merchant}>{title}</Text>
          <Text style={styles.transactionMeta}>
            {item.category} · {item.account}
          </Text>
        </View>
        <Text style={[styles.amount, item.amount > 0 && styles.incomeAmount]}>
          {formatCurrency(item.amount)}
        </Text>
      </View>
    </SwipeToDelete>
  );
}

function TransactionQueue({
  items,
  retrying,
  onRetry,
  onDiscard,
}: {
  items: QueuedTransaction[];
  retrying: string | null;
  onRetry: (item: QueuedTransaction) => void;
  onDiscard: (item: QueuedTransaction) => void;
}) {
  if (!items.length) return null;
  return (
    <View style={styles.queuePanel} testID="transaction-queue">
      <View style={styles.queueHeading}>
        <View style={styles.queueHeadingCopy}>
          <View style={styles.queueStatusDot} />
          <Text style={styles.queueTitle}>Waiting to sync</Text>
        </View>
        <Text style={styles.queueCount}>{items.length}</Text>
      </View>
      <Text style={styles.queueIntro}>
        These expenses are saved on this device. Retry when the server is available.
      </Text>
      {items.map((item) => (
        <View key={item.id} style={styles.queueItem}>
          <View style={styles.queueItemIcon}>
            <Ionicons name="cloud-offline-outline" size={20} color={colors.accentDark} />
          </View>
          <View style={styles.queueItemCopy}>
            <Text style={styles.queueItemTitle}>{item.category}</Text>
            <Text style={styles.queueItemMeta}>{item.account}</Text>
            <Text style={styles.queueItemError} selectable>
              {item.error}
            </Text>
          </View>
          <View style={styles.queueItemAction}>
            <Text style={styles.queueItemAmount}>{formatCurrency(item.payload.amount)}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Retry ${item.category}`}
              disabled={retrying === item.id}
              onPress={() => onRetry(item)}
              style={styles.retryQueueButton}
            >
              {retrying === item.id ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <>
                  <Ionicons name="refresh" size={14} color={colors.accent} />
                  <Text style={styles.retryQueueText}>Retry</Text>
                </>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.category} from queue`}
              disabled={retrying === item.id}
              onPress={() => onDiscard(item)}
              style={styles.discardQueueButton}
            >
              <Text style={styles.discardQueueText}>Dismiss</Text>
            </Pressable>
          </View>
        </View>
      ))}
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
  const [tagSearchOpen, setTagSearchOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState('');
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const choiceScrollRef = useRef<ScrollView>(null);
  const orderedOptions = [
    ...options.filter(({ id }) => selected.includes(id)),
    ...options.filter(({ id }) => !selected.includes(id)),
  ];
  const filteredOptions = options.filter(({ name }) =>
    name.toLocaleLowerCase().includes(tagQuery.trim().toLocaleLowerCase()),
  );
  const toggleOption = (option: Reference) => {
    const active = selected.includes(option.id);
    if (multiple)
      onChange(
        (active ? selected.filter((id) => id !== option.id) : [...selected, option.id]) as never,
      );
    else onChange(option.id as never);
  };
  return (
    <View style={styles.fieldGroup}>
      <View style={styles.choiceControl}>
        <ScrollView
          ref={choiceScrollRef}
          accessibilityLabel={label}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.choiceScroller}
          contentContainerStyle={styles.choiceRow}
        >
          {orderedOptions.map((option) => {
            const active = selected.includes(option.id);
            return (
              <Pressable
                key={option.id}
                accessibilityRole={multiple ? 'checkbox' : 'radio'}
                accessibilityState={{ checked: active }}
                aria-checked={active}
                onPress={() => toggleOption(option)}
                style={[styles.choice, active && styles.activeChoice]}
              >
                <Text style={[styles.choiceText, active && styles.activeChoiceText]}>
                  {option.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {multiple ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search tags"
            onPress={() => {
              setTagQuery('');
              setPendingTags(selected);
              setTagSearchOpen(true);
            }}
            style={styles.tagSearchButton}
          >
            <Ionicons name="search" size={19} color={colors.accent} />
          </Pressable>
        ) : null}
      </View>
      {multiple ? (
        <Modal
          visible={tagSearchOpen}
          transparent
          animationType={Platform.OS === 'web' ? 'none' : 'slide'}
          onRequestClose={() => setTagSearchOpen(false)}
        >
          <View style={styles.nestedModalRoot}>
            <Pressable
              accessibilityLabel="Close tag search"
              onPress={() => setTagSearchOpen(false)}
              style={styles.nestedScrim}
            />
            <View style={styles.tagSearchSheet} testID="tag-search-sheet">
              <View style={styles.handle} />
              <View style={styles.tagSearchHeader}>
                <Text style={styles.categorySheetTitle}>Choose tags</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Done selecting tags"
                  onPress={() => {
                    onChange(pendingTags as never);
                    setTagSearchOpen(false);
                    setTimeout(() => choiceScrollRef.current?.scrollTo({ x: 0, animated: true }));
                  }}
                  style={styles.dateDoneButton}
                >
                  <Text style={styles.dateDoneText}>Done</Text>
                </Pressable>
              </View>
              <View style={styles.tagSearchField}>
                <Ionicons name="search" size={20} color={colors.muted} />
                <TextInput
                  accessibilityLabel="Search tags"
                  value={tagQuery}
                  onChangeText={setTagQuery}
                  placeholder="Search tags"
                  placeholderTextColor="#A7A99F"
                  style={styles.input}
                />
              </View>
              <ScrollView
                contentContainerStyle={styles.tagSearchList}
                keyboardShouldPersistTaps="always"
              >
                {filteredOptions.map((item) => {
                  const active = pendingTags.includes(item.id);
                  const selectTag = () => {
                    const next = active
                      ? pendingTags.filter((id) => id !== item.id)
                      : [...pendingTags, item.id];
                    setPendingTags(next);
                  };
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: active }}
                      aria-checked={active}
                      onPress={selectTag}
                      style={[styles.tagSearchOption, active && styles.activeTagSearchOption]}
                    >
                      <View style={[styles.tagCheckbox, active && styles.activeTagCheckbox]}>
                        {active ? (
                          <Ionicons name="checkmark" size={15} color={colors.white} />
                        ) : null}
                      </View>
                      <Text style={styles.tagSearchOptionText}>{item.name}</Text>
                    </Pressable>
                  );
                })}
                {!filteredOptions.length ? (
                  <Text style={styles.emptyText}>No matching tags.</Text>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function categoryVisual(category: CategoryReference, index: number) {
  const fallbackColors = ['#77409A', '#3C91C9', '#B87545', '#D84E8D', '#25836B'];
  const icon = category.icon as keyof typeof Ionicons.glyphMap | undefined;
  return {
    icon: icon && icon in Ionicons.glyphMap ? icon : 'pricetag',
    color: /^#[0-9a-fA-F]{6}$/.test(category.color ?? '')
      ? (category.color as string)
      : (fallbackColors[index % fallbackColors.length] ?? colors.accent),
  };
}

function CategoryPickerField({
  value,
  options,
  onChange,
  open,
  onRequestOpen,
  onDismiss,
  accessibilityLabel = 'Select category',
}: {
  value: string;
  options: Reference[];
  onChange: (value: string) => void;
  open: boolean;
  onRequestOpen: () => void;
  onDismiss: () => void;
  accessibilityLabel?: string;
}) {
  const selected = options.find(({ id }) => id === value);
  return (
    <View style={styles.fieldGroup}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onRequestOpen}
        style={({ pressed }) => [styles.categoryField, pressed && styles.categoryFieldPressed]}
      >
        {selected ? (
          <View style={styles.categoryFieldSelection}>
            <View style={styles.categoryFieldIcon}>
              <Ionicons
                name={categoryVisual(selected, options.indexOf(selected)).icon}
                size={19}
                color={categoryVisual(selected, options.indexOf(selected)).color}
              />
            </View>
            <Text style={styles.categoryFieldText}>{selected.name}</Text>
          </View>
        ) : (
          <View style={styles.categoryFieldSelection}>
            <Ionicons name="grid-outline" size={20} color={colors.muted} />
            <Text style={styles.categoryPlaceholder}>Choose a category</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={onDismiss}>
        <View style={styles.nestedModalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close category picker"
            style={styles.nestedScrim}
            onPress={onDismiss}
          />
          <View style={styles.categorySheet} testID="category-sheet">
            <View style={styles.handle} />
            <View style={styles.categorySheetHeader}>
              <View>
                <Text style={styles.categorySheetTitle}>Transaction category</Text>
                <Text style={styles.categorySheetSubtitle}>
                  Choose from categories enabled on the server.
                </Text>
              </View>
            </View>
            <FlatList
              data={options}
              keyExtractor={({ id }) => id}
              numColumns={3}
              contentContainerStyle={styles.categoryGrid}
              columnWrapperStyle={styles.categoryGridRow}
              ListEmptyComponent={
                <Text style={styles.categoryEmpty}>No categories are enabled on the server.</Text>
              }
              renderItem={({ item, index }) => {
                const visual = categoryVisual(item, index);
                const active = value === item.id;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    aria-checked={active}
                    onPress={() => {
                      onChange(item.id);
                      onDismiss();
                    }}
                    style={styles.categoryTile}
                  >
                    <View
                      style={[styles.categoryTileIcon, active && styles.activeCategoryTileIcon]}
                    >
                      <Ionicons name={visual.icon} size={29} color={visual.color} />
                      {active ? (
                        <View style={styles.categoryCheckBadge}>
                          <Ionicons name="checkmark" size={12} color={colors.white} />
                        </View>
                      ) : null}
                    </View>
                    <Text
                      numberOfLines={2}
                      style={[styles.categoryTileText, active && styles.activeCategoryTileText]}
                    >
                      {item.name}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
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
  inputRef,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  icon: keyof typeof Ionicons.glyphMap;
  multiline?: boolean;
  keyboardType?: 'decimal-pad';
  inputRef?: React.RefObject<TextInput | null>;
}) {
  return (
    <View style={styles.fieldGroup}>
      <View style={[styles.field, multiline && styles.multilineField]}>
        <Ionicons name={icon} size={20} color={colors.muted} />
        <TextInput
          ref={inputRef}
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

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromString(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date();
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function DatePickerField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const today = localDateString(new Date());
  const selected = value || today;
  const chooseDate = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') setOpen(false);
    if (date) onChange(localDateString(date));
  };
  return (
    <View style={styles.fieldGroup}>
      <View style={[styles.dateShortcuts, styles.fieldControl]}>
        {Platform.OS === 'web' ? (
          <View style={[styles.dateCalendarButton, styles.webDateInput]}>
            <Ionicons name="calendar-outline" size={18} color={colors.accent} />
            <TextInput
              accessibilityLabel="Date"
              value={selected}
              onChangeText={onChange}
              style={styles.webDateTextInput}
            />
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open date calendar"
            onPress={() => setOpen(true)}
            style={styles.dateCalendarButton}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.accent} />
            <Text style={styles.dateCalendarText}>{formatDateHeader(selected)}</Text>
          </Pressable>
        )}
      </View>
      {open && Platform.OS === 'android' ? (
        <DateTimePicker value={dateFromString(selected)} mode="date" onChange={chooseDate} />
      ) : null}
      <Modal
        visible={open && Platform.OS === 'ios'}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.nestedModalRoot}>
          <Pressable style={styles.nestedScrim} onPress={() => setOpen(false)} />
          <View style={styles.datePickerSheet}>
            <View style={styles.handle} />
            <View style={styles.datePickerHeader}>
              <Text style={styles.categorySheetTitle}>Transaction date</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Confirm date"
                onPress={() => setOpen(false)}
                style={styles.dateDoneButton}
              >
                <Text style={styles.dateDoneText}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={dateFromString(selected)}
              mode="date"
              display="inline"
              onChange={chooseDate}
              accentColor={colors.accent}
              style={styles.datePicker}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function AccountDropdown({
  value,
  options,
  onChange,
  label = 'Default account',
  hint = 'Preselected for every new expense',
  accessibilityLabel = 'Select default account',
}: {
  value: string;
  options: Reference[];
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
  accessibilityLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find(({ id }) => id === value);
  return (
    <View>
      <Text style={styles.settingsLabel}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={() => setOpen(true)}
        style={styles.settingsSelect}
      >
        <View style={styles.settingsSelectCopy}>
          <View style={styles.settingsSelectIcon}>
            <Ionicons name="wallet-outline" size={21} color={colors.accent} />
          </View>
          <View>
            <Text style={styles.settingsSelectValue}>{selected?.name ?? 'Choose an account'}</Text>
            <Text style={styles.settingsSelectHint}>{hint}</Text>
          </View>
        </View>
        <Ionicons name="chevron-down" size={20} color={colors.muted} />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.nestedModalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close account selector"
            style={styles.nestedScrim}
            onPress={() => setOpen(false)}
          />
          <View style={styles.accountSheet} testID="account-sheet">
            <View style={styles.handle} />
            <Text style={styles.categorySheetTitle}>{label}</Text>
            <Text style={styles.categorySheetSubtitle}>
              Choose from accounts enabled on the server.
            </Text>
            <ScrollView contentContainerStyle={styles.accountOptions}>
              {options.map((option) => {
                const active = option.id === value;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    aria-checked={active}
                    onPress={() => {
                      onChange(option.id);
                      setOpen(false);
                    }}
                    style={[styles.accountOption, active && styles.activeAccountOption]}
                  >
                    <View style={styles.accountOptionIcon}>
                      <Ionicons name="card-outline" size={20} color={colors.accent} />
                    </View>
                    <Text
                      style={[styles.accountOptionText, active && styles.activeAccountOptionText]}
                    >
                      {option.name}
                    </Text>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                    ) : null}
                  </Pressable>
                );
              })}
              {!options.length ? (
                <Text style={styles.categoryEmpty}>No accounts are enabled on the server.</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function receiptDraft(
  receipt: ApiReceipt,
  categories: CategoryReference[],
  tags: Reference[],
): { draft: DraftTransaction; mode: EntryMode } | null {
  const suggestion = receipt.suggestion;
  if (!suggestion || !receipt.account) return null;
  const enabledCategories = new Set(categories.map(({ id }) => id));
  const enabledTags = new Set(tags.map(({ id }) => id));
  const splits = suggestion.splits
    .filter(({ category }) => enabledCategories.has(category))
    .map((split) => ({
      category: split.category,
      amount: String(Math.abs(split.amount)),
      tags: split.tags.filter((tag) => enabledTags.has(tag)),
    }));
  const mode: EntryMode = splits.length >= 2 ? 'split' : 'transaction';
  return {
    mode,
    draft: {
      ...emptyDraft,
      account: receipt.account,
      category: enabledCategories.has(suggestion.category) ? suggestion.category : '',
      date: suggestion.date,
      amount: String(Math.abs(suggestion.amount)),
      tags: suggestion.tags.filter((tag) => enabledTags.has(tag)),
      comment: [suggestion.merchant, suggestion.notes].filter(Boolean).join(' · '),
      splits: mode === 'split' ? splits : emptyDraft.splits,
    },
  };
}

function ReceiptsScreen({
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
      {loading && !receipts.length ? (
        <ActivityIndicator color={colors.accent} style={styles.loadingMore} />
      ) : (
        <ScrollView contentContainerStyle={styles.receiptsContent}>
          {uploading ? (
            <View style={styles.receiptCard}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.receiptCardTitle}>Uploading receipt…</Text>
            </View>
          ) : null}
          {receipts.map((receipt) => {
            const prepared = receiptDraft(receipt, categories, tags);
            return (
              <SwipeToDelete
                id={`receipt-${receipt.id}`}
                key={receipt.id}
                label={receipt.suggestion?.merchant || receipt.filename}
                bordered
                onDelete={() => onDelete(receipt)}
              >
                <View style={styles.receiptCard} testID={`receipt-${receipt.id}`}>
                  <View style={styles.receiptCardIcon}>
                    <Ionicons name="receipt-outline" size={23} color={colors.accent} />
                  </View>
                  <View style={styles.receiptCardCopy}>
                    <Text style={styles.receiptCardTitle}>
                      {receipt.suggestion?.merchant || receipt.filename}
                    </Text>
                    <Text style={styles.receiptCardMeta}>
                      {receipt.status === 'processed'
                        ? `${receipt.suggestion?.currency ?? ''} ${receipt.suggestion?.amount ?? ''}`
                        : receipt.status === 'failed'
                          ? receipt.error || 'Processing failed'
                          : 'Processing receipt…'}
                    </Text>
                  </View>
                  <View style={styles.receiptActions}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`View ${receipt.suggestion?.merchant || receipt.filename}`}
                      onPress={() => {
                        setPreviewLoading(true);
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
              </SwipeToDelete>
            );
          })}
          {!receipts.length && !uploading ? (
            <View style={styles.emptyScreenCard}>
              <View style={styles.emptyScreenIcon}>
                <Ionicons name="receipt-outline" size={34} color={colors.accent} />
              </View>
              <Text style={styles.emptyScreenTitle}>No receipts yet</Text>
              <Text style={styles.emptyScreenText}>Tap + to scan your first receipt.</Text>
            </View>
          ) : null}
        </ScrollView>
      )}
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
            {previewReceipt?.mimeType.startsWith('image/') ? (
              <Image
                accessibilityLabel={`Receipt photo ${previewReceipt.filename}`}
                onError={() => {
                  setPreviewLoading(false);
                  setPreviewError(true);
                }}
                onLoad={() => setPreviewLoading(false)}
                resizeMode="contain"
                source={receiptFileSource(previewReceipt.id)}
                style={styles.receiptPreviewImage}
              />
            ) : (
              <View style={styles.receiptPreviewUnavailable}>
                <Ionicons name="document-outline" size={38} color={colors.accent} />
                <Text style={styles.emptyScreenText}>
                  Photo preview is unavailable for this file.
                </Text>
              </View>
            )}
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

function WalletsScreen({
  accounts,
  categories,
}: {
  accounts: Reference[];
  categories: CategoryReference[];
}) {
  const [wallet, setWallet] = useState('');
  const [items, setItems] = useState<ApiTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const loadingMoreRef = useRef(false);
  const generation = useRef(0);
  const selectedWallet = wallet || accounts[0]?.id || '';

  const refresh = useCallback(async () => {
    if (!selectedWallet) {
      setItems([]);
      setTotal(0);
      return;
    }
    generation.current += 1;
    const requestGeneration = generation.current;
    setLoading(true);
    setError('');
    try {
      const result = await loadTransactionPage(1, 20, selectedWallet);
      if (requestGeneration !== generation.current) return;
      setItems(result.transactions);
      setPage(result.page);
      setTotal(result.total);
    } catch (cause) {
      if (requestGeneration === generation.current)
        setError(cause instanceof Error ? cause.message : 'Could not load wallet transactions.');
    } finally {
      if (requestGeneration === generation.current) setLoading(false);
    }
  }, [selectedWallet]);

  useEffect(() => {
    const initialLoad = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(initialLoad);
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!selectedWallet || loading || loadingMoreRef.current || items.length >= total) return;
    const requestGeneration = generation.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const result = await loadTransactionPage(page + 1, 20, selectedWallet);
      if (requestGeneration !== generation.current) return;
      setItems((current) => {
        const known = new Set(current.map(({ id }) => id));
        return [...current, ...result.transactions.filter(({ id }) => !known.has(id))];
      });
      setPage(result.page);
      setTotal(result.total);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load more transactions.');
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [items.length, loading, page, selectedWallet, total]);

  return (
    <FlatList
      data={items}
      keyExtractor={({ id }) => id}
      renderItem={({ item, index }) => (
        <View>
          {index === 0 || items[index - 1]?.date !== item.date ? (
            <Text style={styles.dateSectionHeader}>{formatDateHeader(item.date)}</Text>
          ) : null}
          <TransactionRow
            item={item}
            categories={categories}
            onDelete={(transaction) => {
              setItems((current) => current.filter(({ id }) => id !== transaction.id));
              setTotal((current) => Math.max(0, current - 1));
              void deleteTransaction(transaction.id).catch(() => void refresh());
            }}
          />
        </View>
      )}
      contentContainerStyle={styles.walletContent}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.secondaryEyebrow}>ACCOUNTS</Text>
          <Text style={styles.secondaryTitle}>Wallets</Text>
          <Text style={styles.settingsIntro}>Choose a wallet to see its transactions.</Text>
          <View style={styles.settingsSection}>
            <AccountDropdown
              value={selectedWallet}
              options={accounts}
              onChange={setWallet}
              label="Wallet"
              hint="Only transactions from this wallet are shown"
              accessibilityLabel="Select wallet"
            />
          </View>
          <View style={styles.walletListHeading}>
            <Text style={styles.sectionTitle}>Wallet transactions</Text>
            <Text style={styles.filterText}>{items.length} loaded</Text>
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={colors.accent} style={styles.loadingMore} />
        ) : (
          <Text style={styles.emptyText}>
            {accounts.length ? 'No transactions in this wallet.' : 'No wallets are enabled.'}
          </Text>
        )
      }
      ListFooterComponent={
        loadingMore ? <ActivityIndicator color={colors.accent} style={styles.loadingMore} /> : null
      }
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void refresh()}
          tintColor={colors.accent}
          colors={[colors.accent]}
          progressBackgroundColor={colors.white}
        />
      }
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.35}
      onScroll={({ nativeEvent }) => {
        const distanceFromEnd =
          nativeEvent.contentSize.height -
          nativeEvent.layoutMeasurement.height -
          nativeEvent.contentOffset.y;
        if (distanceFromEnd < 240) void loadMore();
      }}
      scrollEventThrottle={200}
      showsVerticalScrollIndicator={false}
    />
  );
}

function BottomNavigation({
  active,
  receiptCount,
  onChange,
}: {
  active: AppTab;
  receiptCount: number;
  onChange: (tab: AppTab) => void;
}) {
  const insets = useSafeAreaInsets();
  const tabs: { id: AppTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'transactions', label: 'Transactions', icon: 'swap-horizontal-outline' },
    { id: 'wallets', label: 'Wallets', icon: 'wallet-outline' },
    { id: 'receipts', label: 'Receipts', icon: 'receipt-outline' },
    { id: 'settings', label: 'Settings', icon: 'settings-outline' },
  ];
  return (
    <View
      style={[
        styles.bottomNavigation,
        { minHeight: 76 + insets.bottom, paddingBottom: insets.bottom },
      ]}
    >
      {tabs.map((tab) => {
        const selected = active === tab.id;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.id)}
            style={styles.bottomTab}
          >
            <View style={[styles.bottomTabIcon, selected && styles.activeBottomTabIcon]}>
              <Ionicons name={tab.icon} size={22} color={selected ? colors.accent : colors.muted} />
              {tab.id === 'receipts' && receiptCount > 0 ? (
                <View
                  accessibilityLabel={`${receiptCount} receipts need attention`}
                  testID="receipt-tab-badge"
                  style={styles.receiptBadge}
                >
                  <Text style={styles.receiptBadgeText}>
                    {receiptCount > 99 ? '99+' : receiptCount}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.bottomTabText, selected && styles.activeBottomTabText]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function EntrySheet({
  visible,
  references,
  defaultAccount,
  initialDraft,
  initialMode = 'transaction',
  onClose,
  onSave,
}: {
  visible: boolean;
  references: References;
  defaultAccount: string;
  initialDraft?: DraftTransaction | null;
  initialMode?: EntryMode;
  onClose: () => void;
  onSave: (draft: DraftTransaction, mode: EntryMode) => Promise<void>;
}) {
  const [mode, setMode] = useState<EntryMode>('transaction');
  const [draft, setDraft] = useState<DraftTransaction>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [categoryPicker, setCategoryPicker] = useState<'main' | `split-${number}` | null>(null);
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
      await onSave(draft, mode);
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
          date: localDateString(new Date()),
        },
      );
      setMode(initialMode);
      setCategoryPicker(initialDraft?.category ? null : 'main');
    }
    wasVisible.current = visible;
  }, [defaultAccount, initialDraft, initialMode, visible]);
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
  const [receipts, setReceipts] = useState<ApiReceipt[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(true);
  const [references, setReferences] = useState(emptyReferences);
  const [activeTab, setActiveTab] = useState<AppTab>('transactions');
  const [defaultAccount, setDefaultAccount] = useState('');
  const [queuedTransactions, setQueuedTransactions] = useState<QueuedTransaction[]>([]);
  const [retryingTransaction, setRetryingTransaction] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [receiptEntry, setReceiptEntry] = useState<{
    id: number;
    draft: DraftTransaction;
    mode: EntryMode;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionTotal, setTransactionTotal] = useState(0);
  const [error, setError] = useState('');
  const transactionLoadGeneration = useRef(0);
  const loadingMoreRef = useRef(false);
  const persistTransactionCache = useCallback((items: ApiTransaction[]) => {
    void AsyncStorage.setItem(
      transactionCacheStorageKey,
      JSON.stringify(limitTransactionCache(items)),
    );
  }, []);
  const refreshReceipts = useCallback(async () => {
    try {
      setReceipts(await loadReceipts());
    } finally {
      setReceiptsLoading(false);
    }
  }, []);
  const receiptCount = receipts.filter(
    ({ status, submitted }) =>
      status === 'queued' || status === 'processing' || (status === 'processed' && !submitted),
  ).length;
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let cancelled = false;
    const updateBadge = async () => {
      let permissions = await Notifications.getPermissionsAsync();
      if (receiptCount > 0 && permissions.ios?.allowsBadge !== true) {
        permissions = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: false, allowBadge: true, allowSound: false },
        });
      }
      if (!cancelled && (receiptCount === 0 || permissions.ios?.allowsBadge === true)) {
        await Notifications.setBadgeCountAsync(receiptCount);
      }
    };
    void updateBadge().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [receiptCount]);
  const refresh = useCallback(async () => {
    transactionLoadGeneration.current += 1;
    setLoading(true);
    setError('');
    try {
      const result = await loadDashboard();
      setTransactions(result.page.transactions);
      persistTransactionCache(result.page.transactions);
      setTransactionPage(result.page.page);
      setTransactionTotal(result.page.total);
      setReferences(result.references);
      void AsyncStorage.setItem(referenceCacheStorageKey, JSON.stringify(result.references));
      setDefaultAccount((current) => {
        if (current && !result.references.accounts.some(({ id }) => id === current)) {
          void AsyncStorage.removeItem(defaultAccountStorageKey);
          return '';
        }
        return current;
      });
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not connect to Spending Tracker Server.',
      );
    } finally {
      setLoading(false);
    }
  }, [persistTransactionCache]);
  const loadMoreTransactions = useCallback(async () => {
    if (loading || loadingMoreRef.current || transactions.length >= transactionTotal) return;
    const generation = transactionLoadGeneration.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await loadTransactionPage(transactionPage + 1);
      if (generation !== transactionLoadGeneration.current) return;
      setTransactions((current) => {
        const known = new Set(current.map(({ id }) => id));
        return [...current, ...page.transactions.filter(({ id }) => !known.has(id))];
      });
      setTransactionPage(page.page);
      setTransactionTotal(page.total);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load more transactions.');
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [loading, transactionPage, transactionTotal, transactions.length]);
  useEffect(() => {
    let cancelled = false;
    const hydrateThenRefresh = async () => {
      const [cachedTransactionsValue, cachedReferencesValue] = await Promise.all([
        AsyncStorage.getItem(transactionCacheStorageKey).catch(() => null),
        AsyncStorage.getItem(referenceCacheStorageKey).catch(() => null),
      ]);
      const cached = parseTransactionCache(cachedTransactionsValue);
      const cachedReferences = parseReferenceCache(cachedReferencesValue);
      if (cancelled) return;
      if (cached.length) {
        setTransactions(cached);
        setTransactionPage(1);
        setTransactionTotal(cached.length);
      }
      if (cachedReferences) setReferences(cachedReferences);
      void refresh();
    };
    void hydrateThenRefresh();
    return () => {
      cancelled = true;
    };
  }, [refresh]);
  useEffect(() => {
    const initialLoad = setTimeout(() => void refreshReceipts().catch(() => undefined), 0);
    return () => clearTimeout(initialLoad);
  }, [refreshReceipts]);
  useEffect(() => {
    if (!receipts.some(({ status }) => status === 'queued' || status === 'processing')) return;
    const poll = setTimeout(() => void refreshReceipts().catch(() => undefined), 2_500);
    return () => clearTimeout(poll);
  }, [receipts, refreshReceipts]);
  useEffect(() => {
    void AsyncStorage.getItem(defaultAccountStorageKey).then((stored) => {
      if (stored) setDefaultAccount(stored);
    });
    void AsyncStorage.getItem(transactionQueueStorageKey).then((stored) => {
      if (!stored) return;
      try {
        const queue = JSON.parse(stored) as QueuedTransaction[];
        if (Array.isArray(queue)) setQueuedTransactions(queue);
      } catch {
        void AsyncStorage.removeItem(transactionQueueStorageKey);
      }
    });
  }, []);
  const chooseDefaultAccount = (account: string) => {
    setDefaultAccount(account);
    void AsyncStorage.setItem(defaultAccountStorageKey, account);
  };
  const addTransaction = async (draft: DraftTransaction, mode: EntryMode) => {
    const submittedReceipt = receiptEntry;
    const payload = createPayload(draft, mode);
    const account = references.accounts.find(({ id }) => id === payload.account)?.name;
    const category =
      mode === 'split'
        ? 'Split transaction'
        : references.categories.find(({ id }) => id === payload.category)?.name;
    let created: Awaited<ReturnType<typeof submitTransaction>>;
    try {
      created = receiptEntry
        ? await submitReceiptTransaction(receiptEntry.id, payload)
        : await submitTransaction(payload);
    } catch (cause) {
      if (receiptEntry) throw cause;
      const diagnostic = describeSubmissionError(cause);
      if (cause instanceof ApiError && cause.status !== undefined && cause.status < 500)
        throw cause;
      setQueuedTransactions((current) => {
        const baseId = `queued-${payload.date}-${payload.account}-${Math.abs(payload.amount)}`;
        let suffix = 1;
        while (current.some(({ id }) => id === `${baseId}-${suffix}`)) suffix += 1;
        const queued: QueuedTransaction = {
          id: `${baseId}-${suffix}`,
          payload,
          mode,
          account: account ?? 'Unknown account',
          category: category ?? 'Uncategorized',
          error: diagnostic,
        };
        const next = [queued, ...current];
        void AsyncStorage.setItem(transactionQueueStorageKey, JSON.stringify(next));
        return next;
      });
      setSheetOpen(false);
      return;
    }
    setSheetOpen(false);
    setReceiptEntry(null);
    addConfirmedTransaction(created.id, payload, mode, account, category);
    void refresh();
    if (submittedReceipt) void refreshReceipts().catch(() => undefined);
  };
  const addConfirmedTransaction = (
    id: string,
    payload: TransactionPayload,
    mode: EntryMode,
    account?: string,
    category?: string,
  ) =>
    setTransactions((current) => {
      const next = [
        {
          id,
          date: payload.date,
          amount: payload.amount,
          account: account ?? 'Unknown account',
          category: category ?? 'Uncategorized',
          payee: '—',
          notes: payload.notes,
          isSplit: mode === 'split',
        },
        ...current.filter((transaction) => transaction.id !== id),
      ];
      persistTransactionCache(next);
      return next;
    });
  const retryQueuedTransaction = async (item: QueuedTransaction) => {
    setRetryingTransaction(item.id);
    try {
      const created = await submitTransaction(item.payload);
      setQueuedTransactions((current) => {
        const next = current.filter(({ id }) => id !== item.id);
        void AsyncStorage.setItem(transactionQueueStorageKey, JSON.stringify(next));
        return next;
      });
      addConfirmedTransaction(created.id, item.payload, item.mode, item.account, item.category);
      void refresh();
    } catch (cause) {
      const diagnostic = describeSubmissionError(cause);
      setQueuedTransactions((current) => {
        const next = current.map((queued) =>
          queued.id === item.id
            ? {
                ...queued,
                error: diagnostic,
              }
            : queued,
        );
        void AsyncStorage.setItem(transactionQueueStorageKey, JSON.stringify(next));
        return next;
      });
    } finally {
      setRetryingTransaction(null);
    }
  };
  const discardQueuedTransaction = (item: QueuedTransaction) => {
    setQueuedTransactions((current) => {
      const next = current.filter(({ id }) => id !== item.id);
      void AsyncStorage.setItem(transactionQueueStorageKey, JSON.stringify(next));
      return next;
    });
  };
  const removeTransaction = (item: ApiTransaction) => {
    setTransactions((current) => {
      const next = current.filter(({ id }) => id !== item.id);
      persistTransactionCache(next);
      return next;
    });
    setTransactionTotal((current) => Math.max(0, current - 1));
    void deleteTransaction(item.id).catch((cause) => {
      setError(cause instanceof Error ? cause.message : 'Could not delete transaction.');
      void refresh();
    });
  };
  const removeReceipt = (receipt: ApiReceipt) => {
    setReceipts((current) => current.filter(({ id }) => id !== receipt.id));
    void deleteReceipt(receipt.id).catch(() => void refreshReceipts().catch(() => undefined));
  };
  return (
    <SafeAreaProvider>
      <SwipeProvider>
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
          <StatusBar style="dark" />
          <View style={styles.appShell}>
            <View style={styles.tabContent}>
              {activeTab === 'transactions' ? (
                <>
                  {loading && !transactions.length ? (
                    <View style={styles.state}>
                      <ActivityIndicator size="large" color={colors.accent} />
                      <Text style={styles.stateText}>Loading your budget…</Text>
                    </View>
                  ) : error && !transactions.length && !queuedTransactions.length ? (
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
                      removeClippedSubviews={false}
                      keyExtractor={(item) => item.id}
                      renderItem={({ item, index }) => (
                        <View>
                          {index === 0 || transactions[index - 1]?.date !== item.date ? (
                            <Text style={styles.dateSectionHeader}>
                              {formatDateHeader(item.date)}
                            </Text>
                          ) : null}
                          <TransactionRow
                            item={item}
                            categories={references.categories}
                            onDelete={removeTransaction}
                          />
                        </View>
                      )}
                      ListHeaderComponent={
                        <>
                          <SummaryCard transactions={transactions} />
                          {error ? (
                            <Pressable onPress={() => void refresh()} style={styles.inlineError}>
                              <Text style={styles.inlineErrorText}>{error} Tap to retry.</Text>
                            </Pressable>
                          ) : null}
                          <TransactionQueue
                            items={queuedTransactions}
                            retrying={retryingTransaction}
                            onRetry={(item) => void retryQueuedTransaction(item)}
                            onDiscard={discardQueuedTransaction}
                          />
                          <View style={styles.listHeading}>
                            <Text style={styles.sectionTitle}>Recent transactions</Text>
                            <Text style={styles.filterText}>{transactions.length} loaded</Text>
                          </View>
                        </>
                      }
                      ListEmptyComponent={
                        <Text style={styles.emptyText}>No transactions yet.</Text>
                      }
                      ListFooterComponent={
                        loadingMore ? (
                          <ActivityIndicator
                            testID="loading-more-transactions"
                            color={colors.accent}
                            style={styles.loadingMore}
                          />
                        ) : null
                      }
                      contentContainerStyle={styles.content}
                      showsVerticalScrollIndicator={false}
                      onEndReached={() => void loadMoreTransactions()}
                      onEndReachedThreshold={0.35}
                      onScroll={({ nativeEvent }) => {
                        const distanceFromEnd =
                          nativeEvent.contentSize.height -
                          nativeEvent.layoutMeasurement.height -
                          nativeEvent.contentOffset.y;
                        if (distanceFromEnd < 240) void loadMoreTransactions();
                      }}
                      scrollEventThrottle={200}
                      refreshControl={
                        <RefreshControl
                          refreshing={loading}
                          onRefresh={() => void refresh()}
                          tintColor={colors.accent}
                          colors={[colors.accent]}
                          progressBackgroundColor={colors.white}
                        />
                      }
                      ItemSeparatorComponent={() => <View style={styles.separator} />}
                    />
                  )}
                  {!loading || transactions.length > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Add transaction"
                      onPress={() => {
                        setReceiptEntry(null);
                        setSheetOpen(true);
                      }}
                      style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
                    >
                      <Ionicons name="add" size={32} color={colors.white} />
                    </Pressable>
                  ) : null}
                </>
              ) : activeTab === 'wallets' ? (
                <WalletsScreen accounts={references.accounts} categories={references.categories} />
              ) : activeTab === 'receipts' ? (
                <ReceiptsScreen
                  receipts={receipts}
                  loading={receiptsLoading}
                  refresh={refreshReceipts}
                  accounts={references.accounts}
                  categories={references.categories}
                  tags={references.tags}
                  defaultAccount={defaultAccount}
                  onAdd={(receipt, draft, mode) => {
                    setReceiptEntry({ id: receipt.id, draft, mode });
                    setSheetOpen(true);
                  }}
                  onDelete={removeReceipt}
                />
              ) : (
                <ScrollView
                  style={styles.secondaryScreen}
                  contentContainerStyle={styles.settingsContent}
                >
                  <Text style={styles.secondaryEyebrow}>PREFERENCES</Text>
                  <Text style={styles.secondaryTitle}>Settings</Text>
                  <Text style={styles.settingsIntro}>
                    Personalize how new transactions are prepared on this device.
                  </Text>
                  <View style={styles.settingsSection}>
                    <AccountDropdown
                      value={defaultAccount}
                      options={references.accounts}
                      onChange={chooseDefaultAccount}
                    />
                  </View>
                </ScrollView>
              )}
            </View>
            <BottomNavigation
              active={activeTab}
              receiptCount={receiptCount}
              onChange={setActiveTab}
            />
          </View>
          <EntrySheet
            visible={sheetOpen}
            references={references}
            defaultAccount={defaultAccount}
            initialDraft={receiptEntry?.draft}
            initialMode={receiptEntry?.mode}
            onClose={() => {
              setSheetOpen(false);
              setReceiptEntry(null);
            }}
            onSave={addTransaction}
          />
        </SafeAreaView>
      </SwipeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  swipeProvider: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  appShell: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },
  tabContent: { flex: 1 },
  content: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 120 },
  swipeContainer: {
    overflow: 'hidden',
    backgroundColor: '#D84A4A',
    borderRadius: 17,
  },
  borderedSwipeContainer: { borderWidth: 1, borderColor: colors.line },
  openSwipeContainer: { zIndex: 2 },
  swipeForeground: { backgroundColor: colors.canvas },
  borderedSwipeForeground: { backgroundColor: colors.surface },
  swipeDeleteButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 82,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  swipeRevealSpacer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: colors.canvas,
  },
  swipeDeleteText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  deleteConfirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(38, 31, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  deleteConfirmCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    backgroundColor: colors.surface,
    padding: 24,
    alignItems: 'center',
  },
  deleteConfirmIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FBE8E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  deleteConfirmTitle: { color: colors.ink, fontSize: 19, fontWeight: '800', textAlign: 'center' },
  deleteConfirmText: { color: colors.muted, fontSize: 13, marginTop: 8 },
  deleteConfirmActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  deleteCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteCancelText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  deleteConfirmButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#D84A4A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteConfirmButtonText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  loadingMore: { marginVertical: 22 },
  summaryCard: {
    backgroundColor: colors.ink,
    borderRadius: 25,
    padding: 24,
    marginBottom: 30,
    shadowColor: '#3D2946',
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
  summaryDivider: { height: 1, backgroundColor: '#644D6D', marginVertical: 20 },
  summaryRow: { flexDirection: 'row', gap: 38 },
  summaryMetric: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  incomeDot: { backgroundColor: '#71C69E' },
  spentDot: { backgroundColor: '#C994E0' },
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
  queuePanel: {
    borderWidth: 1,
    borderColor: '#D8C4E1',
    borderRadius: 18,
    backgroundColor: '#F8F2FA',
    padding: 15,
    marginBottom: 24,
  },
  queueHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  queueHeadingCopy: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  queueStatusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  queueTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  queueCount: {
    minWidth: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: '#EADCF0',
    color: colors.accentDark,
    textAlign: 'center',
    lineHeight: 25,
    fontSize: 12,
    fontWeight: '800',
  },
  queueIntro: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 6 },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5D7EA',
    marginTop: 13,
    paddingTop: 13,
  },
  queueItemIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#EADCF0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  queueItemCopy: { flex: 1 },
  queueItemTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  queueItemMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  queueItemError: { color: colors.accentDark, fontSize: 10, lineHeight: 15, marginTop: 5 },
  queueItemAction: { alignItems: 'flex-end', marginLeft: 8 },
  queueItemAmount: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  retryQueueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 28,
    paddingHorizontal: 8,
    marginTop: 4,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  retryQueueText: { color: colors.accent, fontSize: 11, fontWeight: '800' },
  discardQueueButton: { minHeight: 24, justifyContent: 'center', marginTop: 2 },
  discardQueueText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
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
  expenseIcon: { backgroundColor: '#EFE5F3' },
  incomeIcon: { backgroundColor: '#DDF0E5' },
  transactionCopy: { flex: 1 },
  merchant: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  transactionMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  dateSectionHeader: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
    paddingTop: 20,
    paddingBottom: 10,
  },
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
  inlineError: { backgroundColor: '#F0E6F4', borderRadius: 12, padding: 12, marginBottom: 18 },
  inlineErrorText: { color: colors.accentDark, fontSize: 12 },
  emptyText: { color: colors.muted, textAlign: 'center', padding: 40 },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.surface,
  },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: '16%',
    backgroundColor: colors.overlay,
  },
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
  sheetTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sheetTitleIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#F0E6F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: { color: colors.ink, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  sheetHeadingActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  closeButton: {
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeToggle: {
    backgroundColor: colors.canvas,
    borderRadius: 12,
    padding: 3,
    flexDirection: 'row',
    gap: 2,
  },
  modeButton: {
    width: 38,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  activeModeButton: { backgroundColor: colors.accent },
  form: { paddingBottom: 12 },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldControl: { width: '100%' },
  choiceControl: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 9 },
  choiceScroller: { flex: 1 },
  choiceRow: { gap: 9, paddingRight: 10 },
  choice: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 15,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: 20,
  },
  activeChoice: { borderColor: colors.accent, backgroundColor: '#F0E6F4' },
  choiceText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  activeChoiceText: { color: colors.accentDark },
  tagSearchButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagSearchSheet: {
    height: '68%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
  },
  tagSearchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  tagSearchField: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.canvas,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tagSearchList: { gap: 10, paddingTop: 16, paddingBottom: 24 },
  tagSearchOption: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activeTagSearchOption: { borderColor: colors.accent, backgroundColor: '#FAF5FC' },
  tagCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTagCheckbox: { borderColor: colors.accent, backgroundColor: colors.accent },
  tagSearchOptionText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  categoryField: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.white,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryFieldPressed: { backgroundColor: '#FAF8FB' },
  categoryFieldSelection: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  categoryFieldIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2EEF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryFieldText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  categoryPlaceholder: { color: '#A7A0AA', fontSize: 14 },
  nestedModalRoot: { flex: 1, justifyContent: 'flex-end' },
  nestedScrim: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(42, 29, 48, 0.58)',
  },
  categorySheet: {
    height: '66%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 18,
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
    shadowColor: '#2A1D30',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 18,
  },
  categorySheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 18,
  },
  categorySheetTitle: { color: colors.ink, fontSize: 22, fontWeight: '800' },
  categorySheetSubtitle: { color: colors.muted, fontSize: 12, marginTop: 4 },
  categoryGrid: { paddingBottom: 22 },
  categoryGridRow: { alignItems: 'flex-start' },
  categoryTile: { width: '33.333%', alignItems: 'center', paddingHorizontal: 5, marginBottom: 20 },
  categoryTileIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#F3F5F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeCategoryTileIcon: { borderColor: colors.accent, backgroundColor: '#F0E6F4' },
  categoryCheckBadge: {
    position: 'absolute',
    right: -2,
    top: -2,
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTileText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 8,
  },
  activeCategoryTileText: { color: colors.accentDark, fontWeight: '700' },
  categoryEmpty: { color: colors.muted, textAlign: 'center', paddingVertical: 40 },
  accountSheet: {
    maxHeight: '62%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 28 : 18,
  },
  accountOptions: { gap: 11, paddingTop: 20, paddingBottom: 10 },
  accountOption: {
    minHeight: 62,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  activeAccountOption: { borderColor: colors.accent, backgroundColor: '#F0E6F4' },
  accountOptionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2EEF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountOptionText: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '600' },
  activeAccountOptionText: { color: colors.accentDark, fontWeight: '700' },
  field: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    gap: 11,
  },
  multilineField: { height: 80, alignItems: 'flex-start', paddingTop: 15 },
  input: { flex: 1, color: colors.ink, fontSize: 15, outlineStyle: 'none' } as never,
  multilineInput: { minHeight: 50, textAlignVertical: 'top' },
  dateShortcuts: { width: '100%' },
  dateCalendarButton: {
    minHeight: 48,
    width: '100%',
    minWidth: 0,
    paddingHorizontal: 13,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 9,
  },
  dateCalendarText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  webDateInput: { justifyContent: 'flex-start' },
  webDateTextInput: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
    outlineStyle: 'none',
  } as never,
  datePickerSheet: {
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
  },
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dateDoneButton: {
    minHeight: 38,
    paddingHorizontal: 15,
    borderRadius: 12,
    backgroundColor: '#F0E6F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDoneText: { color: colors.accentDark, fontSize: 13, fontWeight: '800' },
  datePicker: { width: '100%' },
  splitCard: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 15,
    marginBottom: 16,
    backgroundColor: '#FAF8FB',
  },
  splitTitle: { color: colors.ink, fontWeight: '700', marginBottom: 14 },
  errorText: {
    color: colors.accentDark,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
    backgroundColor: '#F8EFFA',
    borderRadius: 10,
    padding: 10,
  },
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
  bottomNavigation: {
    minHeight: 76,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  bottomTab: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', gap: 3 },
  bottomTabIcon: {
    width: 42,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBottomTabIcon: { backgroundColor: '#F0E6F4' },
  receiptBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  receiptBadgeText: { color: colors.white, fontSize: 9, fontWeight: '800' },
  bottomTabText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  activeBottomTabText: { color: colors.accentDark, fontWeight: '800' },
  secondaryScreen: { flex: 1, paddingHorizontal: 22, paddingTop: 34 },
  receiptsScreen: { flex: 1, paddingHorizontal: 22, paddingTop: 34 },
  receiptsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  receiptFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accentDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 7,
  },
  receiptsContent: { paddingBottom: 34, gap: 12 },
  receiptCard: {
    minHeight: 78,
    borderRadius: 17,
    borderWidth: 0,
    backgroundColor: colors.surface,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  receiptCardIcon: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: '#F0E6F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptCardCopy: { flex: 1 },
  receiptCardTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  receiptCardMeta: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  receiptActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewReceiptButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F0E6F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addReceiptButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptPreviewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(38, 31, 42, 0.72)',
    padding: 18,
    justifyContent: 'center',
  },
  receiptPreviewCard: {
    height: '82%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  receiptPreviewHeader: {
    minHeight: 64,
    paddingLeft: 20,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  receiptPreviewTitle: { flex: 1, color: colors.ink, fontSize: 17, fontWeight: '800' },
  receiptPreviewClose: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptPreviewImage: { flex: 1, width: '100%', backgroundColor: '#18151A' },
  receiptPreviewStatus: {
    position: 'absolute',
    top: 64,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#18151A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  receiptPreviewErrorText: { color: colors.white, fontSize: 14, fontWeight: '700' },
  receiptPreviewUnavailable: {
    flex: 1,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  walletContent: { paddingHorizontal: 22, paddingTop: 34, paddingBottom: 40 },
  walletListHeading: {
    marginTop: 32,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  secondaryEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  secondaryTitle: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.7,
    marginTop: 6,
  },
  emptyScreenCard: {
    marginTop: 34,
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 28,
    paddingVertical: 46,
    alignItems: 'center',
  },
  emptyScreenIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F0E6F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyScreenTitle: { color: colors.ink, fontSize: 19, fontWeight: '800', marginTop: 18 },
  emptyScreenText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 7,
    maxWidth: 290,
  },
  settingsContent: { paddingBottom: 32 },
  settingsIntro: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 10 },
  settingsSection: { marginTop: 28 },
  settingsLabel: { color: colors.ink, fontSize: 13, fontWeight: '800', marginBottom: 9 },
  settingsSelect: {
    minHeight: 66,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 15,
    backgroundColor: colors.surface,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsSelectCopy: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  settingsSelectIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#F0E6F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsSelectValue: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  settingsSelectHint: { color: colors.muted, fontSize: 11, marginTop: 3 },
});
