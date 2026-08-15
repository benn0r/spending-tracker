import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { formatLocalDate, parseLocalDate } from '../../../app-model';
import { nativeDeviceLocale } from '../../../device-locale';
import { styles } from '../../../styles';
import { colors } from '../../../theme';
import { formatDateHeader } from '../../../transactions';

export function DatePickerField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const today = formatLocalDate(new Date());
  const selected = value || today;
  const locale = nativeDeviceLocale();
  const chooseDate = (_event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') setOpen(false);
    if (date) onChange(formatLocalDate(date));
  };
  return (
    <View style={styles.fieldGroup}>
      <View style={[styles.dateShortcuts, styles.fieldControl]}>
        {Platform.OS === 'web' ? (
          <View style={[styles.dateCalendarButton, styles.webDateInput]}>
            <Ionicons name="calendar-outline" size={18} color={colors.accent} />
            <TextInput
              accessibilityLabel="Date"
              value={selected}
              onChangeText={onChange}
              style={styles.webDateTextInput}
            />
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open date calendar"
            onPress={() => setOpen(true)}
            style={styles.dateCalendarButton}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.accent} />
            <Text style={styles.dateCalendarText}>
              {formatDateHeader(selected, new Date(), locale)}
            </Text>
          </Pressable>
        )}
      </View>
      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          value={parseLocalDate(selected) ?? new Date()}
          mode="date"
          onChange={chooseDate}
        />
      ) : null}
      <Modal
        visible={open && Platform.OS === 'ios'}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.nestedModalRoot}>
          <Pressable style={styles.nestedScrim} onPress={() => setOpen(false)} />
          <View style={styles.datePickerSheet}>
            <View style={styles.handle} />
            <View style={styles.datePickerHeader}>
              <View>
                <Text style={styles.categorySheetTitle}>Transaction date</Text>
                <Text style={styles.datePickerSelection}>
                  {formatDateHeader(selected, new Date(), locale)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Confirm date"
                onPress={() => setOpen(false)}
                style={styles.dateDoneButton}
              >
                <Text style={styles.dateDoneText}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={parseLocalDate(selected) ?? new Date()}
              mode="date"
              display="inline"
              locale={locale}
              onChange={chooseDate}
              accentColor={colors.accent}
              style={styles.datePicker}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
