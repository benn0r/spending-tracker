import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { View } from 'react-native';
import {
  ApiError,
  describeSubmissionError,
  submitReceiptTransaction,
  submitTransaction,
} from './src/api';
import type { ConfirmedTransactionInput } from './src/app-model';
import { BottomNavigation, type AppTab } from './src/components/BottomNavigation';
import { SwipeProvider } from './src/components/SwipeToDelete';
import { ReceiptsScreen } from './src/features/receipts/ReceiptsScreen';
import { SettingsScreen } from './src/features/settings/SettingsScreen';
import { EntrySheet } from './src/features/transactions/EntrySheet';
import { TransactionsScreen } from './src/features/transactions/TransactionsScreen';
import { WalletsScreen } from './src/features/wallets/WalletsScreen';
import { useDashboardTransactions } from './src/hooks/useDashboardTransactions';
import { useDefaultAccount } from './src/hooks/useDefaultAccount';
import { useReceipts } from './src/hooks/useReceipts';
import { useTransactionQueue } from './src/hooks/useTransactionQueue';
import { styles } from './src/styles';
import { createPayload } from './src/transactions';
import type { DraftTransaction, EntryMode } from './src/types';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('transactions');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [receiptEntry, setReceiptEntry] = useState<{
    id: number;
    draft: DraftTransaction;
    mode: EntryMode;
  } | null>(null);

  const { defaultAccount, chooseDefaultAccount, validateDefaultAccount } = useDefaultAccount();
  const {
    transactions,
    references,
    loading,
    loadingMore,
    error,
    refresh,
    loadMoreTransactions,
    addConfirmedTransaction,
    removeTransaction,
  } = useDashboardTransactions(validateDefaultAccount);
  const { receipts, receiptsLoading, receiptCount, refreshReceipts, removeReceipt } = useReceipts();
  const confirmQueuedTransaction = useCallback(
    ({ id, payload, mode, account, category }: ConfirmedTransactionInput) =>
      addConfirmedTransaction(id, payload, mode, account, category),
    [addConfirmedTransaction],
  );
  const {
    items: queuedTransactions,
    retryingId: retryingTransaction,
    enqueue: enqueueTransaction,
    retry: retryQueuedTransaction,
    discard: discardQueuedTransaction,
  } = useTransactionQueue({
    onConfirmed: confirmQueuedTransaction,
    onRefresh: refresh,
  });
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
      enqueueTransaction({
        payload,
        mode,
        account: account ?? 'Unknown account',
        category: category ?? 'Uncategorized',
        error: diagnostic,
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
  return (
    <SafeAreaProvider>
      <SwipeProvider>
        <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
          <StatusBar style="dark" />
          <View style={styles.appShell}>
            <View style={styles.tabContent}>
              {activeTab === 'transactions' ? (
                <TransactionsScreen
                  transactions={transactions}
                  categories={references.categories}
                  queuedTransactions={queuedTransactions}
                  retryingTransaction={retryingTransaction}
                  loading={loading}
                  loadingMore={loadingMore}
                  error={error}
                  onRefresh={refresh}
                  onLoadMore={loadMoreTransactions}
                  onDelete={removeTransaction}
                  onRetryQueued={(item) => void retryQueuedTransaction(item)}
                  onDiscardQueued={discardQueuedTransaction}
                  onAdd={() => {
                    setReceiptEntry(null);
                    setSheetOpen(true);
                  }}
                />
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
                <SettingsScreen
                  defaultAccount={defaultAccount}
                  accounts={references.accounts}
                  onChangeDefaultAccount={chooseDefaultAccount}
                />
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
