import { useAppScreen } from '../src/navigation/AppScreenContext';

export default function TransactionsRoute() {
  return useAppScreen('transactions');
}
