import React, { useRef } from 'react';
import { useUI } from '../../contexts/UIContext';
import ProfileModal from '../../components/modals/profile-modal/profile-modal';
import styles from './settings-panel.module.css';

const SettingsPanel: React.FC = () => {
  const { theme, toggleTheme, isProfileOpen, openProfile, closeProfile } = useUI();

  const handleThemeClick = () => {
    toggleTheme();
  };

  const handleProfileClick = () => {
    if (isProfileOpen) {
      closeProfile();
    } else {
      openProfile();
    }
  };

  return (
    <div className={styles['settings-panel']}>
      <button
        className={styles['settings-panel__theme-btn']}
        onClick={handleThemeClick}
        aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
      >
        {theme === 'dark' ? '🔆' : '🌙'}
      </button>

      <button
        data-profile-button
        className={styles['settings-panel__avatar-btn']}
        onClick={handleProfileClick}
        aria-label="Профиль"
      >
        👤
      </button>

      {isProfileOpen && <ProfileModal />}
    </div>
  );
};

export default SettingsPanel;
