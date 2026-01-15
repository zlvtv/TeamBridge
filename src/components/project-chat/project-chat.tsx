import React, { useState, useEffect, useRef } from 'react';
import styles from './project-chat.module.css';
import { useProject } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/AuthContext';
import DOMPurify from 'dompurify';
import CreateTaskModal from '../../components/modals/create-task-modal/create-task-modal';

const ProjectChat: React.FC = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { currentProject } = useProject();
  const { user } = useAuth();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadMessages = async () => {
    if (!currentProject) return;

    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          sender_id,
          profiles (
            id,
            username,
            full_name,
            avatar_url
          )
        `)
        .eq('project_id', currentProject.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMessages(data || []);
    } catch (err: any) {
      setError('Ошибка загрузки сообщений');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!currentProject) return;

    const channel = supabase
      .channel(`messages:${currentProject.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `project_id=eq.${currentProject.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentProject?.id]);

  useEffect(() => {
    loadMessages();
  }, [currentProject?.id]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentProject || !user) return;
    if (newMessage.length > 4000) {
      setError('Сообщение не может быть длиннее 4000 символов');
      return;
    }

    setError(null);

    const { data, error } = await supabase
      .from('messages')
      .insert({
        project_id: currentProject.id,
        sender_id: user.id,
        content: newMessage.trim(),
      })
      .select(`
        id,
        content,
        created_at,
        sender_id,
        profiles (
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .single();

    if (error) {
      setError('Ошибка отправки');
      console.error(error);
      return;
    }

    setNewMessage('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const [contextMenu, setContextMenu] = useState<{
  show: boolean;
  x: number;
  y: number;
  message: any;
}>({
  show: false,
  x: 0,
  y: 0,
  message: null,
});

const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

useEffect(() => {
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      show: false,
      x: 0,
      y: 0,
      message: null,
    });
  };

  document.addEventListener('click', handleContextMenu);
  document.addEventListener('contextmenu', handleContextMenu);

  return () => {
    document.removeEventListener('click', handleContextMenu);
    document.removeEventListener('contextmenu', handleContextMenu);
  };
}, []);

const showContextMenu = (e: React.MouseEvent, message: any) => {
  e.preventDefault();
  if (message.sender_id !== user?.id) return; // Только для своих сообщений (или убрать, если хочешь для всех)

  setContextMenu({
    show: true,
    x: e.clientX,
    y: e.clientY,
    message,
  });
};

  const renderContent = (content: string) => {
    return {
      __html: DOMPurify.sanitize(content, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
      }),
    };
  };

  if (!currentProject) {
    return (
      <div className={styles.chat}>
        <div className={styles.placeholder}>Выберите проект</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.chat}>
        <div className={styles.loading}>Загрузка сообщений...</div>
      </div>
    );
  }

  return (
    <div className={styles.chat}>
      <div className={styles['messages-container']}>
        {messages.length === 0 ? (
          <div className={styles.placeholder}>Нет сообщений. Начните общение!</div>
        ) : (
          messages.map((msg) => {
            const isMyMessage = msg.sender_id === user?.id;
            const sender = msg.profiles;

            return (
             <div
  key={msg.id}
  className={`${styles.message} ${isMyMessage ? styles['message-mine'] : ''}`}
  onContextMenu={(e) => showContextMenu(e, msg)}
  title="Правый клик — создать задачу"
>
                {!isMyMessage && (
                  <div
                    className={styles['avatar']}
                    style={{ backgroundImage: sender.avatar_url ? `url(${sender.avatar_url})` : 'none' }}
                    title={sender.full_name || sender.username}
                  >
                    {!sender.avatar_url && (
                      <span>{(sender.full_name || sender.username)?.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                )}

                <div className={styles['message-content']}>
                  <div
                    className={styles['message-text']}
                    dangerouslySetInnerHTML={renderContent(msg.content)}
                  />
                  <div className={styles['message-time']}>{formatTime(msg.created_at)}</div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
        {/* Контекстное меню */}
{contextMenu.show && (
  <div
    className={styles.contextMenu}
    style={{ top: contextMenu.y, left: contextMenu.x }}
    onClick={(e) => e.stopPropagation()}
  >
    <button
      className={styles.menuItem}
      onClick={() => {
        setIsTaskModalOpen(true);
        setContextMenu({ show: false, x: 0, y: 0, message: null });
      }}
    >
      📌 Сделать задачей
    </button>
  </div>
)}

{/* Модал создания задачи */}
{isTaskModalOpen && (
  <CreateTaskModal
    isOpen={isTaskModalOpen}
    onClose={() => setIsTaskModalOpen(false)}
    sourceMessageId={contextMenu.message?.id}
    initialContent={contextMenu.message?.content}
  />
)}

      </div>

      {error && <div className={styles.error}>{error}</div>}

      <form onSubmit={handleSendMessage} className={styles['input-form']}>
        <textarea
          ref={textareaRef}
          value={newMessage}
          onChange={(e) => {
            setNewMessage(e.target.value.slice(0, 4000));
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
          }}
          placeholder="Напишите сообщение..."
          className={styles['input-textarea']}
          maxLength={4000}
          rows={1}
        />
        <button type="submit" className={styles['send-button']} disabled={!newMessage.trim()}>
          Отправить
        </button>
      </form>

      <div className={styles['char-count']}>{newMessage.length}/4000</div>
    </div>
  );
};

export default ProjectChat;
