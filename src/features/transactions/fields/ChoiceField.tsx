import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { styles } from '../../../styles';
import { colors } from '../../../theme';
import type { Reference } from '../../../types';

type ChoiceFieldProps = {
  label: string;
  options: Reference[];
} & (
  | {
      value: string;
      onChange: (value: string) => void;
      multiple?: false;
    }
  | {
      value: string[];
      onChange: (value: string[]) => void;
      multiple: true;
    }
);

export function ChoiceField(props: ChoiceFieldProps) {
  const { label, options } = props;
  const selected = Array.isArray(props.value) ? props.value : [props.value];
  const [tagSearchOpen, setTagSearchOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState('');
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const choiceScrollRef = useRef<ScrollView>(null);
  const orderedOptions = [
    ...options.filter(({ id }) => selected.includes(id)),
    ...options.filter(({ id }) => !selected.includes(id)),
  ];
  const filteredOptions = options.filter(({ name }) =>
    name.toLocaleLowerCase().includes(tagQuery.trim().toLocaleLowerCase()),
  );
  const toggleOption = (option: Reference) => {
    const active = selected.includes(option.id);
    if (props.multiple) {
      props.onChange(active ? selected.filter((id) => id !== option.id) : [...selected, option.id]);
    } else {
      props.onChange(option.id);
    }
  };
  return (
    <View style={styles.fieldGroup}>
      <View style={styles.choiceControl}>
        <ScrollView
          ref={choiceScrollRef}
          accessibilityLabel={label}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.choiceScroller}
          contentContainerStyle={styles.choiceRow}
        >
          {orderedOptions.map((option) => {
            const active = selected.includes(option.id);
            return (
              <Pressable
                key={option.id}
                accessibilityRole={props.multiple ? 'checkbox' : 'radio'}
                accessibilityState={{ checked: active }}
                aria-checked={active}
                onPress={() => toggleOption(option)}
                style={[styles.choice, active && styles.activeChoice]}
              >
                <Text style={[styles.choiceText, active && styles.activeChoiceText]}>
                  {option.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {props.multiple ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search tags"
            onPress={() => {
              setTagQuery('');
              setPendingTags(selected);
              setTagSearchOpen(true);
            }}
            style={styles.tagSearchButton}
          >
            <Ionicons name="search" size={19} color={colors.accent} />
          </Pressable>
        ) : null}
      </View>
      {props.multiple ? (
        <Modal
          visible={tagSearchOpen}
          transparent
          animationType={Platform.OS === 'web' ? 'none' : 'fade'}
          onRequestClose={() => setTagSearchOpen(false)}
        >
          <View style={styles.nestedModalRoot}>
            <Pressable
              accessibilityLabel="Close tag search"
              onPress={() => setTagSearchOpen(false)}
              style={styles.nestedScrim}
            />
            <View style={styles.tagSearchSheet} testID="tag-search-sheet">
              <View style={styles.handle} />
              <View style={styles.tagSearchHeader}>
                <Text style={styles.categorySheetTitle}>Choose tags</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Done selecting tags"
                  onPress={() => {
                    props.onChange(pendingTags);
                    setTagSearchOpen(false);
                    setTimeout(() => choiceScrollRef.current?.scrollTo({ x: 0, animated: true }));
                  }}
                  style={styles.dateDoneButton}
                >
                  <Text style={styles.dateDoneText}>Done</Text>
                </Pressable>
              </View>
              <View style={styles.tagSearchField}>
                <Ionicons name="search" size={20} color={colors.muted} />
                <TextInput
                  accessibilityLabel="Search tags"
                  value={tagQuery}
                  onChangeText={setTagQuery}
                  placeholder="Search tags"
                  placeholderTextColor="#A7A99F"
                  style={styles.input}
                />
              </View>
              <ScrollView
                contentContainerStyle={styles.tagSearchList}
                keyboardShouldPersistTaps="always"
              >
                {filteredOptions.map((item) => {
                  const active = pendingTags.includes(item.id);
                  const selectTag = () => {
                    const next = active
                      ? pendingTags.filter((id) => id !== item.id)
                      : [...pendingTags, item.id];
                    setPendingTags(next);
                  };
                  return (
                    <Pressable
                      key={item.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: active }}
                      aria-checked={active}
                      onPress={selectTag}
                      style={[styles.tagSearchOption, active && styles.activeTagSearchOption]}
                    >
                      <View style={[styles.tagCheckbox, active && styles.activeTagCheckbox]}>
                        {active ? (
                          <Ionicons name="checkmark" size={15} color={colors.white} />
                        ) : null}
                      </View>
                      <Text style={styles.tagSearchOptionText}>{item.name}</Text>
                    </Pressable>
                  );
                })}
                {!filteredOptions.length ? (
                  <Text style={styles.emptyText}>No matching tags.</Text>
                ) : null}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
