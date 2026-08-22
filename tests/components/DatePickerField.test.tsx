import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { DatePickerField } from '../../src/features/transactions/fields/DatePickerField';

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('../../src/components/DrawerSheet', () => {
  const { View } = jest.requireActual('react-native');
  return { DrawerSheet: ({ children }: { children: ReactNode }) => <View>{children}</View> };
});
jest.mock('@react-native-community/datetimepicker', () => {
  const { Pressable } = jest.requireActual('react-native');
  return function DateTimePickerMock({
    onChange,
  }: {
    onChange: (event: { type: string }, date?: Date) => void;
  }) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose August 12"
        onPress={() => onChange({ type: 'set' }, new Date(2026, 7, 12))}
      />
    );
  };
});

it('opens the native calendar, emits a strict local date, and closes with Done', () => {
  const onChange = jest.fn();
  render(<DatePickerField value="2026-08-10" onChange={onChange} />);

  fireEvent.press(screen.getByRole('button', { name: 'Open date calendar' }));
  expect(screen.getByText('Transaction date')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Choose August 12' }));
  expect(onChange).toHaveBeenCalledWith('2026-08-12');
  fireEvent.press(screen.getByRole('button', { name: 'Confirm date' }));
  expect(screen.queryByText('Transaction date')).toBeNull();
});
