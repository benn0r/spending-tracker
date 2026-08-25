import { useAppScreen } from '../src/navigation/AppScreenContext';

export default function SettingsRoute() {
  return useAppScreen('settings');
}
