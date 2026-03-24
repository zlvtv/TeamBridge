import React, { useEffect, useMemo, useRef, useState } from 'react';
import DOMPurify from 'dompurify';
import styles from './project-chat.module.css';
import { useProject } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import CreateTaskModal from '../../components/modals/create-task-modal/create-task-modal';
import AttachmentModal from '../../components/modals/attachment-modal/attachment-modal';
import EmojiPicker from './emoji-picker';
import ProjectInfoModal from '../../components/modals/project-info-modal/project-info-modal';
import UserInfoModal from '../user-info-modal/user-info-modal';
import Modal from '../ui/modal/modal';
import Button from '../ui/button/button';
import { messageService } from '../../services/messageService';
import { isDeletedUserProfile } from '../../utils/user.utils';
import {
  canCreateTaskFromProjectChat,
  canCreateThreadFromMessage,
  canDeleteProjectMessage,
} from '../../utils/permissions';

type MessageType = 'text' | 'poll' | 'photo' | 'system';

type Message = {
  id: string;
  project_id: string;
  sender_id: string;
  text?: string;
  type?: MessageType;
  created_at?: { seconds: number } | string | Date;
  created_at_client?: string;
  sender_profile?: any;
  parent_id?: string | null;
  replies_count?: number;
  temp?: boolean;
  read_by?: string[];
  photo_url?: string;
  poll?: {
    question?: string;
    multiple?: boolean;
    expiresAt?: number | null;
    options?: Array<{ text: string; votes: string[] } | string>;
  };
};

const MAX_MESSAGE_LENGTH = 4000;
const SCHEDULED_MESSAGES_KEY_PREFIX = 'scheduled_project_messages_';
const LAST_SEEN_MESSAGE_KEY_PREFIX = 'last_seen_project_message_';

type ScheduledMessagePayload = {
  id: string;
  projectId: string;
  senderId: string;
  text: string;
  parentId?: string | null;
  sendAt: number;
};

