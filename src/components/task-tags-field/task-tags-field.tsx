import React, { useMemo, useState } from 'react';
import Input from '../ui/input/input';
import { useForm } from '../ui/form/FormProvider';
import styles from './task-tags-field.module.css';

interface TaskTagsFieldProps {
  name: string;
  label?: string;
  placeholder?: string;
  suggestions?: string[];
  disabled?: boolean;
}

const normalizeTag = (tag: string) => String(tag || '').trim().replace(/\s+/g, ' ');
const normalizeTagKey = (tag: string) => normalizeTag(tag).toLocaleLowerCase('ru');

const TaskTagsField: React.FC<TaskTagsFieldProps> = ({
  name,
  label = 'Теги',
  placeholder = 'Введите тег и нажмите Enter',
  suggestions = [],
  disabled = false,
}) => {
  const { values, setFieldValue } = useForm();
  const [draft, setDraft] = useState('');

  const currentTags = Array.isArray(values[name]) ? values[name] : [];

  const addTag = (rawTag: string) => {
    const nextTag = normalizeTag(rawTag);
    if (!nextTag) return;

    const exists = currentTags.some((tag: string) => normalizeTagKey(tag) === normalizeTagKey(nextTag));
    if (exists) {
      setDraft('');
      return;
    }

    setFieldValue(name, [...currentTags, nextTag]);
    setDraft('');
  };

  const removeTag = (tagToRemove: string) => {
    setFieldValue(
      name,
      currentTags.filter((tag: string) => normalizeTagKey(tag) !== normalizeTagKey(tagToRemove))
    );
  };

  const filteredSuggestions = useMemo(() => {
    const selectedKeys = new Set(currentTags.map((tag: string) => normalizeTagKey(tag)));
    const query = normalizeTagKey(draft);

    return suggestions
      .map(normalizeTag)
      .filter(Boolean)
      .filter((tag) => !selectedKeys.has(normalizeTagKey(tag)))
      .filter((tag) => !query || normalizeTagKey(tag).includes(query))
      .slice(0, 8);
  }, [currentTags, draft, suggestions]);

  return (
    <div className={styles['task-tags-field']}>
      <label className={styles['task-tags-field__label']}>{label}</label>
      {currentTags.length > 0 ? (
        <div className={styles['task-tags-field__chips']}>
          {currentTags.map((tag: string) => (
            <span key={tag} className={styles['task-tags-field__chip']}>
              {tag}
              {!disabled ? (
                <button type="button" onClick={() => removeTag(tag)} aria-label={`Удалить тег ${tag}`}>
                  ×
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}

      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, 40))}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(draft);
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
      />

      <div className={styles['task-tags-field__hint']}>
        Нажмите `Enter`, чтобы добавить тег. Теги сохраняются на уровне организации и потом предлагаются повторно.
      </div>

      {filteredSuggestions.length > 0 ? (
        <div className={styles['task-tags-field__suggestions']}>
          {filteredSuggestions.map((tag) => (
            <button
              key={tag}
              type="button"
              className={styles['task-tags-field__suggestion']}
              onClick={() => addTag(tag)}
              disabled={disabled}
            >
              {tag}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default TaskTagsField;
