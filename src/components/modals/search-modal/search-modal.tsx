import React, { useState, useEffect } from 'react';
import { useOrganization } from '../../../contexts/OrganizationContext';
import { useUI } from '../../../contexts/UIContext';
import { formatCount } from '../../../utils/formatCount';
import styles from './search-modal.module.css';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  anchorEl?: HTMLElement | null;
}

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose, anchorEl }) => {
  const [query, setQuery] = useState('');
  const { organizations, setCurrentOrganization } = useOrganization();
  const { closeSearch } = useUI();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen || !anchorEl) return null;

  const rect = anchorEl.getBoundingClientRect();
  const position = {
    top: rect.bottom + 8,
    left: rect.right + 8,
  };

  const filteredOrgs = query
    ? organizations.filter((org) => {
        const q = query.toLowerCase();
        return (
          org.name.toLowerCase().includes(q) ||
          org.description?.toLowerCase().includes(q) ||
          org.organization_members.some((m) => m.user.full_name.toLowerCase().includes(q))
        );
      })
    : [];

  const handleOrgClick = (org: (typeof organizations)[0]) => {
    setCurrentOrganization(org);
    closeSearch();
  };

  return (
    <div
      className={styles['search-modal-backdrop']}
      onClick={onClose}
      role="button"
      tabIndex={-1}
      aria-hidden={!isOpen}
    >
      <div
        className={styles['search-modal']}
        style={{ position: 'absolute', top: `${position.top}px`, left: `${position.left}px` }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Поиск по организациям"
      >
        <h3 className={styles['search-modal__title']}>Поиск</h3>

        <input
          type="text"
          className={styles['search-modal__input']}
          placeholder="Название, участник..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          autoComplete="off"
          spellCheck={false}
        />

        {query && filteredOrgs.length > 0 && (
          <div className={styles['search-modal__results']}>
            {filteredOrgs.map((org) => (
              <div
                key={org.id}
                className={styles['search-modal__result-item']}
                onClick={() => handleOrgClick(org)}
                role="button"
                tabIndex={0}
                aria-label={`Выбрать организацию ${org.name}`}
              >
                <span className={styles['search-modal__result-name']}>{org.name}</span>
                {org.description && (
                  <span className={styles['search-modal__result-desc']}>{org.description}</span>
                )}
                <span className={styles['search-modal__result-meta']}>
                  {formatCount(org.organization_members.length, 'участник', 'участника', 'участников')}
                </span>
              </div>
            ))}
          </div>
        )}

        {query && filteredOrgs.length === 0 && (
          <div className={styles['search-modal__no-results']}>Организации не найдены</div>
        )}

        <button
          className={styles['search-modal__close']}
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>

        <div className={styles['search-modal__actions']}>
          <button
            className={`${styles['btn']} ${styles['btn-primary']}`}
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
