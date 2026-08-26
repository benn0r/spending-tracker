import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { styles } from '../../../styles';
import { colors } from '../../../theme';
import type { Reference } from '../../../types';
import { DrawerSheet } from '../../../components/DrawerSheet';
import { useDrawerTransition } from '../../../components/useDrawerTransition';

type ChoiceFieldProps = {
  label: string;
  options: Reference[];
  onCreateOption?: (name: string) => Promise<Reference>;
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
  const [creatingTag, setCreatingTag] = useState(false);
  const [createTagError, setCreateTagError] = useState('');
  const tagDrawer = useDrawerTransition(tagSearchOpen, () => setTagSearchOpen(false));
  const choiceScrollRef = useRef<ScrollView>(null);
  const orderedOptions = [
    ...options.filter(({ id }) => selected.includes(id)),
    ...options.filter(({ id }) => !selected.includes(id)),
  ];
  const filteredOptions = options.filter(({ name }) =>
    name.toLocaleLowerCase().includes(tagQuery.trim().toLocaleLowerCase()),
  );
  const newTagName = tagQuery.trim();
  const canCreateTag =
    Boolean(props.onCreateOption && newTagName) &&
    !options.some(({ name }) => name.toLocaleLowerCase() === newTagName.toLocaleLowerCase());
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
                accessibilityLabel={option.name}
                testID={`choice-${option.id}`}
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
              setCreateTagError('');
              setPendingTags(selected);
              setTagSearchOpen(true);
            }}
            style={styles.tagSearchButton}
          >
            <Ionicons name="search" size={19} color={colors.accent} />
          </Pressable>
        ) : null}
      </View>
      {props.multiple && tagDrawer.mounted ? (
        <Modal
          visible={tagDrawer.mounted}
          transparent
          animationType="none"
          onShow={tagDrawer.onShow}
          onRequestClose={tagDrawer.dismiss}
        >
          <View style={styles.nestedModalRoot}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close tag search"
              onPress={tagDrawer.dismiss}
              style={styles.nestedScrim}
            />
            <DrawerSheet
              visible={tagDrawer.sheetVisible}
              onHidden={tagDrawer.onHidden}
              onPullDown={tagDrawer.dismiss}
              style={styles.tagSearchSheet}
              testID="tag-search-sheet"
            >
              <View style={styles.handle} />
              <View style={styles.tagSearchHeader}>
                <Text style={styles.categorySheetTitle}>Choose tags</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Done selecting tags"
                  onPress={() => {
                    props.onChange(pendingTags);
                    setTagSearchOpen(false);
                    tagDrawer.dismiss();
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
                  autoFocus
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
                      accessibilityLabel={item.name}
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
                {canCreateTag ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Create tag ${newTagName}`}
                    disabled={creatingTag}
                    onPress={() => {
                      if (!props.onCreateOption) return;
                      setCreatingTag(true);
                      setCreateTagError('');
                      void props
                        .onCreateOption(newTagName)
                        .then((tag) => {
                          setPendingTags((current) =>
                            current.includes(tag.id) ? current : [...current, tag.id],
                          );
                          setTagQuery('');
                        })
                        .catch((cause) =>
                          setCreateTagError(
                            cause instanceof Error ? cause.message : 'Could not create tag.',
                          ),
                        )
                        .finally(() => setCreatingTag(false));
                    }}
                    style={[styles.tagSearchOption, creatingTag && styles.disabledButton]}
                  >
                    <View style={styles.tagCheckbox}>
                      <Ionicons name="add" size={16} color={colors.accent} />
                    </View>
                    <Text style={styles.tagSearchOptionText}>
                      {creatingTag ? 'Creating…' : `Create “${newTagName}”`}
                    </Text>
                  </Pressable>
                ) : null}
                {!filteredOptions.length ? (
                  <Text style={styles.emptyText}>No matching tags.</Text>
                ) : null}
                {createTagError ? <Text style={styles.errorText}>{createTagError}</Text> : null}
              </ScrollView>
            </DrawerSheet>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
