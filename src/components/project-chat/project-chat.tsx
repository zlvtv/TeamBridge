import React, { useState, useEffect, useRef } from 'react';
import styles from './project-chat.module.css';
import { useProject } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import DOMPurify from 'dompurify';
import './messageStyles.css';
import CreateTaskModal from '../../components/modals/create-task-modal/create-task-modal';
import ConfirmModal from '../../components/modals/confirm-modal/confirm-modal';
import AttachmentModal from '../../components/modals/attachment-modal/attachment-modal';
import { getMessages, sendMessage, subscribeToMessages, deleteMessage } from '../../lib/firestore';
import { encryptMessage, decryptMessage } from '../../lib/crypto';

const ProjectChat: React.FC = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messageStateRef = useRef<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { currentProject } = useProject();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachmentButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!currentProject) return;
    
    const savedMessage = messageStateRef.current[currentProject.id] || '';
    setNewMessage(savedMessage);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [currentProject]);

  const [contextMenu, setContextMenu] = useState<{
    show: boolean;
    x: number;
    y: number;
    message: any;
    type: 'message' | 'text';
  }>({
    show: false,
    x: 0,
    y: 0,
    message: null,
    type: 'text',
  });

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);
  const [attachmentModalPosition, setAttachmentModalPosition] = useState({ bottom: 0, left: 0 });

  const canDeleteMessage = (message: any) => {
    if (!user || !currentOrganization) return false;
    
    if (currentOrganization.organization_members.some(m => m.user_id === user.id && m.role === 'member')) {
      return message.sender_id === user.id;
    }
    
    return currentOrganization.organization_members.some(
      m => m.user_id === user.id && (m.role === 'admin' || m.role === 'owner')
    );
  };

  const handleAttachmentClick = () => {
    if (!attachmentButtonRef.current) {
      setIsAttachmentModalOpen(!isAttachmentModalOpen);
      return;
    }
    const rect = attachmentButtonRef.current.getBoundingClientRect();
    setAttachmentModalPosition({
      bottom: window.innerHeight - rect.top + 16,
      left: rect.left + rect.width / 2
    });
    setIsAttachmentModalOpen(!isAttachmentModalOpen);
  };

  const handleAttachmentOptionClick = (type: 'photo' | 'poll' | 'task') => {
    console.log('handleAttachmentOptionClick triggered with type:', type);
    if (type === 'task') {
      setIsTaskModalOpen(true);
      console.log('Task modal state set to true');
    }
  };


  useEffect(() => {
    if (!currentProject?.id) return;

    setIsLoading(true);
    setError(null);

    const unsubscribe = subscribeToMessages(currentProject.id, (fetchedMessages) => {
      const sortedMessages = [...fetchedMessages].sort((a, b) => {
        const aTime = a.created_at?.seconds || 0;
        const bTime = b.created_at?.seconds || 0;
        return aTime - bTime;
      });
      setMessages(sortedMessages);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentProject?.id]);



  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentProject || !user) return;
    if (newMessage.length > 4000) {
      setError('Сообщение не может быть длиннее 4000 символов');
      return;
    }

    setError(null);

    try {
      const encryptedText = encryptMessage(newMessage.trim(), currentProject.id);
      await sendMessage(currentProject.id, encryptedText, user.id);
      messageStateRef.current[currentProject.id] = '';
      setNewMessage('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch (err: any) {
      setError('Ошибка отправки сообщения');
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) {
        return; 
      }
      setContextMenu({ show: false, x: 0, y: 0, message: null });
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const renderContent = (content: string) => {
    try {
      const decrypted = content ? decryptMessage(content, currentProject!.id) : '';
      const sanitized = DOMPurify.sanitize(decrypted, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'a'],
        ADD_ATTR: ['target', 'rel', 'href'],
      });
      
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = sanitized;
      
      const walker = document.createTreeWalker(tempDiv, NodeFilter.SHOW_TEXT, null, false);
      const textNodes = [];
      let node;
      
      while (node = walker.nextNode()) {
        if (node.textContent.trim() !== '') {
          textNodes.push(node);
        }
      }
      
      const urlRegex = /(https?:\/\/[\da-z.-]+\.[a-z.]{2,}[\/\w .-]*)/gi;
      
      textNodes.forEach(textNode => {
        const parent = textNode.parentNode;
        const content = textNode.textContent;
        
        const matches = content.match(urlRegex);
        
        if (matches) {
          let lastIndex = 0;
          let fragment = document.createDocumentFragment();
          
          content.replace(urlRegex, (match, url, index) => {
            if (index > lastIndex) {
              fragment.appendChild(document.createTextNode(content.substring(lastIndex, index)));
            }
            
            const link = document.createElement('a');
            link.href = url;
            link.textContent = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'message-link';
            fragment.appendChild(link);
            
            lastIndex = index + match.length;
          });
          
          if (lastIndex < content.length) {
            fragment.appendChild(document.createTextNode(content.substring(lastIndex)));
          }
          
          parent.replaceChild(fragment, textNode);
        }
      });
      
      return { __html: tempDiv.innerHTML };
    } catch (err) {
      return { __html: '' }; 
    }
  };

  const formatTime = (dateString: string) => {
    try {
      let date: Date;
      
      if (dateString && typeof dateString === 'object' && 'seconds' in dateString) {
        date = new Date(dateString.seconds * 1000);
      } else {
        date = new Date(dateString);
      }
      
      if (isNaN(date.getTime())) return '';
      
      return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (err) {
      return '';
    }
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
            const sender = isMyMessage 
              ? user 
              : (msg.sender_profile || 
                 currentOrganization?.organization_members?.find(m => m.user_id === msg.sender_id)?.user || 
                 { full_name: 'Пользователь', username: 'Пользователь' });

            const senderName = sender?.full_name || sender?.username || sender?.email || 'Пользователь';

            return (
              <div
                key={msg.id}
                className={`${styles.message} ${isMyMessage ? styles['message-mine'] : ''}`}
                onMouseDown={(e) => {
                  const selection = window.getSelection();
                  if (selection && selection.toString().length > 0) {
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  const selection = window.getSelection();
                  const textSelected = selection && selection.toString().length > 0;
                  setContextMenu({
                    show: true,
                    x: e.clientX,
                    y: e.clientY,
                    message: msg,
                    type: textSelected ? 'text' : 'message',
                  });
                }}
                title="Правый клик — управление сообщением"
              >
                <div className={styles['avatar']} title={senderName}>
                  {sender?.avatar_url ? (
                    <img src={sender.avatar_url} alt="" />
                  ) : (
                    <span>{senderName.charAt(0).toUpperCase()}</span>
                  )}
                </div>

                <div className={styles['message-content']}>
                  <div className={styles['message-sender']}>{senderName}</div>
                  <div
                    className={styles['message-text']}
                    dangerouslySetInnerHTML={renderContent(msg.text)}
                  />
                  <div className={styles['message-time']}>{formatTime(msg.created_at)}</div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />

        {contextMenu.show && (
          <div
            className={styles.contextMenu}
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()}
          >
            <>
              <button
                className={styles.menuItem}
                onClick={() => {
                  try {
                    const decrypted = decryptMessage(contextMenu.message.text, currentProject!.id);
                    navigator.clipboard.writeText(decrypted);
                  } catch {
                    navigator.clipboard.writeText(contextMenu.message.text);
                  }
                  setContextMenu({ show: false, x: 0, y: 0, message: null, type: 'message' });
                }}
              >
                Копировать
              </button>
              <button
                className={styles.menuItem}
                onClick={(e) => {
                  e.stopPropagation();
                  console.log('Context menu: Сделать задачей clicked');
                  setIsTaskModalOpen(true);
                  e.preventDefault();
                }}
              >
                Сделать задачей
              </button>
              {canDeleteMessage(contextMenu.message) && (
                <button
                  className={styles.menuItem}
                  onClick={(e) => {
                  e.stopPropagation();
                  setIsConfirmModalOpen(true);
                }}
                >
                  Удалить
                </button>
              )}
            </>
          </div>
        )}

        {isConfirmModalOpen && (
          <ConfirmModal
            isOpen={isConfirmModalOpen}
            onClose={() => setIsConfirmModalOpen(false)}
            onConfirm={async () => {
              if (!contextMenu.message?.id) {
                console.error('Нет сообщения для удаления');
                setIsConfirmModalOpen(false);
                return;
              }
              try {
                await deleteMessage(contextMenu.message.id);
                setIsConfirmModalOpen(false);
              } catch (err) {
                console.error('Ошибка при удалении сообщения:', err);
                alert('Не удалось удалить сообщение');
              }
            }}
            message="Вы уверены, что хотите удалить это сообщение?"
            confirmText="Удалить"
            cancelText="Отмена"
          />
        )}
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <form onSubmit={handleSendMessage} className={styles['input-form']}>
        <textarea
          ref={textareaRef}
          value={newMessage}
          onChange={(e) => {
            const value = e.target.value.slice(0, 4000);
            setNewMessage(value);
            if (currentProject) {
              messageStateRef.current[currentProject.id] = value;
            }
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage(e);
            }
          }}
          onInput={(e) => {
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
          }}
          placeholder="Напишите сообщение..."
          className={styles['input-textarea']}
          maxLength={4000}
          rows={1}
        />
        <button
          ref={attachmentButtonRef}
          type="button"
          className={styles['attachment-button']}
          onClick={handleAttachmentClick}
          aria-label="Прикрепить файл"
        >
          📎
        </button>
        <button type="submit" className={styles['send-button']} disabled={!newMessage.trim()}>
          Отправить
        </button>
      </form>

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
            console.log('Modal closed');
            setIsTaskModalOpen(false);
          }}
          sourceMessageId={contextMenu.message?.id}
          initialContent={contextMenu.message?.text}
        />
      )}


    </div>
  );
};

export default ProjectChat;
