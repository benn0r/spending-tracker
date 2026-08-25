import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { AccountDropdown } from '../../components/AccountDropdown';
import { styles } from '../../styles';
import type { Reference } from '../../types';
import { GlassBackground } from '../../components/GlassBackground';

export function SettingsScreen({
  defaultAccount,
  accounts,
  onChangeDefaultAccount,
  serverUrl,
  onEditConnection,
}: {
  defaultAccount: string;
  accounts: Reference[];
  onChangeDefaultAccount: (account: string) => void;
  serverUrl: string;
  onEditConnection: () => void;
}) {
  return (
    <View style={styles.secondaryFixedScreen}>
      <View style={styles.secondaryHeader}>
        <Text style={styles.secondaryTitle}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={styles.settingsContent}>
        <Text style={styles.settingsIntro}>
          Personalize how new transactions are prepared on this device.
        </Text>
        <View style={[styles.settingsSection, styles.glassContentCard]}>
          <GlassBackground intensity={62} tintColor="rgba(255, 255, 255, 0.5)" />
          <AccountDropdown
            value={defaultAccount}
            options={accounts}
            onChange={onChangeDefaultAccount}
          />
        </View>
        <View style={[styles.settingsSection, styles.glassContentCard]}>
          <GlassBackground intensity={62} tintColor="rgba(255, 255, 255, 0.5)" />
          <Text style={styles.settingsLabel}>Server connection</Text>
          <Pressable
            accessibilityLabel="Edit server connection"
            accessibilityRole="button"
            onPress={onEditConnection}
            style={styles.settingsConnection}
          >
            <View style={styles.settingsSelectCopy}>
              <View style={styles.settingsSelectIcon}>
                <Ionicons name="server-outline" size={20} color="#77409A" />
              </View>
              <View style={styles.settingsConnectionCopy}>
                <Text numberOfLines={1} style={styles.settingsSelectValue}>
                  {serverUrl}
                </Text>
                <Text style={styles.settingsSelectHint}>API token saved on this device</Text>
              </View>
            </View>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
