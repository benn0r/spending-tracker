import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import type { QueuedTransaction } from '../../app-model';
import { styles } from '../../styles';
import { colors } from '../../theme';
import { formatCurrency } from '../../transactions';

export function TransactionQueue({
  items,
  retrying,
  onRetry,
  onDiscard,
}: {
  items: QueuedTransaction[];
  retrying: string | null;
  onRetry: (item: QueuedTransaction) => void;
  onDiscard: (item: QueuedTransaction) => void;
}) {
  if (!items.length) return null;
  return (
    <View style={styles.queuePanel} testID="transaction-queue">
      <View style={styles.queueHeading}>
        <View style={styles.queueHeadingCopy}>
          <View style={styles.queueStatusDot} />
          <Text style={styles.queueTitle}>Waiting to sync</Text>
        </View>
        <Text style={styles.queueCount}>{items.length}</Text>
      </View>
      <Text style={styles.queueIntro}>
        These expenses are saved on this device. Retry when the server is available.
      </Text>
      {items.map((item) => (
        <View key={item.id} style={styles.queueItem}>
          <View style={styles.queueItemIcon}>
            <Ionicons name="cloud-offline-outline" size={20} color={colors.accentDark} />
          </View>
          <View style={styles.queueItemCopy}>
            <Text style={styles.queueItemTitle}>{item.category}</Text>
            <Text style={styles.queueItemMeta}>{item.account}</Text>
            <Text style={styles.queueItemError} selectable>
              {item.error}
            </Text>
          </View>
          <View style={styles.queueItemAction}>
            <Text style={styles.queueItemAmount}>{formatCurrency(item.payload.amount)}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Retry ${item.category}`}
              disabled={retrying === item.id}
              onPress={() => onRetry(item)}
              style={styles.retryQueueButton}
            >
              {retrying === item.id ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <>
                  <Ionicons name="refresh" size={14} color={colors.accent} />
                  <Text style={styles.retryQueueText}>Retry</Text>
                </>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${item.category} from queue`}
              disabled={retrying === item.id}
              onPress={() => onDiscard(item)}
              style={styles.discardQueueButton}
            >
              <Text style={styles.discardQueueText}>Dismiss</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}
