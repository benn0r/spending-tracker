import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, RefreshControl } from 'react-native';

import * as api from '../../src/api';
import { ReceiptsScreen } from '../../src/features/receipts/ReceiptsScreen';
import type { ApiReceipt } from '../../src/types';

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('../../src/components/SwipeToDelete', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SwipeToDelete: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('../../src/api', () => ({
  receiptFileSource: jest.fn((id: number) => ({ uri: `https://example.test/receipts/${id}` })),
  uploadReceipt: jest.fn(),
}));

const accounts = [
  { id: 'everyday', name: 'Everyday' },
  { id: 'savings', name: 'Savings' },
];
const categories = [
  { id: 'groceries', name: 'Groceries' },
  { id: 'home', name: 'Home' },
];
const tags = [{ id: 'weekly', name: 'Weekly' }];
const refresh = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);

function receipt(overrides: Partial<ApiReceipt> = {}): ApiReceipt {
  return {
    id: 7,
    filename: 'market.jpg',
    account: 'savings',
    mimeType: 'image/jpeg',
    status: 'processed',
    suggestion: {
      merchant: 'Moon Market',
      date: '2026-08-10',
      amount: 12.5,
      currency: 'CHF',
      category: 'groceries',
      notes: 'Fantasy groceries',
      tags: ['weekly'],
      items: [],
      splits: [],
      confidence: 0.9,
    },
    error: null,
    submitted: false,
    actualId: null,
    createdAt: '2026-08-10',
    processedAt: '2026-08-10',
    submittedAt: null,
    ...overrides,
  };
}

function renderReceipts(overrides: Partial<React.ComponentProps<typeof ReceiptsScreen>> = {}) {
  return render(
    <ReceiptsScreen
      receipts={[]}
      loading={false}
      refresh={refresh}
      accounts={accounts}
      categories={categories}
      tags={tags}
      defaultAccount="savings"
      onAdd={jest.fn()}
      onDelete={jest.fn()}
      {...overrides}
    />,
  );
}

