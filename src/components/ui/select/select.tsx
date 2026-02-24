import React, { useState, useRef, useEffect } from 'react';
import styles from './select.module.css';
import { ChevronDown, X } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  avatar_url?: string | null;
}

interface SelectProps {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  options: SelectOption[];
  placeholder?: string;
  isMulti?: boolean;
  isDisabled?: boolean;
  isClearable?: boolean; 
  isLoading?: boolean;
  className?: string;
  error?: string;
  name?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  showAvatar?: boolean;
  hasSearch?: boolean;
  size?: 'small' | 'medium';
}

const Select: React.FC<SelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Выберите...',
  isMulti = false,
  isDisabled = false,
  isClearable = false, 
  className = '',
  error,
  showAvatar = false,
  hasSearch = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedValues = Array.isArray(value) ? value : value ? [value] : [];

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (optionValue: string) => {
    if (isMulti) {
      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter((v) => v !== optionValue)
        : [...selectedValues, optionValue];
      onChange(newValues);
    } else {
      onChange(optionValue);
      setIsOpen(false);
    }
  };

  const handleRemove = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMulti) {
      onChange(selectedValues.filter((v) => v !== optionValue));
    }
  };

  const getLabel = () => {
    if (isMulti) {
      const selected = options.filter((o) => selectedValues.includes(o.value));
      return selected.length > 0 ? `${selected.length} выбрано` : placeholder;
    } else {
      const selected = options.find((o) => o.value === value);
      return selected ? selected.label : placeholder;
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`${styles.selectContainer} ${className}`} ref={containerRef}>
      <div
        className={`${styles.selectControl} ${isDisabled ? styles.disabled : ''} ${error ? styles.error : ''}`}
        onClick={() => !isDisabled && setIsOpen(!isOpen)}
      >
        <div className={styles.valueContainer}>
          {isMulti && (
            <div className={styles.multiValueContainer}>
              {selectedValues.map((val) => {
                const option = options.find((o) => o.value === val);
                if (!option) return null;
                return (
                  <div key={val} className={styles.multiValue}>
                    {showAvatar && option.avatar_url && (
                      <img src={option.avatar_url} alt="" className={styles.avatar} />
                    )}
                    <span>{option.label}</span>
                    <button
                      type="button"
                      className={styles.removeButton}
                      onClick={(e) => handleRemove(val, e)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {!isMulti && !selectedValues.length && (
            <span className={styles.placeholder}>{placeholder}</span>
          )}
        </div>
        <div className={styles.indicators}>
          <ChevronDown size={16} className={`${styles.chevron} ${isOpen ? styles.rotate : ''}`} />
        </div>
      </div>

      {isClearable && !isMulti && selectedValues.length > 0 && (
        <button
          type="button"
          className={styles.clearButton}
          onClick={(e) => {
            e.stopPropagation();
            onChange('');
            setSearch('');
          }}
          aria-label="Очистить"
        >
          <X size={14} />
        </button>
      )}

      {isOpen && !isDisabled && (
        <div className={styles.menu}>
          {hasSearch && (
            <div className={styles.searchContainer}>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={styles.searchInput}
                placeholder="Поиск..."
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            </div>
          )}
          <div className={styles.optionsList}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <div
                    key={option.value}
                    className={`${styles.option} ${isSelected ? styles.selected : ''}`}
                    onClick={() => handleSelect(option.value)}
                  >
                    {showAvatar && option.avatar_url && (
                      <img src={option.avatar_url} alt="" className={styles.avatar} />
                    )}
                    <span>{option.label}</span>
                    {isSelected && <div className={styles.checkmark}>✓</div>}
                  </div>
                );
              })
            ) : (
              <div className={styles.noOptions}>Не найдено</div>
            )}
          </div>
        </div>
      )}

      {error && <div className={styles.errorMessage}>{error}</div>}
    </div>
  );
};

export default Select;
