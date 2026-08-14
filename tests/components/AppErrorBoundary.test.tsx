import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AppErrorBoundary } from '../../src/components/AppErrorBoundary';

function CrashingScreen(): never {
  throw new Error('Startup failed');
}

describe('AppErrorBoundary', () => {
  it('shows a recoverable fallback when configured app startup fails', () => {
    const onError = jest.fn();
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <AppErrorBoundary fallback={<Text>Connection recovery</Text>} onError={onError}>
        <CrashingScreen />
      </AppErrorBoundary>,
    );

    expect(screen.getByText('Connection recovery')).toBeVisible();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'Startup failed' }));
    consoleError.mockRestore();
  });
});
