import { Text, View } from 'react-native';

import { styles } from '../../styles';
import { formatCurrency, formatDateHeader } from '../../transactions';

export function DateSectionHeader({
  date,
  total,
  flushTop = false,
}: {
  date: string;
  total: number;
  flushTop?: boolean;
}) {
  return (
    <View style={[styles.dateSectionHeader, flushTop && styles.dateSectionHeaderFlushTop]}>
      <Text style={styles.dateSectionTitle}>{formatDateHeader(date)}</Text>
      <Text style={[styles.amount, styles.dateSectionAmount]}>{formatCurrency(total)}</Text>
    </View>
  );
}
