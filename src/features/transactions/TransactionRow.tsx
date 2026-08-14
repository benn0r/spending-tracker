import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { styles } from '../../styles';
import { colors } from '../../theme';
import { formatCurrency } from '../../transactions';
import type { ApiTransaction, CategoryReference } from '../../types';
import { categoryVisual, transactionIcon } from '../categories/categoryVisual';

export function TransactionRow({
  item,
  categories,
  onDelete,
}: {
  item: ApiTransaction;
  categories: CategoryReference[];
  onDelete: (item: ApiTransaction) => void;
}) {
  const title = item.payee && item.payee !== '—' ? item.payee : item.category;
  const serverCategory = categories.find(
    ({ name }) => name.toLowerCase() === item.category.toLowerCase(),
  );
  const serverVisual = serverCategory ? categoryVisual(serverCategory, 0) : null;
  const icon = serverVisual?.icon ?? transactionIcon(item);
  const iconColor = serverVisual?.color ?? (item.amount > 0 ? colors.green : colors.accentDark);
  const iconBackground = serverVisual
    ? `${iconColor}1A`
    : item.amount > 0
      ? '#DDF0E5'
      : `${iconColor}1A`;
  return (
    <SwipeToDelete
      id={`transaction-${item.id}`}
      label={title}
      revealSpacing={12}
      onDelete={() => onDelete(item)}
    >
      <View style={styles.transactionRow} testID={`transaction-${item.id}`}>
        <View style={[styles.transactionIcon, { backgroundColor: iconBackground }]}>
          <Ionicons name={icon} size={19} color={iconColor} />
        </View>
        <View style={styles.transactionCopy}>
          <Text style={styles.merchant}>{title}</Text>
          <Text style={styles.transactionMeta}>
            {item.category} · {item.account}
          </Text>
        </View>
        <Text style={[styles.amount, item.amount > 0 && styles.incomeAmount]}>
          {formatCurrency(item.amount)}
        </Text>
      </View>
    </SwipeToDelete>
  );
}