const toLocalDateTimeInputValue = (date: Date): string => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const parseDateTimeLocal = (value: string): number => {
  if (!value) return NaN;
  const [datePart, timePart] = value.split('T');
  if (!datePart || !timePart) return NaN;
  const [yy, mm, dd] = datePart.split('-').map(Number);
  const [hh, min] = timePart.split(':').map(Number);
  if ([yy, mm, dd, hh, min].some(Number.isNaN)) return NaN;
  return new Date(yy, mm - 1, dd, hh, min, 0, 0).getTime();
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> => {
  let timeoutId: number | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
};

const ProjectChat: React.FC = () => {
  const { currentProject, markProjectAsRead } = useProject();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  const [messages, setMessages] = useState<Message[]>([]);
  const [threadMessages, setThreadMessages] = useState<Record<string, Message[]>>({});
  const [newMessage, setNewMessage] = useState('');
  const messageStateRef = useRef<Record<string, string>>({});
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const shouldAutoScrollRef = useRef(true);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [showThread, setShowThread] = useState(false);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isDeleteChoiceOpen, setIsDeleteChoiceOpen] = useState(false);
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [isProjectInfoModalOpen, setIsProjectInfoModalOpen] = useState(false);

  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollMultiple, setPollMultiple] = useState(false);
  const [pollExpiresAt, setPollExpiresAt] = useState('');

  const [pendingPhotoUpload, setPendingPhotoUpload] = useState(false);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [pendingPhotoPreviewUrl, setPendingPhotoPreviewUrl] = useState<string | null>(null);
  const [photoCaptionDraft, setPhotoCaptionDraft] = useState('');
  const [isPhotoComposerOpen, setIsPhotoComposerOpen] = useState(false);
  const [pendingPollCreate, setPendingPollCreate] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState<number | null>(null);

  const [attachmentModalPosition, setAttachmentModalPosition] = useState({ bottom: 0, left: 0 });
  const [emojiPickerPosition, setEmojiPickerPosition] = useState({ bottom: 0, left: 0 });
  const [scheduleModalPosition, setScheduleModalPosition] = useState({ bottom: 0, left: 0 });

  const [hiddenMessageIds, setHiddenMessageIds] = useState<Set<string>>(new Set());
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [contextMenu, setContextMenu] = useState<{ show: boolean; x: number; y: number }>({
    show: false,
    x: 0,
    y: 0,
  });

  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [selectedPhotoCaption, setSelectedPhotoCaption] = useState<string>('');
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const initialPositionResolvedRef = useRef(false);
  const scheduleProcessingRef = useRef(false);
  const scheduledQueueTimerRef = useRef<number | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachmentButtonRef = useRef<HTMLButtonElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const touchStartPointRef = useRef<{ x: number; y: number } | null>(null);

  const closeContextMenu = () => setContextMenu({ show: false, x: 0, y: 0 });

  const closePhotoComposer = () => {
    if (pendingPhotoPreviewUrl) {
      URL.revokeObjectURL(pendingPhotoPreviewUrl);
    }
    setPendingPhotoFile(null);
    setPendingPhotoPreviewUrl(null);
    setPhotoCaptionDraft('');
    setIsPhotoComposerOpen(false);
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  };

  const getScheduledQueueStorageKey = (userId?: string) =>
    userId ? `${SCHEDULED_MESSAGES_KEY_PREFIX}${userId}` : '';

  const readScheduledQueue = (userId?: string): ScheduledMessagePayload[] => {
    const storageKey = getScheduledQueueStorageKey(userId);
    if (!storageKey) return [];

    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeScheduledQueue = (userId: string, queue: ScheduledMessagePayload[]) => {
    const storageKey = getScheduledQueueStorageKey(userId);
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(queue));
  };

  const clearScheduledQueueTimer = () => {
    if (scheduledQueueTimerRef.current) {
      window.clearTimeout(scheduledQueueTimerRef.current);
      scheduledQueueTimerRef.current = null;
    }
  };

  const scheduleNextQueuedMessageCheck = (userId?: string) => {
    clearScheduledQueueTimer();
    const queue = readScheduledQueue(userId);
    if (!queue.length) return;

    const nextSendAt = queue.reduce((min, item) => {
      const value = Number(item.sendAt) || 0;
      if (!min) return value;
      return value < min ? value : min;
    }, 0);

    if (!nextSendAt) return;

    const delay = Math.max(250, nextSendAt - Date.now());
    scheduledQueueTimerRef.current = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('teambridge:scheduled-message-check'));
    }, delay);
  };

  const getLastSeenStorageKey = (projectId?: string) =>
    projectId ? `${LAST_SEEN_MESSAGE_KEY_PREFIX}${projectId}` : '';

  const persistLastSeenMessage = () => {
    if (!currentProject?.id) return;

    const container = messagesContainerRef.current;
    if (!container) return;

    const storageKey = getLastSeenStorageKey(currentProject.id);
    const distanceToBottom = container.scrollHeight - (container.scrollTop + container.clientHeight);
    if (distanceToBottom < 56) {
      localStorage.setItem(storageKey, '__BOTTOM__');
      return;
    }

    const nodes = Array.from(
      container.querySelectorAll<HTMLElement>('[id^="project-chat-message-"]')
    );

    const viewportBottom = container.scrollTop + container.clientHeight - 28;
    const visibleFromBottom = [...nodes].reverse().find((node) => node.offsetTop < viewportBottom);
    const messageId = visibleFromBottom?.id.replace('project-chat-message-', '');

    if (messageId) {
      localStorage.setItem(storageKey, messageId);
    }
  };

  const persistHiddenMessages = (ids: Set<string>) => {
    if (!currentProject?.id) return;
    localStorage.setItem(`hidden_messages_${currentProject.id}`, JSON.stringify([...ids]));
  };

  const hideMessageForMe = (messageId: string) => {
    setHiddenMessageIds(prev => {
      const next = new Set(prev);
      next.add(messageId);
      persistHiddenMessages(next);
      return next;
    });
  };

  const getOrgMember = (userId?: string) => {
    if (!userId || !currentOrganization) return null;
    return currentOrganization.organization_members.find(m => m.user_id === userId) || null;
  };

  const getRoleNames = () => {
    const rolesRaw = (currentOrganization as any)?.roles;
    if (!Array.isArray(rolesRaw)) return [] as string[];
    return rolesRaw
      .map((role: any) => {
        if (typeof role === 'string') return role;
        return role?.name || '';
      })
      .map((name: string) => name.trim())
      .filter(Boolean);
  };

  const resolveSender = (msg: Message) => {
    if (msg.sender_id === user?.id) return user;
    return (
      msg.sender_profile ||
      getOrgMember(msg.sender_id)?.user ||
      { full_name: 'Пользователь', username: 'Пользователь' }
    );
  };

  const getSenderAvatarFallback = (sender: any, senderName: string) => {
    if (isDeletedUserProfile(sender)) {
      return 'У';
    }
    return senderName.charAt(0).toUpperCase();
  };

  const canManageTasks = () => {
    return canCreateTaskFromProjectChat(currentProject, currentOrganization, user?.id);
  };

  const canDeleteMessage = (message: Message | null) => {
    return canDeleteProjectMessage(
      message
        ? {
            senderId: message.sender_id,
            type: message.type,
          }
        : null,
      currentProject,
      currentOrganization,
      user?.id
    );
  };

  const canCreateThreadForMessage = (message: Message | null) => {
    return canCreateThreadFromMessage(
      message
        ? {
            senderId: message.sender_id,
            type: message.type,
          }
        : null
    );
  };

  const formatTime = (value: any) => {
    try {
      let date: Date;
      if (value && typeof value === 'object' && 'seconds' in value) {
        date = new Date(value.seconds * 1000);
      } else if (value?.toDate) {
        date = value.toDate();
      } else {
        date = new Date(value);
      }
      if (Number.isNaN(date.getTime())) return '';
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const renderContent = (content: string) => {
    const limited = (content || '').slice(0, MAX_MESSAGE_LENGTH);
    try {
      const sanitized = DOMPurify.sanitize(limited, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'a'],
        ADD_ATTR: ['target', 'rel', 'href'],
      });
      const root = document.createElement('div');
      root.innerHTML = sanitized;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      const textNodes: Text[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) {
        textNodes.push(node as Text);
      }

      const tokenRegex = /(https?:\/\/[^\s]+|@[a-zA-Z0-9_а-яА-ЯёЁ:-]+)/g;
      textNodes.forEach((textNode) => {
        const raw = textNode.textContent || '';
        tokenRegex.lastIndex = 0;
        if (!tokenRegex.test(raw)) return;
        tokenRegex.lastIndex = 0;

        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        raw.replace(tokenRegex, (match, _group, index) => {
          if (index > lastIndex) {
            fragment.appendChild(document.createTextNode(raw.slice(lastIndex, index)));
          }

          if (match.startsWith('http')) {
            const link = document.createElement('a');
            link.href = match;
            link.textContent = match;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = styles['project-chat__message-text'];
            fragment.appendChild(link);
          } else if (match.startsWith('@')) {
            const token = match.slice(1).toLowerCase();
            if (token === 'all') {
              const span = document.createElement('span');
              span.className = styles['project-chat__mention-tag'];
              span.textContent = match;
              fragment.appendChild(span);
            } else if (organizationUsernames.has(token)) {
              const mention = document.createElement('a');
              mention.href = '#';
              mention.dataset.mention = token;
              mention.className = styles['project-chat__mention-tag'];
              mention.textContent = match;
              fragment.appendChild(mention);
            } else {
              const span = document.createElement('span');
              span.className = styles['project-chat__mention-tag'];
              span.textContent = match;
              fragment.appendChild(span);
            }
          }
          lastIndex = index + match.length;
          return match;
        });

        if (lastIndex < raw.length) {
          fragment.appendChild(document.createTextNode(raw.slice(lastIndex)));
        }

        if (textNode.parentNode) {
          textNode.parentNode.replaceChild(fragment, textNode);
        }
      });

      return { __html: root.innerHTML };
    } catch {
      return { __html: DOMPurify.sanitize(limited) };
    }
  };

  const normalizedParticipantIds = useMemo(() => {
    const ids = (currentProject?.members || []).map(m => m.user_id).filter(Boolean);
    return Array.from(new Set(ids));
  }, [currentProject?.members]);

  const organizationUsernames = useMemo(() => {
    return new Set(
      (currentOrganization?.organization_members || [])
        .map(member => (member.user?.username || '').toLowerCase())
        .filter(Boolean)
    );
  }, [currentOrganization?.id, currentOrganization?.organization_members]);

  const isMessageReadByAll = (msg: Message) => {
    if (!msg.sender_id) return false;
    if (normalizedParticipantIds.length <= 1) return false;
    const required = normalizedParticipantIds.filter(id => id !== msg.sender_id);
    if (required.length === 0) return false;
    const readBy = new Set(msg.read_by || []);
    return required.every(id => readBy.has(id));
  };

  const mentionSuggestions = useMemo(() => {
    const q = mentionQuery.trim().toLowerCase();
    const currentUsername = (user?.username || '').toLowerCase();
    const users = (currentOrganization?.organization_members || [])
      .map(member => member.user?.username)
      .filter(Boolean)
      .filter((username) => String(username).toLowerCase() !== currentUsername)
      .map(username => `@${username}`);
    const statuses = ['@owner', '@admin', '@member'];
    const roles = getRoleNames().map(role => `@${role}`);
    const base = Array.from(new Set(['@all', ...users, ...statuses, ...roles]));
    if (!q) return base.slice(0, 12);
    return base.filter(item => item.toLowerCase().includes(q)).slice(0, 12);
  }, [mentionQuery, currentOrganization?.id, currentOrganization?.organization_members, user?.username]);

  useEffect(() => {
    if (!currentProject?.id) return;
    seenMessageIdsRef.current.clear();
    initialPositionResolvedRef.current = false;
    shouldAutoScrollRef.current = true;
    const saved = messageStateRef.current[currentProject.id] || '';
    setNewMessage(saved);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }

    return () => {
      persistLastSeenMessage();
    };
  }, [currentProject?.id]);

  useEffect(() => {
    if (!currentProject?.id) return;
    try {
      const raw = localStorage.getItem(`hidden_messages_${currentProject.id}`);
      const parsed = raw ? JSON.parse(raw) : [];
      setHiddenMessageIds(new Set(Array.isArray(parsed) ? parsed : []));
    } catch {
      setHiddenMessageIds(new Set());
    }
  }, [currentProject?.id]);

  useEffect(() => {
    if (currentProject?.id) markProjectAsRead(currentProject.id);
  }, [currentProject?.id, markProjectAsRead]);

  useEffect(() => {
    if (!currentProject?.id) return;

    const syncReadNow = () => {
      if (document.visibilityState !== 'visible') return;
      messageService.markProjectAsRead(currentProject.id);
      markProjectAsRead(currentProject.id);
    };

    syncReadNow();
    window.addEventListener('focus', syncReadNow);
    document.addEventListener('visibilitychange', syncReadNow);
    return () => {
      window.removeEventListener('focus', syncReadNow);
      document.removeEventListener('visibilitychange', syncReadNow);
    };
  }, [currentProject?.id, markProjectAsRead]);

  useEffect(() => {
    if (!currentProject?.id || !user?.id || messages.length === 0) return;
    const timer = setTimeout(() => {
      messageService.markProjectMessagesAsRead(currentProject.id, user.id).catch(() => undefined);
    }, 120);
    return () => clearTimeout(timer);
  }, [currentProject?.id, user?.id, messages]);

  useEffect(() => {
    if (!currentProject?.id || !user?.id || messages.length === 0) return;
    if (document.visibilityState !== 'visible') return;

    const hasUnreadIncoming = messages.some((msg) => {
      if (msg.sender_id === user.id) return false;
      const readBy = new Set(msg.read_by || []);
      return !readBy.has(user.id);
    });
    if (!hasUnreadIncoming) return;

    messageService.markProjectAsRead(currentProject.id);
    markProjectAsRead(currentProject.id);
  }, [messages, currentProject?.id, user?.id, markProjectAsRead]);

  useEffect(() => {
    if (!user?.id || !messages.length) return;
    if (seenMessageIdsRef.current.size === 0) {
      messages.forEach(msg => {
        if (msg.id) seenMessageIdsRef.current.add(msg.id);
      });
    }
  }, [messages, user?.id]);

  useEffect(() => {
    if (!currentProject?.id || !messages.length) return;
    const focusMessageId = localStorage.getItem('focusMessageId');
    const focusMessageProjectId = localStorage.getItem('focusMessageProjectId');
    if (!focusMessageId || focusMessageProjectId !== currentProject.id) return;

    const exists = messages.some(message => message.id === focusMessageId);
    if (!exists) return;

    requestAnimationFrame(() => {
      const node = document.getElementById(`project-chat-message-${focusMessageId}`);
      if (!node) return;
      initialPositionResolvedRef.current = true;
      shouldAutoScrollRef.current = false;
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFocusedMessageId(focusMessageId);
      window.setTimeout(() => setFocusedMessageId(null), 2200);
      localStorage.removeItem('focusMessageId');
      localStorage.removeItem('focusMessageProjectId');
    });
  }, [currentProject?.id, messages]);

  useEffect(() => {
    if (!messages.length) return;
    if (initialPositionResolvedRef.current) return;

    const container = messagesContainerRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      const liveContainer = messagesContainerRef.current;
      if (!liveContainer || initialPositionResolvedRef.current) return;
      const storageKey = getLastSeenStorageKey(currentProject?.id);
      const savedAnchor = storageKey ? localStorage.getItem(storageKey) : null;

      if (savedAnchor && savedAnchor !== '__BOTTOM__') {
        const anchorNode = document.getElementById(`project-chat-message-${savedAnchor}`) as HTMLElement | null;
        if (anchorNode) {
          const targetTop = anchorNode.offsetTop + anchorNode.offsetHeight - liveContainer.clientHeight + 28;
          liveContainer.scrollTop = Math.max(0, targetTop);
        } else {
          liveContainer.scrollTop = liveContainer.scrollHeight;
        }
      } else {
        liveContainer.scrollTop = liveContainer.scrollHeight;
      }
      initialPositionResolvedRef.current = true;
      shouldAutoScrollRef.current = !savedAnchor || savedAnchor === '__BOTTOM__';
    });
  }, [messages, currentProject?.id]);

  useEffect(() => {
    if (!currentProject?.id) return;
    setIsLoading(true);
    setError(null);

    const unsubscribe = messageService.subscribeToMessages(currentProject.id, (fetchedMessages) => {
      const threadMap: Record<string, Message[]> = {};
      fetchedMessages.forEach((msg) => {
        if (msg.parent_id) {
          if (!threadMap[msg.parent_id]) threadMap[msg.parent_id] = [];
          threadMap[msg.parent_id].push(msg as Message);
        }
      });

      setThreadMessages(threadMap);
      setMessages(fetchedMessages as Message[]);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentProject?.id]);

  useEffect(() => {
    const handleClick = () => closeContextMenu();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    if (!messagesContainerRef.current) return;
    if (!initialPositionResolvedRef.current) return;
    if (shouldAutoScrollRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!user?.id) return;
    let isCancelled = false;

    const processQueue = async () => {
      if (scheduleProcessingRef.current) return;
      scheduleProcessingRef.current = true;
      try {
        const queue = readScheduledQueue(user.id);
        if (!queue.length) return;

        const now = Date.now();
        const due = queue.filter(item => Number(item.sendAt) <= now);
        const rest = queue.filter(item => Number(item.sendAt) > now);
        if (due.length === 0) {
          scheduleNextQueuedMessageCheck(user.id);
          return;
        }

        for (const item of due) {
          if (isCancelled) return;
          if (!item.projectId || !item.senderId || !item.text?.trim()) continue;
          try {
            await messageService.sendMessage(
              item.projectId,
              item.text,
              item.senderId,
              'text',
              undefined,
              undefined,
              item.parentId || undefined
            );
          } catch {
            rest.push(item);
          }
        }
        writeScheduledQueue(user.id, rest);
        scheduleNextQueuedMessageCheck(user.id);
      } catch {
      } finally {
        scheduleProcessingRef.current = false;
      }
    };

    processQueue();
    const intervalId = window.setInterval(processQueue, 15000);
    const onFocus = () => {
      processQueue();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') processQueue();
    };
    const onScheduledCheck = () => {
      processQueue();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('teambridge:scheduled-message-check', onScheduledCheck);
    return () => {
      isCancelled = true;
      clearScheduledQueueTimer();
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('teambridge:scheduled-message-check', onScheduledCheck);
    };
  }, [user?.id]);

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceToBottom = container.scrollHeight - (container.scrollTop + container.clientHeight);
    shouldAutoScrollRef.current = distanceToBottom < 56;
    persistLastSeenMessage();
  };

  const openContextMenu = (e: React.MouseEvent, message: Message) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenuAt(e.clientX, e.clientY, message);
  };

  const openContextMenuAt = (clientX: number, clientY: number, message: Message) => {
    const menuWidth = 220;
    const menuHeight = 210;
    const margin = 8;

    const x = Math.max(margin, Math.min(clientX, window.innerWidth - menuWidth - margin));
    const y = Math.max(margin, Math.min(clientY, window.innerHeight - menuHeight - margin));

    setSelectedMessage(message);
    setContextMenu({ show: true, x, y });
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleMessageTouchStart = (e: React.TouchEvent, message: Message) => {
    if (e.touches.length !== 1) return;
    clearLongPress();
    const touch = e.touches[0];
    touchStartPointRef.current = { x: touch.clientX, y: touch.clientY };
    longPressTimerRef.current = window.setTimeout(() => {
      openContextMenuAt(touch.clientX, touch.clientY, message);
    }, 450);
  };

  const handleMessageTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPointRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPointRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPointRef.current.y);
    if (deltaX > 10 || deltaY > 10) {
      clearLongPress();
    }
  };

  const handleMessageTouchEnd = () => {
    clearLongPress();
    touchStartPointRef.current = null;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentProject || !user) return;
    if (newMessage.length > MAX_MESSAGE_LENGTH) {
      setError(`Сообщение не может быть длиннее ${MAX_MESSAGE_LENGTH} символов`);
      return;
    }

    setError(null);
    const rawText = newMessage.trim();
    const myUsername = (user.username || '').trim();
    if (myUsername) {
      const escaped = myUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const selfMentionRegex = new RegExp(`(^|\\s)@${escaped}(?=\\b)`, 'iu');
      if (selfMentionRegex.test(rawText)) {
        setError('Нельзя тегать саму себя');
        return;
      }
    }

    if (scheduledAt) {
      const sendAt = parseDateTimeLocal(scheduledAt);
      if (Number.isNaN(sendAt) || sendAt <= Date.now()) {
        setError('Укажите корректное время в будущем для отложенной отправки');
        return;
      }

      const queue = readScheduledQueue(user.id);
      queue.push({
        id: `scheduled_${Date.now()}`,
        projectId: currentProject.id,
        senderId: user.id,
        text: rawText,
        parentId: showThread ? activeThreadId : undefined,
        sendAt,
      });
      writeScheduledQueue(user.id, queue);
      scheduleNextQueuedMessageCheck(user.id);
      messageStateRef.current[currentProject.id] = '';
      setNewMessage('');
      setScheduledAt('');
      setIsScheduleModalOpen(false);
      setShowMentionSuggestions(false);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      return;
    }

    const tempMessageId = `temp_${Date.now()}`;
    const tempMessage: Message = {
      id: tempMessageId,
      text: rawText,
      sender_id: user.id,
      project_id: currentProject.id,
      created_at: new Date().toISOString(),
      created_at_client: new Date().toISOString(),
      parent_id: showThread ? activeThreadId : undefined,
      temp: true,
    };

    setMessages(prev => [...prev, tempMessage]);
    shouldAutoScrollRef.current = true;
    messageStateRef.current[currentProject.id] = '';
    setNewMessage('');
    setShowMentionSuggestions(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    try {
      await messageService.sendMessage(
        currentProject.id,
        rawText,
        user.id,
        'text',
        undefined,
        undefined,
        showThread ? activeThreadId : undefined
      );
    } catch {
      setMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
      setError('Ошибка отправки сообщения');
    }
  };

  const handleDeleteForAll = async () => {
    const messageId = selectedMessage?.id;
    if (!messageId) return;
    setIsDeleteChoiceOpen(false);
    closeContextMenu();
    setMessages(prev => prev.filter(msg => msg.id !== messageId));
    try {
      await messageService.deleteMessage(messageId);
    } catch {
      setError('Не удалось удалить сообщение для всех');
    }
  };

  const handleDeleteForMe = () => {
    if (selectedMessage?.id) hideMessageForMe(selectedMessage.id);
    setIsDeleteChoiceOpen(false);
    closeContextMenu();
  };

  const handleAttachmentClick = () => {
    if (!attachmentButtonRef.current) {
      setIsAttachmentModalOpen(prev => !prev);
      return;
    }
    const rect = attachmentButtonRef.current.getBoundingClientRect();
    setAttachmentModalPosition({
      bottom: window.innerHeight - rect.top + 16,
      left: rect.left + rect.width / 2,
    });
    setIsAttachmentModalOpen(prev => !prev);
  };

  const handleEmojiClick = () => {
    if (!attachmentButtonRef.current) {
      setIsEmojiPickerOpen(prev => !prev);
      return;
    }
    const rect = attachmentButtonRef.current.getBoundingClientRect();
    setEmojiPickerPosition({
      bottom: window.innerHeight - rect.top + 16,
      left: rect.left + rect.width / 2,
    });
    setIsEmojiPickerOpen(prev => !prev);
  };

  const handleAttachmentOptionClick = (type: 'photo' | 'poll' | 'task') => {
    if (type === 'photo') {
      setIsAttachmentModalOpen(false);
      if (photoInputRef.current) {
        photoInputRef.current.value = '';
        photoInputRef.current.click();
      }
      return;
    }
    if (type === 'poll') {
      setIsAttachmentModalOpen(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      setPollMultiple(false);
      setPollExpiresAt('');
      setIsPollModalOpen(true);
      return;
    }
    if (type === 'task' && canManageTasks()) {
      setSelectedMessage(null);
      setIsTaskModalOpen(true);
      setIsAttachmentModalOpen(false);
    }
  };

  const openUserInfo = (_e: React.MouseEvent, msg: Message) => {
    const sender = resolveSender(msg);
    if (isDeletedUserProfile(sender)) return;
    setSelectedUser({
      id: sender?.id || msg.sender_id,
      full_name: sender?.full_name || sender?.username || 'Пользователь',
      username: sender?.username,
      email: sender?.email || '',
      avatar_url: sender?.avatar_url || null,
      description: sender?.description || '',
      roles: getOrgMember(msg.sender_id)?.roles || [],
    });
  };

  const openUserInfoByUsername = (username: string) => {
    if (!username || !currentOrganization) return;
    const member = currentOrganization.organization_members.find(
      item => (item.user?.username || '').toLowerCase() === username.toLowerCase()
    );
    if (!member) return;
    const sender = member.user;
    if (isDeletedUserProfile(sender)) return;
    setSelectedUser({
      id: sender?.id || member.user_id,
      full_name: sender?.full_name || sender?.username || 'Пользователь',
      username: sender?.username,
      email: sender?.email || '',
      avatar_url: sender?.avatar_url || null,
      description: sender?.description || '',
      roles: member.roles || [],
    });
  };

  const handleMessageBodyClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const mention = target.closest('a[data-mention]') as HTMLAnchorElement | null;
    if (!mention) return;
    e.preventDefault();
    const username = mention.dataset.mention || '';
    if (username === 'all') return;
    openUserInfoByUsername(username);
  };

  const applyMentionSuggestion = (mention: string) => {
    if (mentionStart === null) return;
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? newMessage.length;
    const before = newMessage.slice(0, mentionStart);
    const after = newMessage.slice(cursor);
    const next = `${before}${mention} ${after}`.slice(0, MAX_MESSAGE_LENGTH);
    setNewMessage(next);
    if (currentProject?.id) messageStateRef.current[currentProject.id] = next;
    setShowMentionSuggestions(false);
    setMentionQuery('');
    setMentionStart(null);
    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      const caret = (before + `${mention} `).length;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(caret, caret);
    });
  };

  const handlePhotoSelected = async (file: File | null) => {
    if (!file || !currentProject || !user) return;
    if (!file.type.startsWith('image/')) {
      setError('Можно загружать только изображения');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Максимальный размер изображения 10MB');
      return;
    }

    setError(null);
    const localPreviewUrl = URL.createObjectURL(file);
    setPendingPhotoFile(file);
    setPendingPhotoPreviewUrl(localPreviewUrl);
    setPhotoCaptionDraft(newMessage.trim());
    setIsPhotoComposerOpen(true);
  };

  const handlePhotoUploadSubmit = async () => {
    if (!pendingPhotoFile || !pendingPhotoPreviewUrl || !currentProject || !user) return;

    const file = pendingPhotoFile;
    const localPreviewUrl = pendingPhotoPreviewUrl;
    const captionText = photoCaptionDraft.trim();
    const tempMessageId = `temp_photo_${Date.now()}`;
    const tempPhotoMessage: Message = {
      id: tempMessageId,
      text: captionText || 'Фото',
      sender_id: user.id,
      project_id: currentProject.id,
      created_at: new Date().toISOString(),
      created_at_client: new Date().toISOString(),
      parent_id: showThread ? activeThreadId : undefined,
      temp: true,
      type: 'photo',
      photo_url: localPreviewUrl,
    };
    setMessages(prev => [...prev, tempPhotoMessage]);
    shouldAutoScrollRef.current = true;
    messageStateRef.current[currentProject.id] = '';
    setNewMessage('');
    setPhotoCaptionDraft('');
    setShowMentionSuggestions(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    setPendingPhotoUpload(true);
    try {
      const photoUrl = await withTimeout(
        messageService.uploadPhoto(currentProject.id, user.id, file),
        5000,
        'Истекло время ожидания загрузки изображения'
      );
      await withTimeout(
        messageService.sendMessage(
          currentProject.id,
          captionText || 'Фото',
          user.id,
          'photo',
          photoUrl,
          undefined,
          showThread ? activeThreadId : undefined
        ),
        10000,
        'Истекло время ожидания отправки изображения'
      );
      setMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
      setIsPhotoComposerOpen(false);
      setPendingPhotoFile(null);
      setPendingPhotoPreviewUrl(null);
    } catch {
      try {
        const fallbackPhotoUrl = await withTimeout(new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const base = String(reader.result || '');
            const img = new Image();
            img.onload = () => {
              const maxSide = 1280;
              const ratio = Math.min(1, maxSide / Math.max(img.width, img.height));
              const w = Math.max(1, Math.floor(img.width * ratio));
              const h = Math.max(1, Math.floor(img.height * ratio));
              const canvas = document.createElement('canvas');
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                resolve(base);
                return;
              }
              ctx.drawImage(img, 0, 0, w, h);
              const compressed = canvas.toDataURL('image/jpeg', 0.78);
              resolve(compressed || base);
            };
            img.onerror = () => resolve(base);
            img.src = base;
          };
          reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
          reader.readAsDataURL(file);
        }), 8000, 'Истекло время ожидания подготовки изображения');
        await withTimeout(
          messageService.sendMessage(
            currentProject.id,
            captionText || 'Фото',
            user.id,
            'photo',
            fallbackPhotoUrl,
            undefined,
            showThread ? activeThreadId : undefined
          ),
          10000,
          'Истекло время ожидания отправки изображения'
        );
        setMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
        setIsPhotoComposerOpen(false);
        setPendingPhotoFile(null);
        setPendingPhotoPreviewUrl(null);
      } catch {
        setMessages(prev => prev.filter(msg => msg.id !== tempMessageId));
        setError('Ошибка загрузки изображения');
      }
    } finally {
      setPendingPhotoUpload(false);
      URL.revokeObjectURL(localPreviewUrl);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const submitPoll = async () => {
    if (!currentProject || !user) return;
    const question = pollQuestion.trim();
    const options = pollOptions.map(o => o.trim()).filter(Boolean);
    if (!question || options.length < 2) {
      setError('Укажите вопрос и минимум 2 варианта ответа');
      return;
    }

    let expiresAt: number | null = null;
    if (pollExpiresAt) {
      const parsed = new Date(pollExpiresAt).getTime();
      if (!Number.isNaN(parsed)) expiresAt = parsed;
      if (expiresAt && expiresAt <= Date.now()) {
        setError('Время завершения опроса должно быть в будущем');
        return;
      }
    }

    setPendingPollCreate(true);
    setError(null);
    try {
      await messageService.sendMessage(
        currentProject.id,
        question,
        user.id,
        'poll',
        undefined,
        { question, options, multiple: pollMultiple, expiresAt },
        showThread ? activeThreadId : undefined
      );
      setIsPollModalOpen(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      setPollMultiple(false);
      setPollExpiresAt('');
    } catch {
      setError('Не удалось создать опрос');
    } finally {
      setPendingPollCreate(false);
    }
  };

  const visibleMessages = messages.filter(msg => !hiddenMessageIds.has(msg.id));
  const displayMessages = visibleMessages.filter(msg => !msg.parent_id);
  const activeThreadMessages = activeThreadId
    ? (threadMessages[activeThreadId] || []).filter(msg => !hiddenMessageIds.has(msg.id))
    : [];
  const activeThreadRootMessage = activeThreadId
    ? displayMessages.find(m => m.id === activeThreadId) || null
    : null;
  if (!currentProject) {
    return (
      <div className={styles['project-chat']}>
        <div className={styles['project-chat__placeholder']}>Выберите проект</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles['project-chat']}>
        <div className={styles['project-chat__loading']}>Загрузка сообщений...</div>
      </div>
    );
  }

  return (
    <div className={styles['project-chat']}>
      {currentProject.hasUnreadMessages && (
        <div className={styles['project-chat__unread-indicator']}>Есть новые сообщения</div>
      )}

      <div className={styles['project-chat__top-banner']}>
        <div className={styles['project-chat__banner-title']}>{currentProject.name}</div>
        <div className={styles['project-chat__banner-buttons']}>
          <Button variant="secondary" size="small" onClick={() => setIsProjectInfoModalOpen(true)} className={styles['project-chat__banner-button']}>
            О проекте
          </Button>
        </div>
      </div>

      <div className={styles['project-chat__messages-container']} ref={messagesContainerRef} onScroll={handleMessagesScroll}>
        {displayMessages.length === 0 ? (
          <div className={styles['project-chat__placeholder']}>Нет сообщений. Начните общение!</div>
        ) : (
          displayMessages.map((msg) => {
            const isMyMessage = msg.sender_id === user?.id;
            const isSystemMessage = msg.sender_id === 'system' || msg.type === 'system';
            const sender = resolveSender(msg);
            const senderName = sender?.full_name || sender?.username || sender?.email || 'Пользователь';
            const repliesCount = threadMessages[msg.id]?.length || 0;

            const pollOptionsNormalized = Array.isArray(msg.poll?.options)
              ? msg.poll.options.map(option => {
                  if (typeof option === 'string') return { text: option, votes: [] as string[] };
                  return { text: option.text, votes: Array.isArray(option.votes) ? option.votes : [] };
                })
              : [];
            const isPollExpired = !!msg.poll?.expiresAt && Number(msg.poll.expiresAt) <= Date.now();

            return (
              <div
                key={msg.id}
                id={`project-chat-message-${msg.id}`}
                className={`${styles['project-chat__message-row']} ${isMyMessage ? styles['project-chat__message-row--mine'] : ''} ${isSystemMessage ? styles['project-chat__message-row--system'] : ''}`}
                onContextMenu={(e) => openContextMenu(e, msg)}
                onTouchStart={(e) => handleMessageTouchStart(e, msg)}
                onTouchMove={handleMessageTouchMove}
                onTouchEnd={handleMessageTouchEnd}
                onTouchCancel={handleMessageTouchEnd}
                title="Правый клик — управление сообщением"
              >
                <div
                  className={`${styles['project-chat__message']} ${isMyMessage ? styles['project-chat__message--mine'] : ''} ${isSystemMessage ? styles['project-chat__message--system'] : ''} ${msg.type === 'poll' ? styles['project-chat__message--poll'] : ''} ${focusedMessageId === msg.id ? styles['project-chat__message--focused'] : ''}`}
                >
                  {isSystemMessage ? (
                    <div className={styles['project-chat__system-message']}>
                      <div className={styles['project-chat__system-message-text']} dangerouslySetInnerHTML={renderContent(msg.text || '')} />
                    </div>
                  ) : (
                    <>
                      <button className={styles['project-chat__avatar-button']} onClick={(e) => openUserInfo(e, msg)}>
                        <div className={styles['project-chat__avatar']} title={senderName}>
                          {sender?.avatar_url ? <img src={sender.avatar_url} alt="" /> : <span>{getSenderAvatarFallback(sender, senderName)}</span>}
                        </div>
                      </button>

                      <div className={styles['project-chat__message-content']}>
                        <div className={styles['project-chat__message-sender']}>{senderName}</div>

                        {msg.type === 'photo' && msg.photo_url ? (
                          <div className={styles['project-chat__photo-message']}>
                            <button
                              type="button"
                              className={styles['project-chat__photo-open']}
                              onClick={() => {
                                setSelectedPhotoUrl(msg.photo_url || null);
                                setSelectedPhotoCaption(msg.text || '');
                              }}
                            >
                              <img src={msg.photo_url} alt={msg.text || 'Фото'} />
                            </button>
                            {msg.text && msg.text !== 'Фото' && (
                              <div className={styles['project-chat__photo-caption']}>{msg.text}</div>
                            )}
                          </div>
                        ) : msg.type === 'poll' ? (
                          <div className={styles['project-chat__poll-message']}>
                            <div className={styles['project-chat__poll-question']}>
                              {msg.poll?.question || msg.text || 'Опрос'}
                            </div>
                            <div className={styles['project-chat__poll-options']}>
                              {pollOptionsNormalized.map((option, optionIndex) => {
                                const hasVoted = option.votes.includes(user?.id || '');
                                return (
                                  <button
                                    type="button"
                                    key={`${msg.id}_${optionIndex}`}
                                    className={`${styles['project-chat__poll-option']} ${hasVoted ? styles['project-chat__poll-option--selected'] : ''}`}
                                    disabled={isPollExpired}
                                    onClick={() => {
                                      if (isPollExpired || !user?.id) return;
                                      shouldAutoScrollRef.current = false;
                                      messageService.voteInPoll(msg.id, user.id, optionIndex).catch(() => {
                                        setError('Не удалось отправить голос');
                                      });
                                    }}
                                  >
                                    <span className={styles['project-chat__poll-option-text']}>{option.text}</span>
                                    <span className={styles['project-chat__poll-option-votes']}>{option.votes.length}</span>
                                  </button>
                                );
                              })}
                            </div>
                            {msg.poll?.expiresAt && (
                              <div className={styles['project-chat__poll-expired']}>
                                {isPollExpired
                                  ? 'Голосование завершено'
                                  : `До: ${new Date(Number(msg.poll.expiresAt)).toLocaleString('ru-RU')}`}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div
                            className={styles['project-chat__message-text']}
                            dangerouslySetInnerHTML={renderContent(msg.text || '')}
                            onClick={handleMessageBodyClick}
                          />
                        )}

                        <div className={styles['project-chat__message-time']}>
                          {formatTime(msg.created_at || msg.created_at_client)}
                          {isMyMessage && (
                            <span className={styles['project-chat__message-status']}>
                              {msg.temp ? '✓' : (isMessageReadByAll(msg) ? '✓✓' : '✓')}
                            </span>
                          )}
                        </div>

                        {repliesCount > 0 && (
                          <button
                            className={styles['reply-button']}
                            onClick={() => {
                              setActiveThreadId(msg.id);
                              setShowThread(true);
                            }}
                          >
                            Ответы ({repliesCount})
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}

        {contextMenu.show && (
          <div
            className={styles['project-chat__context-menu']}
            style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={styles['project-chat__menu-item']}
              onClick={() => {
                navigator.clipboard.writeText(selectedMessage?.text || '');
                closeContextMenu();
              }}
            >
              Копировать
            </button>
            {canCreateThreadForMessage(selectedMessage) && (
              <button
                className={styles['project-chat__menu-item']}
                onClick={() => {
                  if (selectedMessage?.id && canCreateThreadForMessage(selectedMessage)) {
                    setActiveThreadId(selectedMessage.id);
                    setShowThread(true);
                  }
                  closeContextMenu();
                }}
              >
                Создать ветку
              </button>
            )}
            {canManageTasks() && selectedMessage?.sender_id !== 'system' && (
              <button
                className={styles['project-chat__menu-item']}
                onClick={() => {
                  setIsTaskModalOpen(true);
                  closeContextMenu();
                }}
              >
                Сделать задачей
              </button>
            )}
            {canDeleteMessage(selectedMessage) && (
              <button
                className={styles['project-chat__menu-item']}
                onClick={() => {
                  setIsDeleteChoiceOpen(true);
                  closeContextMenu();
                }}
              >
                Удалить
              </button>
            )}
          </div>
        )}
      </div>

      {error && <div className={styles['project-chat__error']}>{error}</div>}

      {showThread && activeThreadRootMessage && (
        <div className={styles['project-chat__thread-panel']}>
          <div className={styles['project-chat__thread-header']}>
            <strong>Ветка обсуждения</strong>
            <button
              className={styles['project-chat__thread-close']}
              onClick={() => {
                setShowThread(false);
                setActiveThreadId(null);
              }}
            >
              Закрыть
            </button>
          </div>

          <div className={styles['project-chat__thread-root']}>
            <div className={styles['project-chat__thread-label']}>Исходное сообщение</div>
            <div
              className={styles['project-chat__thread-root-body']}
              dangerouslySetInnerHTML={renderContent(activeThreadRootMessage.text || '')}
            />
          </div>

          <div className={styles['project-chat__thread-messages']}>
            {activeThreadMessages.length === 0 ? (
              <div className={styles['project-chat__thread-empty']}>Пока нет ответов</div>
            ) : (
              activeThreadMessages.map(reply => {
                const replySender = resolveSender(reply);
                const replyName = replySender?.full_name || replySender?.username || 'Пользователь';
                return (
                  <div
                    key={reply.id}
                    className={styles['project-chat__thread-message']}
                    onContextMenu={(e) => openContextMenu(e, reply)}
                    onTouchStart={(e) => handleMessageTouchStart(e, reply)}
                    onTouchMove={handleMessageTouchMove}
                    onTouchEnd={handleMessageTouchEnd}
                    onTouchCancel={handleMessageTouchEnd}
                  >
                    <div className={styles['project-chat__thread-message-header']}>
                      <span>{replyName}</span>
                      <span>{formatTime(reply.created_at || reply.created_at_client)}</span>
                    </div>
                    <div
                      className={styles['project-chat__thread-message-body']}
                      dangerouslySetInnerHTML={renderContent(reply.text || '')}
                      onClick={handleMessageBodyClick}
                    />
                  </div>
                );
              })
            )}
          </div>

          <div className={styles['project-chat__thread-hint']}>
            Новые сообщения сейчас будут отправляться в эту ветку.
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className={styles['project-chat__input-form']}>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => handlePhotoSelected(e.target.files?.[0] || null)}
        />

        <textarea
          ref={textareaRef}
          value={newMessage}
          onChange={(e) => {
            const value = e.target.value.slice(0, MAX_MESSAGE_LENGTH);
            setNewMessage(value);
            messageStateRef.current[currentProject.id] = value;
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;

            const cursor = e.target.selectionStart ?? value.length;
            const beforeCursor = value.slice(0, cursor);
            const atIndex = beforeCursor.lastIndexOf('@');
            if (atIndex === -1) {
              setShowMentionSuggestions(false);
              setMentionQuery('');
              setMentionStart(null);
              return;
            }

            const candidate = beforeCursor.slice(atIndex + 1);
            if (/\s/.test(candidate)) {
              setShowMentionSuggestions(false);
              setMentionQuery('');
              setMentionStart(null);
              return;
            }

            setMentionStart(atIndex);
            setMentionQuery(candidate);
            setShowMentionSuggestions(true);
          }}
          onKeyDown={(e) => {
            if (showMentionSuggestions && e.key === 'Escape') {
              setShowMentionSuggestions(false);
            }
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage(e);
            }
          }}
          placeholder={showThread ? 'Ответ в ветку...' : 'Сообщение...'}
          className={styles['project-chat__input-textarea']}
          maxLength={MAX_MESSAGE_LENGTH}
          rows={1}
        />

        <div className={styles['project-chat__right-side']}>
          <div className={styles['attachment-actions']}>
            <Button
              variant="ghost"
              size="small"
              type="button"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setScheduleModalPosition({
                  bottom: window.innerHeight - rect.top + 16,
                  left: rect.left + rect.width / 2,
                });
                setIsScheduleModalOpen(true);
              }}
              aria-label="Отложенная отправка"
              className={styles['project-chat__schedule-button']}
            >
              🕒
            </Button>
            <div className={styles['emoji-menu']}>
              <Button
                variant="ghost"
                size="small"
                onClick={handleEmojiClick}
                aria-label="Добавить эмоджи"
                className={styles['project-chat__emoji-button']}
              >
                😊
              </Button>
            </div>
            <Button
              ref={attachmentButtonRef}
              variant="ghost"
              size="small"
              onClick={handleAttachmentClick}
              aria-label="Прикрепить файл"
              className={styles['project-chat__attachment-button']}
            >
              📎
            </Button>
          </div>
          <Button
            type="submit"
            variant="primary"
            size="small"
            disabled={!newMessage.trim() || pendingPollCreate}
            className={styles['project-chat__send-button']}
          >
            {scheduledAt ? 'Запланировать' : 'Отправить'}
          </Button>
        </div>
      </form>

      {scheduledAt && (
        <div className={styles['project-chat__scheduled-hint']}>
          {(() => {
            const parsed = parseDateTimeLocal(scheduledAt);
            return `Отправка запланирована: ${Number.isNaN(parsed) ? 'некорректное время' : new Date(parsed).toLocaleString('ru-RU')}`;
          })()}
        </div>
      )}

      {showMentionSuggestions && mentionSuggestions.length > 0 && (
        <div className={styles['project-chat__mentions-popup']}>
          {mentionSuggestions.map((item) => (
            <button
              key={item}
              type="button"
              className={styles['project-chat__mentions-item']}
              onClick={() => applyMentionSuggestion(item)}
            >
              {item}
            </button>
          ))}
        </div>
      )}

      <AttachmentModal
        isOpen={isAttachmentModalOpen}
        onClose={() => setIsAttachmentModalOpen(false)}
        onOptionSelect={handleAttachmentOptionClick}
        position={attachmentModalPosition}
      />

      {isTaskModalOpen && (
        <CreateTaskModal
          isOpen={isTaskModalOpen}
          onClose={() => {
            setIsTaskModalOpen(false);
            setIsAttachmentModalOpen(false);
            closeContextMenu();
          }}
          sourceMessageId={selectedMessage?.id}
          initialContent={selectedMessage?.text || ''}
        />
      )}

      {isEmojiPickerOpen && (
        <EmojiPicker
          onEmojiSelect={(emoji) => {
            setNewMessage(prev => prev + emoji);
            setIsEmojiPickerOpen(false);
          }}
          onClose={() => setIsEmojiPickerOpen(false)}
          position={emojiPickerPosition}
        />
      )}

      {isProjectInfoModalOpen && (
        <ProjectInfoModal
          isOpen={isProjectInfoModalOpen}
          onClose={() => setIsProjectInfoModalOpen(false)}
        />
      )}

      {selectedUser && (
        <UserInfoModal
          user={selectedUser}
          mode="center"
          onClose={() => setSelectedUser(null)}
        />
      )}

      {isDeleteChoiceOpen && (
        <Modal isOpen={isDeleteChoiceOpen} onClose={() => setIsDeleteChoiceOpen(false)} title="Удалить сообщение">
          <div className={styles['project-chat__delete-modal']}>
            <p>Как удалить сообщение?</p>
            <div className={styles['project-chat__delete-actions']}>
              <Button
                variant="danger"
                onClick={handleDeleteForAll}
                disabled={!canDeleteMessage(selectedMessage)}
              >
                Для всех
              </Button>
              <Button variant="secondary" onClick={handleDeleteForMe}>
                Только для меня
              </Button>
              <Button variant="ghost" onClick={() => setIsDeleteChoiceOpen(false)}>
                Отмена
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {isPollModalOpen && (
        <Modal isOpen={isPollModalOpen} onClose={() => setIsPollModalOpen(false)} title="Создать опрос">
          <div className={styles['project-chat__poll-create']}>
            <textarea
              className={styles['project-chat__poll-question-input']}
              placeholder="Вопрос опроса"
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value.slice(0, 300))}
              rows={2}
            />
            {pollOptions.map((option, index) => (
              <input
                key={`poll-option-${index}`}
                className={styles['project-chat__poll-option-input']}
                value={option}
                placeholder={`Вариант ${index + 1}`}
                onChange={(e) => {
                  const value = e.target.value.slice(0, 120);
                  setPollOptions(prev => prev.map((item, i) => (i === index ? value : item)));
                }}
              />
            ))}
            <div className={styles['project-chat__poll-create-actions']}>
              <Button
                variant="secondary"
                onClick={() => setPollOptions(prev => [...prev, ''])}
                disabled={pollOptions.length >= 8}
              >
                Добавить вариант
              </Button>
              {pollOptions.length > 2 && (
                <Button
                  variant="ghost"
                  onClick={() => setPollOptions(prev => prev.slice(0, -1))}
                >
                  Удалить последний
                </Button>
              )}
            </div>
            <label className={styles['project-chat__poll-multiple']}>
              <input
                type="checkbox"
                checked={pollMultiple}
                onChange={(e) => setPollMultiple(e.target.checked)}
              />
              Разрешить несколько ответов
            </label>
            <label className={styles['project-chat__poll-expiry-label']}>
              Голосование до
              <input
                type="datetime-local"
                value={pollExpiresAt}
                onChange={(e) => setPollExpiresAt(e.target.value)}
                className={styles['project-chat__poll-expiry-input']}
              />
            </label>
            <div className={styles['project-chat__poll-modal-footer']}>
              <Button variant="ghost" onClick={() => setIsPollModalOpen(false)}>
                Отмена
              </Button>
              <Button variant="primary" onClick={submitPoll} loading={pendingPollCreate}>
                Создать
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {isPhotoComposerOpen && pendingPhotoPreviewUrl && (
        <Modal
          isOpen={isPhotoComposerOpen}
          onClose={pendingPhotoUpload ? () => undefined : closePhotoComposer}
          title="Отправить изображение"
          maxWidth={560}
        >
          <div className={styles['project-chat__photo-upload-modal']}>
            <div className={styles['project-chat__photo-upload-preview']}>
              <img src={pendingPhotoPreviewUrl} alt="Предпросмотр изображения" />
            </div>
            <label className={styles['project-chat__photo-upload-label']}>
              Подпись
              <textarea
                value={photoCaptionDraft}
                onChange={(e) => setPhotoCaptionDraft(e.target.value.slice(0, 500))}
                className={styles['project-chat__photo-upload-textarea']}
                placeholder="Добавьте подпись к изображению"
                rows={3}
                disabled={pendingPhotoUpload}
              />
            </label>
            <div className={styles['project-chat__photo-upload-meta']}>
              <span>Подпись появится под изображением в чате</span>
              <span>{photoCaptionDraft.length}/500</span>
            </div>
            <div className={styles['project-chat__photo-upload-actions']}>
              <Button
                variant="secondary"
                type="button"
                onClick={closePhotoComposer}
                disabled={pendingPhotoUpload}
              >
                Отмена
              </Button>
              <Button
                variant="primary"
                type="button"
                onClick={handlePhotoUploadSubmit}
                loading={pendingPhotoUpload}
              >
                Отправить
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {isScheduleModalOpen && (
        <div className={styles['project-chat__floating-overlay']} onClick={() => setIsScheduleModalOpen(false)}>
          <div
            className={styles['project-chat__floating-panel']}
            style={{
              bottom: scheduleModalPosition.bottom,
              left: scheduleModalPosition.left,
              transform: 'translateX(-50%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles['project-chat__floating-title']}>Отложенная отправка</div>
            <div className={styles['project-chat__schedule-modal']}>
              <label className={styles['project-chat__schedule-label']}>
                Отправить в:
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  min={toLocalDateTimeInputValue(new Date(Date.now() + 60000))}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className={styles['project-chat__schedule-input']}
                />
              </label>
              <div className={styles['project-chat__schedule-actions']}>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setScheduledAt('');
                    setIsScheduleModalOpen(false);
                  }}
                >
                  Без времени
                </Button>
                <Button
                  variant="primary"
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                >
                  Применить
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedPhotoUrl && (
        <Modal isOpen={true} onClose={() => setSelectedPhotoUrl(null)} title="Изображение">
          <div className={styles['project-chat__photo-preview-modal']}>
            <img src={selectedPhotoUrl} alt={selectedPhotoCaption || 'Изображение'} />
            {selectedPhotoCaption && selectedPhotoCaption !== 'Фото' && (
              <div className={styles['project-chat__photo-preview-caption']}>{selectedPhotoCaption}</div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ProjectChat;
