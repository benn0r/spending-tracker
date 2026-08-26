import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Modal } from 'react-native';

import { ServerSetupDrawer } from '../../src/features/setup/ServerSetupDrawer';

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

describe('ServerSetupDrawer', () => {
  it('saves edited values and closes after the drawer animation', () => {
    jest.useFakeTimers();
    const onSave = jest.fn();
    const onClose = jest.fn();
    render(
      <ServerSetupDrawer
        visible
        configuration={{ serverUrl: 'https://old.example.test', apiToken: 'old-token' }}
        onSave={onSave}
        onClose={onClose}
      />,
    );
    fireEvent.changeText(screen.getByLabelText('Server URL'), 'https://new.example.test/');
    fireEvent.changeText(screen.getByLabelText('API token'), ' new-token ');
    fireEvent.press(screen.getByRole('button', { name: 'Save connection' }));
    expect(onSave).toHaveBeenCalledWith({
      serverUrl: 'https://new.example.test',
      apiToken: 'new-token',
    });
    act(() => jest.advanceTimersByTime(320));
    expect(onClose).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('closes through both the backdrop and native modal request', () => {
    jest.useFakeTimers();
    const onClose = jest.fn();
    const { rerender } = render(
      <ServerSetupDrawer
        visible
        configuration={{ serverUrl: '', apiToken: '' }}
        onSave={jest.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Close server connection settings' }));
    act(() => jest.advanceTimersByTime(320));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <ServerSetupDrawer
        visible
        configuration={{ serverUrl: '', apiToken: '' }}
        onSave={jest.fn()}
        onClose={onClose}
      />,
    );
    fireEvent(screen.UNSAFE_getByType(Modal), 'requestClose');
    act(() => jest.advanceTimersByTime(320));
    expect(onClose).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});
