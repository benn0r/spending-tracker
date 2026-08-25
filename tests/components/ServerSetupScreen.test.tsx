import { fireEvent, render, screen } from '@testing-library/react-native';

import { ServerSetupScreen } from '../../src/features/setup/ServerSetupScreen';

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');

describe('ServerSetupScreen', () => {
  it('validates and saves a normalized connection', () => {
    const onSave = jest.fn();
    render(<ServerSetupScreen onSave={onSave} />);

    fireEvent.press(screen.getByRole('button', { name: 'Save connection' }));
    expect(screen.getByText(/complete server URL/)).toBeVisible();

    fireEvent.changeText(screen.getByLabelText('Server URL'), 'https://spending.example.test/');
    fireEvent.changeText(screen.getByLabelText('API token'), ' secret-token ');
    fireEvent.press(screen.getByRole('button', { name: 'Save connection' }));

    expect(onSave).toHaveBeenCalledWith({
      serverUrl: 'https://spending.example.test',
      apiToken: 'secret-token',
    });
  });

  it('can reveal the token and cancel edits', () => {
    const onCancel = jest.fn();
    render(
      <ServerSetupScreen
        initialValue={{ serverUrl: 'https://spending.example.test', apiToken: 'token' }}
        onCancel={onCancel}
        onSave={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Show API token' }));
    expect(screen.getByRole('button', { name: 'Hide API token' })).toBeVisible();
    fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('relies on drawer gestures instead of a close action when editing in a sheet', () => {
    const onCancel = jest.fn();
    render(
      <ServerSetupScreen
        sheet
        initialValue={{ serverUrl: 'https://spending.example.test', apiToken: 'token' }}
        onCancel={onCancel}
        onSave={jest.fn()}
      />,
    );

    expect(screen.getByRole('header', { name: 'Server connection' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeOnTheScreen();
    expect(
      screen.queryByRole('button', { name: 'Close server connection settings' }),
    ).not.toBeOnTheScreen();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
