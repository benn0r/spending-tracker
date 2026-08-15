import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';

import type { ApiConfiguration } from '../../api';
import { styles } from '../../styles';

export function ServerSetupScreen({
  initialValue,
  onSave,
  onCancel,
  recoveryMessage,
  sheet = false,
}: {
  initialValue?: ApiConfiguration | null;
  onSave: (configuration: ApiConfiguration) => void;
  onCancel?: () => void;
  recoveryMessage?: string;
  sheet?: boolean;
}) {
  const [serverUrl, setServerUrl] = useState(initialValue?.serverUrl ?? '');
  const [apiToken, setApiToken] = useState(initialValue?.apiToken ?? '');
  const [tokenVisible, setTokenVisible] = useState(false);
  const [error, setError] = useState('');

  const save = () => {
    const normalizedUrl = serverUrl.trim().replace(/\/+$/, '');
    if (!/^https?:\/\/[^\s]+$/i.test(normalizedUrl)) {
      setError('Enter a complete server URL beginning with http:// or https://.');
      return;
    }
    if (!apiToken.trim()) {
      setError('Enter the API token configured on the server.');
      return;
    }
    setError('');
    onSave({ serverUrl: normalizedUrl, apiToken: apiToken.trim() });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={sheet ? styles.setupSheet : styles.setupScreen}
    >
      <View style={sheet ? styles.setupSheetContent : styles.setupCard}>
        {sheet ? <View style={styles.handle} /> : null}
        {sheet ? (
          <View style={styles.setupSheetHeading}>
            <View style={styles.sheetTitleGroup}>
              <View style={styles.sheetTitleIcon}>
                <Ionicons name="server-outline" size={20} color="#77409A" />
              </View>
              <Text accessibilityRole="header" style={styles.receiptDetailsTitle}>
                Server connection
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close server connection settings"
              accessibilityRole="button"
              onPress={onCancel}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={22} color="#2E2833" />
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.setupIcon}>
              <Ionicons name="server-outline" size={28} color="#77409A" />
            </View>
            <Text style={styles.setupEyebrow}>CONNECTION</Text>
            <Text accessibilityRole="header" style={styles.setupTitle}>
              Connect your server
            </Text>
          </>
        )}
        <Text style={styles.setupIntro}>
          {sheet
            ? 'Update the server address and API token saved on this device.'
            : 'Enter the Spending Tracker Server address and its API token. These details stay on this device.'}
        </Text>
        {recoveryMessage ? (
          <View style={styles.setupRecovery}>
            <Ionicons name="alert-circle-outline" size={20} color="#B42318" />
            <Text style={styles.setupRecoveryText}>{recoveryMessage}</Text>
          </View>
        ) : null}

        <Text style={styles.setupLabel}>Server URL</Text>
        <TextInput
          accessibilityLabel="Server URL"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://spending.example.com"
          style={styles.setupInput}
          value={serverUrl}
          onChangeText={setServerUrl}
        />
        <Text style={styles.setupLabel}>API token</Text>
        <View style={styles.setupTokenField}>
          <TextInput
            accessibilityLabel="API token"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Paste your server API token"
            secureTextEntry={!tokenVisible}
            style={styles.setupTokenInput}
            value={apiToken}
            onChangeText={setApiToken}
          />
          <Pressable
            accessibilityLabel={tokenVisible ? 'Hide API token' : 'Show API token'}
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => setTokenVisible((visible) => !visible)}
          >
            <Ionicons
              name={tokenVisible ? 'eye-off-outline' : 'eye-outline'}
              size={21}
              color="#746B78"
            />
          </Pressable>
        </View>
        {error ? <Text style={styles.setupError}>{error}</Text> : null}
        <View style={styles.setupActions}>
          {onCancel && !sheet ? (
            <Pressable accessibilityRole="button" onPress={onCancel} style={styles.setupCancel}>
              <Text style={styles.setupCancelText}>Cancel</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={save} style={styles.setupSave}>
            <Text style={styles.setupSaveText}>Save connection</Text>
            <Ionicons name="arrow-forward" size={19} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
