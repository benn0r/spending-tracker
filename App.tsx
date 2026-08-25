import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, View } from 'react-native';
import { type ApiConfiguration, updateTransaction, uploadReceipt } from './src/api';
import type { ConfirmedTransactionInput } from './src/app-model';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { SwipeProvider } from './src/components/SwipeToDelete';
import { ReceiptsScreen } from './src/features/receipts/ReceiptsScreen';
import { SettingsScreen } from './src/features/settings/SettingsScreen';
import { ServerSetupScreen } from './src/features/setup/ServerSetupScreen';
import { ServerSetupDrawer } from './src/features/setup/ServerSetupDrawer';
import { EntrySheet } from './src/features/transactions/EntrySheet';
import { TransactionsScreen } from './src/features/transactions/TransactionsScreen';
import { prepareTransactionEdit } from './src/features/transactions/prepareTransactionEdit';
import { WalletsScreen } from './src/features/wallets/WalletsScreen';
import { SharedExpensesScreen } from './src/features/splits/SharedExpensesScreen';
import { MoreNavigator, type MorePage } from './src/features/more/MoreNavigator';
import { useDashboardTransactions } from './src/hooks/useDashboardTransactions';
import { useDefaultAccount } from './src/hooks/useDefaultAccount';
import { useExpenseSplits } from './src/hooks/useExpenseSplits';
import { useReceipts } from './src/hooks/useReceipts';
import { useServerConfig } from './src/hooks/useServerConfig';
import { useTransactionQueue } from './src/hooks/useTransactionQueue';
import { AppScreenProvider } from './src/navigation/AppScreenContext';
import { AppTabs } from './src/navigation/AppTabs';
import { styles } from './src/styles';
import { createPayload } from './src/transactions';
import type {
  ApiTransaction,
  DraftTransaction,
  EntryMode,
  ExpenseSplitSelection,
  TransactionDirection,
} from './src/types';

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
  const insets = useSafeAreaInsets();
  const [morePage, setMorePage] = useState<MorePage | null>(null);
  const [morePageLeaving, setMorePageLeaving] = useState(false);
  const finishClosingMorePage = useCallback(() => {
    setMorePage(null);
    setMorePageLeaving(false);
  }, []);
  const [setupOpen, setSetupOpen] = useState(false);
  const [transactionsActivationRequest, setTransactionsActivationRequest] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<ApiTransaction | null>(null);
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
    addTag,
    addConfirmedTransaction,
    removeTransaction,
  } = useDashboardTransactions(validateDefaultAccount);
  const { receipts, receiptsLoading, receiptCount, refreshReceipts, removeReceipt } = useReceipts();
  const { expenseSplits, refreshExpenseSplits } = useExpenseSplits();
  const confirmQueuedTransaction = useCallback(
    ({ id, payload, mode, account, category, receiptId }: ConfirmedTransactionInput) => {
      addConfirmedTransaction(id, payload, mode, account, category);
      if (payload.expenseSplit) void refreshExpenseSplits().catch(() => undefined);
      if (receiptId) void refreshReceipts().catch(() => undefined);
    },
    [addConfirmedTransaction, refreshExpenseSplits, refreshReceipts],
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
    direction: TransactionDirection = 'expense',
  ) => {
    const createdPayload = createPayload(draft, mode);
    const signedPayload =
      direction === 'income'
        ? {
            ...createdPayload,
            amount: Math.abs(createdPayload.amount),
            ...(createdPayload.splits
              ? {
                  splits: createdPayload.splits.map((split) => ({
                    ...split,
                    amount: Math.abs(split.amount),
                  })),
                }
              : {}),
          }
        : createdPayload;
    const payload = { ...signedPayload, ...(expenseSplit ? { expenseSplit } : {}) };
    if (editingTransaction) {
      await updateTransaction(editingTransaction.id, payload);
      setEditingTransaction(null);
      setSheetOpen(false);
      await Promise.all([refresh(), refreshExpenseSplits()]);
      return;
    }
    const account = references.accounts.find(({ id }) => id === payload.account)?.name;
    const category =
      mode === 'split'
        ? 'Split transaction'
        : references.categories.find(({ id }) => id === payload.category)?.name;
    const queued = await enqueueTransaction({
      payload,
      mode,
      account: account ?? 'Unknown account',
      category: category ?? 'Uncategorized',
      error: 'Saved on this device. Waiting to sync.',
      ...(receiptEntry ? { receiptId: receiptEntry.id } : {}),
    });
    setSheetOpen(false);
    setReceiptEntry(null);
    void retryQueuedTransaction(queued).catch(() => undefined);
  };
  const preparedEditing = editingTransaction
    ? prepareTransactionEdit(editingTransaction, references)
    : null;
  const screens = {
    transactions: (
      <TransactionsScreen
        topInset={insets.top}
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
        onEdit={(transaction) => {
          setReceiptEntry(null);
          setEditingTransaction(transaction);
          setSheetOpen(true);
        }}
        onRetryQueued={(item) => void retryQueuedTransaction(item)}
        onDiscardQueued={discardQueuedTransaction}
        onScanReceipt={async () => {
          const account = defaultAccount || references.accounts[0]?.id;
          if (!account) throw new Error('Enable an account before scanning a receipt.');
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) throw new Error('Camera access is required to scan a receipt.');
          const capture = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.85,
            allowsEditing: false,
          });
          if (capture.canceled || !capture.assets[0]) return;
          await uploadReceipt(capture.assets[0], account);
          await refreshReceipts();
        }}
        onAdd={() => {
          setReceiptEntry(null);
          setEditingTransaction(null);
          setSheetOpen(true);
        }}
      />
    ),
    accounts: (
      <SafeAreaView edges={['top']} style={styles.tabContent}>
        <WalletsScreen
          accounts={references.accounts}
          categories={references.categories}
          defaultAccount={defaultAccount}
        />
      </SafeAreaView>
    ),
    more: (
      <SafeAreaView edges={['top']} style={styles.tabContent}>
        <MoreNavigator
          key={morePage ?? 'menu'}
          selected={morePage}
          receiptCount={receiptCount}
          onSelect={setMorePage}
          leaving={morePageLeaving}
          onExitComplete={finishClosingMorePage}
        >
          {morePage === 'shared' ? (
            <SharedExpensesScreen
              splits={expenseSplits}
              loading={false}
              onRefresh={refreshExpenseSplits}
              onBack={() => setMorePageLeaving(true)}
            />
          ) : morePage === 'receipts' ? (
            <ReceiptsScreen
              receipts={receipts}
              loading={receiptsLoading}
              refresh={refreshReceipts}
              accounts={references.accounts}
              categories={references.categories}
              tags={references.tags}
              defaultAccount={defaultAccount}
              onAdd={(receipt, draft, mode) => {
                setEditingTransaction(null);
                setReceiptEntry({ id: receipt.id, draft, mode });
                setSheetOpen(true);
              }}
              onDelete={removeReceipt}
              onBack={() => setMorePageLeaving(true)}
            />
          ) : null}
        </MoreNavigator>
      </SafeAreaView>
    ),
    settings: (
      <SafeAreaView edges={['top']} style={styles.tabContent}>
        <SettingsScreen
          defaultAccount={defaultAccount}
          accounts={references.accounts}
          onChangeDefaultAccount={chooseDefaultAccount}
          serverUrl={configuration.serverUrl}
          onEditConnection={() => setSetupOpen(true)}
        />
      </SafeAreaView>
    ),
  };

  return (
    <SafeAreaProvider>
      <SwipeProvider>
        <SafeAreaView edges={['left', 'right']} style={[styles.safeArea, styles.homeSafeArea]}>
          <StatusBar style="dark" />
          <View style={styles.appShell}>
            <View pointerEvents="none" style={styles.ambientBackdrop}>
              <View style={styles.ambientGlowTop} />
              <View style={styles.ambientGlowBottom} />
            </View>
            <AppScreenProvider value={screens}>
              <AppTabs
                receiptCount={receiptCount}
                onTransactionsActivated={() =>
                  setTransactionsActivationRequest((current) => current + 1)
                }
              />
            </AppScreenProvider>
          </View>
          <EntrySheet
            visible={sheetOpen}
            references={references}
            onCreateTag={addTag}
            expenseSplits={expenseSplits}
            defaultAccount={defaultAccount}
            initialDraft={receiptEntry?.draft ?? preparedEditing?.draft}
            initialMode={receiptEntry?.mode ?? preparedEditing?.mode}
            initialExpenseSplitId={editingTransaction?.expenseSplitId}
            initialDirection={
              editingTransaction && editingTransaction.amount > 0 ? 'income' : 'expense'
            }
            onClose={() => {
              setSheetOpen(false);
              setReceiptEntry(null);
              setEditingTransaction(null);
            }}
            onSave={addTransaction}
          />
          <ServerSetupDrawer
            visible={setupOpen}
            configuration={configuration}
            onClose={() => setSetupOpen(false)}
            onSave={(next) => {
              onChangeConfiguration(next);
              void refresh();
              void refreshReceipts().catch(() => undefined);
            }}
          />
        </SafeAreaView>
      </SwipeProvider>
    </SafeAreaProvider>
  );
}
