import React from 'react';
import { Link } from 'react-router-dom';
import styles from './AuthLayout.module.css';

interface AuthShellProps {
  badge: string;
  title: string;
  subtitle: string;
  showcaseLabel: string;
  showcaseTitle: string;
  showcaseDescription: string;
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
  showcaseLabel,
  showcaseTitle,
  showcaseDescription,
  showcaseItems,
  showcaseStats = [],
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

          <aside className={styles.auth__showcase}>
            <div className={styles.auth__showcaseInner}>
              <div className={styles.auth__showcaseTop}>
                <span className={styles.auth__showcaseLabel}>{showcaseLabel}</span>
                {showHomeLink ? (
                  <Link to="/" className={styles.auth__showcaseHomeLink}>
                    На главную
                  </Link>
                ) : null}
              </div>
              <h2 className={styles.auth__showcaseTitle}>{showcaseTitle}</h2>
              <p className={styles.auth__showcaseText}>{showcaseDescription}</p>

              <div className={styles.auth__featureList}>
                {showcaseItems.map((item) => (
                  <div key={item} className={styles.auth__featureItem}>
                    <span className={styles.auth__featureDot} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              {showcaseStats.length ? (
                <div className={styles.auth__stats}>
                  {showcaseStats.map((stat) => (
                    <div key={stat} className={styles.auth__stat}>
                      {stat}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default AuthShell;
