import React from 'react';
import { Link } from 'react-router-dom';
import styles from './AuthLayout.module.css';

interface AuthShellProps {
  badge: string;
  title: string;
  subtitle: string;
  showcaseItems: string[];
  showcaseStats?: string[];
  children: React.ReactNode;
  footer?: React.ReactNode;
  compact?: boolean;
  showHomeLink?: boolean;
}

const AuthShell: React.FC<AuthShellProps> = ({
  badge,
  title,
  subtitle,
  children,
  footer,
  compact = false,
  showHomeLink = true,
}) => {
  return (
    <div className={`${styles.auth} ${compact ? styles.authCompact : ''}`}>
      <div className={styles.auth__glow} />
      <div className={styles.auth__glowSecondary} />
      <div className={styles.auth__shell}>
        <div className={styles.auth__content}>
          <section className={styles.auth__wrapper}>
            {showHomeLink ? (
              <div className={styles.auth__mobileTop}>
                <Link to="/" className={styles.auth__mobileHomeLink}>
                  На главную
                </Link>
              </div>
            ) : null}
            <span className={styles.auth__badge}>{badge}</span>
            <h1 className={styles.auth__title}>{title}</h1>
            {subtitle ? <p className={styles.auth__subtitle}>{subtitle}</p> : null}
            {children}
            {footer}
          </section>
        </div>
      </div>
    </div>
  );
};

export default AuthShell;
