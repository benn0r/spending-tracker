import { Text, View } from 'react-native';

import { styles } from '../../styles';
import { formatCurrency, formatDateHeader } from '../../transactions';

export function DateSectionHeader({ date, total }: { date: string; total: number }) {
  return (
    <View style={styles.dateSectionHeader}>
      <Text style={styles.dateSectionTitle}>{formatDateHeader(date)}</Text>
      <Text style={[styles.amount, styles.dateSectionAmount]}>{formatCurrency(total)}</Text>
    </View>
  );
}