describe('ReceiptsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    refresh.mockResolvedValue(undefined);
  });

  it('shows a useful error instead of opening the camera without an account', async () => {
    renderReceipts({ accounts: [], defaultAccount: '' });
    fireEvent.press(screen.getByRole('button', { name: 'Scan receipt' }));
    expect(await screen.findByText('Enable an account before scanning a receipt.')).toBeVisible();
    expect(ImagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
  });

  it('explains denied camera permission and never launches capture', async () => {
    jest.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({
      granted: false,
    } as ImagePicker.PermissionResponse);
    renderReceipts();
    fireEvent.press(screen.getByRole('button', { name: 'Scan receipt' }));
    expect(await screen.findByText('Camera access is required to scan a receipt.')).toBeVisible();
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it('does nothing after the user cancels capture', async () => {
    jest
      .mocked(ImagePicker.requestCameraPermissionsAsync)
      .mockResolvedValue({ granted: true } as ImagePicker.PermissionResponse);
    jest.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({ canceled: true, assets: null });
    renderReceipts();
    fireEvent.press(screen.getByRole('button', { name: 'Scan receipt' }));
    await waitFor(() => expect(ImagePicker.launchCameraAsync).toHaveBeenCalledTimes(1));
    expect(api.uploadReceipt).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('uploads a captured image with the configured default account and refreshes', async () => {
    const asset = {
      uri: 'file:///fantasy-receipt.jpg',
      fileName: 'fantasy-receipt.jpg',
      mimeType: 'image/jpeg',
      width: 10,
      height: 10,
    };
    jest
      .mocked(ImagePicker.requestCameraPermissionsAsync)
      .mockResolvedValue({ granted: true } as ImagePicker.PermissionResponse);
    jest
      .mocked(ImagePicker.launchCameraAsync)
      .mockResolvedValue({ canceled: false, assets: [asset] });
    jest.mocked(api.uploadReceipt).mockResolvedValue({ id: 8, status: 'queued' });
    renderReceipts();
    fireEvent.press(screen.getByRole('button', { name: 'Scan receipt' }));
    await waitFor(() => expect(api.uploadReceipt).toHaveBeenCalledWith(asset, 'savings'));
    expect(ImagePicker.launchCameraAsync).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it('explains denied photo library permission and never opens the picker', async () => {
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: false,
    } as ImagePicker.PermissionResponse);
    renderReceipts();

    fireEvent.press(screen.getByRole('button', { name: 'Choose receipt photo' }));

    expect(
      await screen.findByText('Photo library access is required to choose a receipt.'),
    ).toBeVisible();
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('chooses and uploads one receipt image from the photo library', async () => {
    const asset = {
      uri: 'file:///library-receipt.jpg',
      fileName: 'library-receipt.jpg',
      mimeType: 'image/jpeg',
      width: 10,
      height: 10,
    };
    jest
      .mocked(ImagePicker.requestMediaLibraryPermissionsAsync)
      .mockResolvedValue({ granted: true } as ImagePicker.PermissionResponse);
    jest
      .mocked(ImagePicker.launchImageLibraryAsync)
      .mockResolvedValue({ canceled: false, assets: [asset] });
    jest.mocked(api.uploadReceipt).mockResolvedValue({ id: 9, status: 'queued' });
    renderReceipts();

    fireEvent.press(screen.getByRole('button', { name: 'Choose receipt photo' }));

    await waitFor(() => expect(api.uploadReceipt).toHaveBeenCalledWith(asset, 'savings'));
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
      selectionLimit: 1,
    });
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it('falls back to the first account and reports upload failures', async () => {
    jest
      .mocked(ImagePicker.requestCameraPermissionsAsync)
      .mockResolvedValue({ granted: true } as ImagePicker.PermissionResponse);
    const asset = {
      uri: 'file:///broken.jpg',
      fileName: 'broken.jpg',
      mimeType: 'image/jpeg',
      width: 10,
      height: 10,
    };
    jest
      .mocked(ImagePicker.launchCameraAsync)
      .mockResolvedValue({ canceled: false, assets: [asset] });
    jest.mocked(api.uploadReceipt).mockRejectedValue(new Error('Upload unavailable'));
    renderReceipts({ defaultAccount: '' });
    fireEvent.press(screen.getByRole('button', { name: 'Scan receipt' }));
    expect(await screen.findByText('Upload unavailable')).toBeVisible();
    expect(api.uploadReceipt).toHaveBeenCalledWith(asset, 'everyday');
  });

  it('shows receipt status variants and prepares processed receipts for editing', () => {
    const onAdd = jest.fn();
    renderReceipts({
      receipts: [
        receipt({ id: 1, status: 'queued', suggestion: null, filename: 'queued.jpg' }),
        receipt({ id: 2, status: 'failed', suggestion: null, error: 'Unreadable' }),
        receipt({ id: 3, submitted: true }),
        receipt({ id: 4 }),
      ],
      onAdd,
    });
    expect(screen.getByText('Processing receipt…')).toBeVisible();
    expect(screen.getByText('Unreadable')).toBeVisible();
    expect(screen.getByLabelText('Receipt added')).toBeVisible();
    fireEvent.press(screen.getAllByRole('button', { name: 'View details for Moon Market' })[1]);
    fireEvent.press(screen.getByRole('button', { name: 'Add Moon Market' }));
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ id: 4 }),
      expect.objectContaining({ account: 'savings', category: 'groceries', amount: '12.5' }),
      'transaction',
    );
  });

  it('refreshes on pull and shows grouped line items in a bottom drawer', async () => {
    renderReceipts({
      receipts: [
        receipt({
          suggestion: {
            ...receipt().suggestion!,
            amount: -12.5,
            items: [
              {
                description: 'Apples',
                quantity: 2,
                unitAmount: 2.5,
                totalAmount: 5,
                category: 'groceries',
              },
              {
                description: 'Soap',
                quantity: 1,
                unitAmount: 7.5,
                totalAmount: 7.5,
                category: 'home',
              },
            ],
          },
        }),
      ],
    });
    const refreshControl = screen.UNSAFE_getByType(RefreshControl);
    refreshControl.props.onRefresh();
    expect(refresh).toHaveBeenCalledTimes(1);

    expect(screen.queryByTestId('receipt-details-sheet')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'View details for Moon Market' }));
    expect(screen.getByTestId('receipt-details-sheet')).toBeVisible();
    expect(screen.getByText('Apples')).toBeVisible();
    expect(screen.getByText('Soap')).toBeVisible();
    expect(screen.getByText('Groceries')).toBeVisible();
    expect(screen.getByText('Home')).toBeVisible();
    expect(screen.getAllByText('CHF 5.00')).toHaveLength(2);
    expect(screen.getAllByText('CHF 7.50')).toHaveLength(2);
    expect(screen.getAllByText('CHF 12.50')).toHaveLength(2);
    fireEvent.press(screen.getAllByRole('button', { name: 'Close receipt details' })[0]);
    await waitFor(() => expect(screen.queryByText('Apples')).toBeNull());
  });

  it('renders image and non-image preview states and closes them', async () => {
    const image = receipt();
    const document = receipt({
      id: 8,
      filename: 'statement.pdf',
      mimeType: 'application/pdf',
      suggestion: null,
      status: 'failed',
    });
    renderReceipts({ receipts: [image, document] });
    fireEvent.press(screen.getByRole('button', { name: 'View details for Moon Market' }));
    fireEvent.press(screen.getByRole('button', { name: 'View Moon Market' }));
    const photo = screen.getByLabelText('Receipt photo market.jpg');
    expect(photo).toBeVisible();
    expect(screen.UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    fireEvent(photo, 'load');
    expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Close receipt photo' }));
    await waitFor(() => expect(screen.queryByTestId('receipt-preview')).toBeNull());

    fireEvent.press(screen.getByRole('button', { name: 'View details for statement.pdf' }));
    fireEvent.press(screen.getByRole('button', { name: 'View statement.pdf' }));
    expect(screen.getByText('Photo preview is unavailable for this file.')).toBeVisible();
    expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeNull();
  });

  it('replaces the preview spinner with an image error message', () => {
    renderReceipts({ receipts: [receipt()] });
    fireEvent.press(screen.getByRole('button', { name: 'View details for Moon Market' }));
    fireEvent.press(screen.getByRole('button', { name: 'View Moon Market' }));
    fireEvent(screen.getByLabelText('Receipt photo market.jpg'), 'error');
    expect(screen.getByText('Could not load this receipt photo.')).toBeVisible();
    expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeNull();
  });
});
