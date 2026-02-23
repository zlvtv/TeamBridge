import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from 'react';

type ModalKey =
  | 'search'
  | 'profile'
  | 'orgInfo'
  | 'createProject'
  | 'createOrg'
  | 'createTask'
  | 'create';

type UIContextType = {
  theme: 'light' | 'dark';
  isModalOpen: (modal: ModalKey) => boolean;
  openModal: (modal: ModalKey) => void;
  closeModal: (modal: ModalKey) => void;
  closeAllModals: () => void;
  chatWidth: number;
  isBoardFullscreen: boolean;
  setChatWidth: (width: number) => void;
  toggleTheme: () => void;
  toggleFullscreen: () => void;
};

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [modals, setModals] = useState<Record<ModalKey, boolean>>({
    search: false,
    profile: false,
    orgInfo: false,
    createProject: false,
    createOrg: false,
    createTask: false,
    create: false,
  });
  const [chatWidth, setChatWidthState] = useState(400);
  const [isBoardFullscreen, setIsBoardFullscreen] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    setTheme(initialTheme);

    const html = document.documentElement;
    if (initialTheme === 'dark') {
      html.classList.add('dark');
    }
    if (savedTheme) {
      html.classList.add('manual-theme');
    }
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    html.classList.add('manual-theme');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const openModal = useCallback((modal: ModalKey) => {
    setModals((prev) => ({ ...prev, [modal]: true }));
  }, []);

  const closeModal = useCallback((modal: ModalKey) => {
    setModals((prev) => ({ ...prev, [modal]: false }));
  }, []);

  const closeAllModals = useCallback(() => {
    setModals({
      search: false,
      profile: false,
      orgInfo: false,
      createProject: false,
      createOrg: false,
      createTask: false,
    });
  }, []);

  const isModalOpen = useCallback(
    (modal: ModalKey) => modals[modal],
    [modals]
  );

  const setChatWidth = useCallback((width: number) => {
    setChatWidthState(Math.max(300, Math.min(width, 800)));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsBoardFullscreen((prev) => !prev);
  }, []);

  const value = useMemo(
    (): UIContextType => ({
      theme,
      isModalOpen,
      openModal,
      closeModal,
      closeAllModals,
      chatWidth,
      isBoardFullscreen,
      setChatWidth,
      toggleTheme,
      toggleFullscreen,
    }),
    [
      theme,
      modals,
      chatWidth,
      isBoardFullscreen,
      setChatWidth,
      toggleTheme,
      toggleFullscreen,
      isModalOpen,
    ]
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = (): UIContextType => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within UIProvider');
  }
  return context;
};
