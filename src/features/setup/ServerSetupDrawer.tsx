import { Modal, Pressable, View } from 'react-native';
import type { ApiConfiguration } from '../../api';
import { DrawerSheet } from '../../components/DrawerSheet';
import { useDrawerTransition } from '../../components/useDrawerTransition';
import { styles } from '../../styles';
import { ServerSetupScreen } from './ServerSetupScreen';

export function ServerSetupDrawer({
  visible,
  configuration,
  onSave,
  onClose,
}: {
  visible: boolean;
  configuration: ApiConfiguration;
  onSave: (configuration: ApiConfiguration) => void;
  onClose: () => void;
}) {
  const drawer = useDrawerTransition(visible, onClose);
  return (
    <Modal
      animationType="none"
      transparent
      visible={drawer.mounted}
      onShow={drawer.onShow}
      onRequestClose={drawer.dismiss}
    >
      <View style={styles.setupModalRoot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close server connection settings"
          style={styles.receiptDetailsScrim}
          onPress={drawer.dismiss}
        />
        <DrawerSheet
          visible={drawer.sheetVisible}
          onHidden={drawer.onHidden}
          style={styles.setupSheet}
        >
          <ServerSetupScreen
            sheet
            initialValue={configuration}
            onCancel={drawer.dismiss}
            onSave={(next) => {
              onSave(next);
              drawer.dismiss();
            }}
          />
        </DrawerSheet>
      </View>
    </Modal>
  );
}
