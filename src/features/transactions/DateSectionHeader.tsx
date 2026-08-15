import { Text, View } from 'react-native';

import { styles } from '../../styles';
import { nativeDeviceLocale } from '../../device-locale';
import { formatCurrency, formatDateHeader } from '../../transactions';

export function DateSectionHeader({
  date,
  total,
  flushTop = false,
  sticky = false,
}: {
  date: string;
  total: number;
  flushTop?: boolean;
  sticky?: boolean;
}) {
  return (
    <View
      style={[
        styles.dateSectionHeader,
        flushTop && styles.dateSectionHeaderFlushTop,
        sticky && styles.stickyDateSectionHeader,
      ]}
    >
      <Text style={styles.dateSectionTitle}>
        {formatDateHeader(date, new Date(), nativeDeviceLocale())}
      </Text>
      <Text style={[styles.amount, styles.dateSectionAmount]}>{formatCurrency(total)}</Text>
    </View>
  );
}
