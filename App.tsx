import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { type ApiConfiguration, submitReceiptTransaction } from './src/api';
import type { ConfirmedTransactionInput } from './src/app-model';
import { BottomNavigation, type AppTab } from './src/components/BottomNavigation';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { SwipeProvider } from './src/components/SwipeToDelete';
import { ReceiptsScreen } from './src/features/receipts/ReceiptsScreen';
import { SettingsScreen } from './src/features/settings/SettingsScreen';
import { ServerSetupScreen } from './src/features/setup/ServerSetupScreen';
import { EntrySheet } from './src/features/transactions/EntrySheet';
import { TransactionsScreen } from './src/features/transactions/TransactionsScreen';
import { WalletsScreen } from './src/features/wallets/WalletsScreen';
import { useDashboardTransactions } from './src/hooks/useDashboardTransactions';
import { useDefaultAccount } from './src/hooks/useDefaultAccount';
import { useExpenseSplits } from './src/hooks/useExpenseSplits';
import { useReceipts } from './src/hooks/useReceipts';
import { useServerConfig } from './src/hooks/useServerConfig';
import { useTransactionQueue } from './src/hooks/useTransactionQueue';
import { styles } from './src/styles';
import { createPayload } from './src/transactions';
import type { DraftTransaction, EntryMode, ExpenseSplitSelection } from './src/types';

export default function App() {
  const { configuration, hydrated, saveConfiguration } = useServerConfig();
  const [recoveryKey, setRecoveryKey] = useState(0);

  if (!hydrated) {
    return (
      <SafeAreaProvider>
        <View style={styles.setupLoading}>
          <ActivityIndicator color="#77409A" />
        </View>
      </SafeAreaProvider>
    );
  }

  if (!configuration) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea}>
          <ServerSetupScreen onSave={saveConfiguration} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const retryConfiguration = (next: ApiConfiguration) => {
    saveConfiguration(next);
    setRecoveryKey((current) => current + 1);
  };

  return (
    <AppErrorBoundary
      key={`${configuration.serverUrl}-${recoveryKey}`}
      fallback={
        <SafeAreaProvider>
          <SafeAreaView style={styles.safeArea}>
            <ServerSetupScreen
              initialValue={configuration}
              recoveryMessage="The app could not start with this connection. Check the server URL and API token, then try again."
              onSave={retryConfiguration}
            />
          </SafeAreaView>
        </SafeAreaProvider>
      }
    >
      <ConfiguredApp configuration={configuration} onChangeConfiguration={saveConfiguration} />
    </AppErrorBoundary>
  );
}

function ConfiguredApp({
  configuration,
  onChangeConfiguration,
}: {
  configuration: ApiConfiguration;
  onChangeConfiguration: (configuration: ApiConfiguration) => void;
}) {
  const [activeTab, setActiveTab] = useState<AppTab>('transactions');
  const [setupOpen, setSetupOpen] = useState(false);
  const [transactionsActivationRequest, setTransactionsActivationRequest] = useState(0);
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
    cashFlow,
    loading,
    loadingMore,
    error,
    refresh,
    refreshSilently,
    loadMoreTransactions,
    addConfirmedTransaction,
    removeTransaction,
  } = useDashboardTransactions(validateDefaultAccount);
  const { receipts, receiptsLoading, receiptCount, refreshReceipts, removeReceipt } = useReceipts();
  const { expenseSplits, refreshExpenseSplits } = useExpenseSplits();
  const confirmQueuedTransaction = useCallback(
    ({ id, payload, mode, account, category }: ConfirmedTransactionInput) => {
      addConfirmedTransaction(id, payload, mode, account, category);
      if (payload.expenseSplit) void refreshExpenseSplits().catch(() => undefined);
    },
    [addConfirmedTransaction, refreshExpenseSplits],
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
  const addTransaction = async (
    draft: DraftTransaction,
    mode: EntryMode,
    expenseSplit?: ExpenseSplitSelection,
  ) => {
    const submittedReceipt = receiptEntry;
    const payload = { ...createPayload(draft, mode), ...(expenseSplit ? { expenseSplit } : {}) };
    const account = references.accounts.find(({ id }) => id === payload.account)?.name;
    const category =
      mode === 'split'
        ? 'Split transaction'
        : references.categories.find(({ id }) => id === payload.category)?.name;
    if (!receiptEntry) {
      const queued = await enqueueTransaction({
        payload,
        mode,
        account: account ?? 'Unknown account',
        category: category ?? 'Uncategorized',
        error: 'Saved on this device. Waiting to sync.',
      });
      await retryQueuedTransaction(queued, true);
      setSheetOpen(false);
      return;
    }
    const created = await submitReceiptTransaction(receiptEntry.id, payload);
    setSheetOpen(false);
    setReceiptEntry(null);
    addConfirmedTransaction(created.id, payload, mode, account, category);
    void refresh();
    if (submittedReceipt) void refreshReceipts().catch(() => undefined);
  };
  return (
    <SafeAreaProvider>
      <SwipeProvider>
        <SafeAreaView
          edges={['top', 'left', 'right']}
          style={[styles.safeArea, styles.homeSafeArea]}
        >
          <StatusBar style="dark" />
          <View style={styles.appShell}>
            <View style={styles.tabContent}>
              {activeTab === 'transactions' ? (
                <TransactionsScreen
                  transactions={transactions}
                  cashFlow={cashFlow}
                  categories={references.categories}
                  queuedTransactions={queuedTransactions}
                  retryingTransaction={retryingTransaction}
                  loading={loading}
                  loadingMore={loadingMore}
                  error={error}
                  activationRequest={transactionsActivationRequest}
                  onRefresh={refresh}
                  onActivationRefresh={refreshSilently}
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
                  serverUrl={configuration.serverUrl}
                  onEditConnection={() => setSetupOpen(true)}
                />
              )}
            </View>
            <BottomNavigation
              active={activeTab}
              receiptCount={receiptCount}
              onChange={(tab) => {
                setActiveTab(tab);
                if (tab === 'transactions') {
                  setTransactionsActivationRequest((current) => current + 1);
                }
              }}
            />
          </View>
          <EntrySheet
            visible={sheetOpen}
            references={references}
            expenseSplits={expenseSplits}
            defaultAccount={defaultAccount}
            initialDraft={receiptEntry?.draft}
            initialMode={receiptEntry?.mode}
            onClose={() => {
              setSheetOpen(false);
              setReceiptEntry(null);
            }}
            onSave={addTransaction}
          />
          <Modal
            animationType="slide"
            transparent
            visible={setupOpen}
            onRequestClose={() => setSetupOpen(false)}
          >
            <View style={styles.setupModalRoot}>
              <Pressable
                accessibilityLabel="Close server connection settings"
                style={styles.receiptDetailsScrim}
                onPress={() => setSetupOpen(false)}
              />
              <ServerSetupScreen
                sheet
                initialValue={configuration}
                onCancel={() => setSetupOpen(false)}
                onSave={(next) => {
                  onChangeConfiguration(next);
                  setSetupOpen(false);
                  void refresh();
                  void refreshReceipts().catch(() => undefined);
                }}
              />
            </View>
          </Modal>
        </SafeAreaView>
      </SwipeProvider>
    </SafeAreaProvider>
  );
}
