import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { styles } from '../../styles';
import { colors } from '../../theme';
import { formatCurrency } from '../../transactions';
import type { ApiTransaction, CategoryReference } from '../../types';
import { categoryVisual, transactionIcon } from '../categories/categoryVisual';

const walletColors = ['#7B3FA1', '#2D83B7', '#2A9D78', '#C27A32', '#C34F70', '#5D6F91'];

function walletColor(account: string) {
  const index = [...account].reduce((total, character) => total + character.charCodeAt(0), 0);
  return walletColors[index % walletColors.length] ?? walletColors[0];
}

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
  const notes =
    item.notes && item.notes !== title && item.notes !== item.category ? item.notes : null;
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
  const accountColor = walletColor(item.account);
  return (
    <SwipeToDelete
      id={`transaction-${item.id}`}
      label={title}
      rounded={false}
      revealSpacing={12}
      onDelete={() => onDelete(item)}
    >
      <View style={styles.transactionRow} testID={`transaction-${item.id}`}>
        <View style={[styles.transactionIcon, { backgroundColor: iconBackground }]}>
          <Ionicons name={icon} size={19} color={iconColor} />
        </View>
        <View style={styles.transactionCopy}>
          <Text style={styles.merchant}>{title}</Text>
          <View style={styles.transactionMetaRow}>
            <View
              accessible
              accessibilityLabel={`Wallet ${item.account}`}
              accessibilityRole="image"
              style={[styles.transactionWalletPill, { backgroundColor: `${accountColor}1A` }]}
            >
              <Ionicons name="wallet-outline" size={11} color={accountColor} />
            </View>
            {(item.tags ?? []).map((tag) => (
              <View key={tag} style={styles.transactionTagPill}>
                <Text ellipsizeMode="tail" numberOfLines={1} style={styles.transactionTagText}>
                  #{tag}
                </Text>
              </View>
            ))}
            {notes ? (
              <Text
                ellipsizeMode="tail"
                numberOfLines={1}
                style={[styles.transactionMeta, styles.transactionMetaDetails]}
              >
                {notes}
              </Text>
            ) : null}
          </View>
        </View>
        <Text style={[styles.amount, item.amount > 0 && styles.incomeAmount]}>
          {formatCurrency(item.amount)}
        </Text>
      </View>
    </SwipeToDelete>
  );
}
