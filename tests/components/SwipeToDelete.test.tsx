import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Modal, Text } from 'react-native';

import { SwipeProvider, SwipeToDelete } from '../../src/components/SwipeToDelete';

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

function renderRows(onDelete = jest.fn()) {
  render(
    <SwipeProvider>
      <SwipeToDelete id="first" label="Moonbeam receipt" onDelete={onDelete}>
        <Text>First row</Text>
      </SwipeToDelete>
      <SwipeToDelete id="second" label="Starlight receipt" onDelete={onDelete}>
        <Text>Second row</Text>
      </SwipeToDelete>
    </SwipeProvider>,
  );
  return onDelete;
}

describe('SwipeToDelete', () => {
  it('renders independently addressable rows and closes open state from the provider', () => {
    jest.useFakeTimers();
    renderRows();
    expect(screen.getByTestId('swipe-first')).toBeVisible();
    expect(screen.getByTestId('swipe-second')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Delete Moonbeam receipt' })).toBeVisible();

    fireEvent(screen.getByTestId('swipe-dismiss-area'), 'touchStart');
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it('supports cancel, system dismissal, and confirmed deletion', () => {
    const onDelete = renderRows();
    fireEvent.press(screen.getByRole('button', { name: 'Delete Moonbeam receipt' }));
    expect(screen.getByText('Delete Moonbeam receipt?')).toBeVisible();
    fireEvent.press(screen.getByRole('button', { name: 'Cancel delete' }));
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Delete Moonbeam receipt' }));
    const confirmation = screen.UNSAFE_getAllByType(Modal).find(({ props }) => props.visible);
    expect(confirmation).toBeDefined();
    if (!confirmation) throw new Error('Expected a visible confirmation modal.');
    fireEvent(confirmation, 'requestClose');
    expect(screen.queryByText('Delete Moonbeam receipt?')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Delete Starlight receipt' }));
    fireEvent.press(screen.getByRole('button', { name: 'Confirm delete Starlight receipt' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
