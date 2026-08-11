import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { styles } from '../../styles';
import { summarize } from '../../transactions';
import type { ApiTransaction } from '../../types';

export function SummaryCard({ transactions }: { transactions: ApiTransaction[] }) {
  const totals = useMemo(() => summarize(transactions), [transactions]);
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.eyebrow}>AVAILABLE BALANCE</Text>
      <Text style={styles.balance}>
        CHF {totals.balance.toLocaleString('en-CH', { minimumFractionDigits: 2 })}
      </Text>
      <View style={styles.summaryDivider} />
      <View style={styles.summaryRow}>
        <View style={styles.summaryMetric}>
          <View style={[styles.dot, styles.incomeDot]} />
          <View>
            <Text style={styles.metricLabel}>Income</Text>
            <Text style={styles.metricValue}>CHF {totals.income.toLocaleString('en-CH')}</Text>
          </View>
        </View>
        <View style={styles.summaryMetric}>
          <View style={[styles.dot, styles.spentDot]} />
          <View>
            <Text style={styles.metricLabel}>Spent</Text>
            <Text style={styles.metricValue}>CHF {totals.spent.toLocaleString('en-CH')}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
