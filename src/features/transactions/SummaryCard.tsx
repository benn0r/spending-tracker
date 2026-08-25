import { type LayoutChangeEvent, Text, View } from 'react-native';

import { styles } from '../../styles';
import { nativeDeviceLocale } from '../../device-locale';
import type { CashFlow } from '../../types';
import { GlassBackground } from '../../components/GlassBackground';

function amount(value: number, currency: string) {
  return new Intl.NumberFormat(nativeDeviceLocale(), {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function monthLabel(month: string, style: 'long' | 'short') {
  const [year = new Date().getFullYear(), monthNumber = 1] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(nativeDeviceLocale(), {
    month: style,
    ...(style === 'long' ? { year: 'numeric' as const } : {}),
  }).format(new Date(year, monthNumber - 1, 1, 12));
}

export function SummaryCard({
  cashFlow,
  topInset = 0,
  onLayout,
}: {
  cashFlow: CashFlow | null;
  topInset?: number;
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const months = cashFlow?.months ?? [];
  const current = months.at(-1) ?? { month: '', income: 0, expenses: 0, net: 0 };
  const maximum = Math.max(1, ...months.flatMap(({ income, expenses }) => [income, expenses]));

  return (
    <View
      onLayout={onLayout}
      style={[styles.summaryCard, { marginTop: -(8 + topInset), paddingTop: 24 }]}
      testID="cash-flow-summary"
    >
      <GlassBackground intensity={62} tintColor="rgba(255, 255, 255, 0.24)" />
      <Text style={styles.cashFlowEyebrow}>MONTHLY CASH FLOW</Text>
      <Text style={styles.cashFlowBalance}>{amount(current.net, cashFlow?.currency ?? 'CHF')}</Text>
      <Text style={styles.cashFlowMonth}>
        {current.month ? monthLabel(current.month, 'long') : 'Current month'}
      </Text>
      <View style={styles.cashFlowMetrics}>
        <View style={styles.cashFlowMetric}>
          <View style={[styles.dot, styles.incomeDot]}>
            <GlassBackground intensity={44} tintColor="rgba(74, 190, 136, 0.76)" />
          </View>
          <Text style={styles.cashFlowMetricLabel}>Income</Text>
          <Text style={styles.cashFlowMetricValue}>
            {amount(current.income, cashFlow?.currency ?? 'CHF')}
          </Text>
        </View>
        <View style={styles.cashFlowMetric}>
          <View style={[styles.dot, styles.spentDot]}>
            <GlassBackground intensity={44} tintColor="rgba(225, 104, 126, 0.76)" />
          </View>
          <Text style={styles.cashFlowMetricLabel}>Expenses</Text>
          <Text style={styles.cashFlowMetricValue}>
            {amount(current.expenses, cashFlow?.currency ?? 'CHF')}
          </Text>
        </View>
      </View>
      <View style={styles.cashFlowChart} accessibilityLabel="Six month income and expense chart">
        {months.map((month) => (
          <View style={styles.cashFlowColumn} key={month.month}>
            <View style={styles.cashFlowBars}>
              <View
                style={[
                  styles.cashFlowBar,
                  styles.cashFlowIncomeBar,
                  { height: Math.max(2, (month.income / maximum) * 72) },
                ]}
              >
                <GlassBackground intensity={44} tintColor="rgba(74, 190, 136, 0.76)" />
              </View>
              <View
                style={[
                  styles.cashFlowBar,
                  styles.cashFlowExpenseBar,
                  { height: Math.max(2, (month.expenses / maximum) * 72) },
                ]}
              >
                <GlassBackground intensity={44} tintColor="rgba(225, 104, 126, 0.76)" />
              </View>
            </View>
            <Text style={styles.cashFlowChartLabel}>{monthLabel(month.month, 'short')}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
