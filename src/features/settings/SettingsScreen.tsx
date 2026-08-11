import { ScrollView, Text, View } from 'react-native';
import { AccountDropdown } from '../../components/AccountDropdown';
import { styles } from '../../styles';
import type { Reference } from '../../types';

export function SettingsScreen({
  defaultAccount,
  accounts,
  onChangeDefaultAccount,
}: {
  defaultAccount: string;
  accounts: Reference[];
  onChangeDefaultAccount: (account: string) => void;
}) {
  return (
    <ScrollView style={styles.secondaryScreen} contentContainerStyle={styles.settingsContent}>
      <Text style={styles.secondaryEyebrow}>PREFERENCES</Text>
      <Text style={styles.secondaryTitle}>Settings</Text>
      <Text style={styles.settingsIntro}>
        Personalize how new transactions are prepared on this device.
      </Text>
      <View style={styles.settingsSection}>
        <AccountDropdown
          value={defaultAccount}
          options={accounts}
          onChange={onChangeDefaultAccount}
        />
      </View>
    </ScrollView>
  );
}
