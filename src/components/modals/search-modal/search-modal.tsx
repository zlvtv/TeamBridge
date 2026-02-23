import React, { useState, useEffect } from 'react';
import Modal from '@/components/ui/modal/modal'; 
import { useOrganization } from '../../../contexts/OrganizationContext';
import { formatCount } from '../../../utils/formatCount';
import styles from './search-modal.module.css';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const { organizations, setCurrentOrganization } = useOrganization();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

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
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Поиск по организациям" showCloseButton={false}>
      <div className={styles['search-modal__content']}>
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
          <ul className={styles['search-modal__results']}>
            {filteredOrgs.map((org) => (
              <li
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
              </li>
            ))}
          </ul>
        )}

        {query && filteredOrgs.length === 0 && (
          <div className={styles['search-modal__no-results']}>Организации не найдены</div>
        )}
      </div>
    </Modal>
  );
};

export default SearchModal;
