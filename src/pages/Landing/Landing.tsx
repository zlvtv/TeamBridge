import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Landing.css';
import Carousel from '../../components/carousel/carousel';
import Slide from '../../components/slide/slide';

const workflowSteps = [
  {
    step: '01',
    title: 'Собрали проект и роли',
    description: 'Организация хранит системные и кастомные роли, а внутри проекта можно задать куратора, состав участников и локальные роли команды.',
  },
  {
    step: '02',
    title: 'Обсудили и превратили в задачу',
    description: 'Сообщение из чата можно сразу перевести в задачу с исполнителями, тегами, сроком, напоминаниями и отдельным обсуждением по задаче.',
  },
  {
    step: '03',
    title: 'Довели до результата',
    description: 'Команда ведет задачу в списке, календаре или kanban, получает уведомления и видит статус работы без разрыва между чатом и исполнением.',
  },
];

const coreFeatures = [
  {
    title: 'Организации, проекты и роли',
    description: 'Иерархия из организаций и проектов, системные и кастомные роли, куратор проекта, локальные роли команды и приглашения по ссылке.',
  },
  {
    title: 'Чат команды без потери контекста',
    description: 'Проектный чат, ветки, опросы, вложения, эмодзи, отложенная отправка и role-mentions работают в одном рабочем пространстве.',
  },
  {
    title: 'Задачи как часть рабочего потока',
    description: 'Список, kanban и календарь, drag-and-drop по статусам, теги, сроки с точным временем, напоминания и task-chat внутри задачи.',
  },
  {
    title: 'Уведомления и присутствие',
    description: 'Внутренний центр уведомлений, браузерные уведомления, last seen участников и прозрачная история системных событий по проекту.',
  },
];

const Landing: React.FC = () => {
  const { user, isInitialized } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }, []);

  const primaryAction = isInitialized && user
    ? (
      <button onClick={() => navigate('/dashboard')} className="landing-button landing-button--primary">
        Открыть workspace
      </button>
    )
    : (
      <>
        <Link to="/signup" className="landing-button landing-button--primary">Попробовать бесплатно</Link>
        <Link to="/login" className="landing-button landing-button--secondary">Войти</Link>
      </>
    );

  return (
    <div className="landing">
      <header className="landing__hero">
        <nav className="landing__nav">
          <Link to="/" className="landing__brand" aria-label="TeamBridge home">
            <span className="landing__brand-mark">TB</span>
            <span className="landing__brand-text">TeamBridge</span>
          </Link>

          <div className="landing__nav-links">
            <a href="#workflow-section">Как это работает</a>
            <a href="#scenarios-section">Сценарии</a>
            <a href="#features-section">Возможности</a>
          </div>

          <div className="landing__nav-actions">
            {isInitialized && !user ? <Link to="/login" className="landing__nav-login">Войти</Link> : null}
            {isInitialized && user ? (
              <button onClick={() => navigate('/dashboard')} className="landing__nav-dashboard">
                Dashboard
              </button>
            ) : (
              <Link to="/signup" className="landing__nav-dashboard">Начать</Link>
            )}
          </div>
        </nav>

        <div className="landing__hero-grid">
          <div className="landing__hero-copy">
            <div className="landing__eyebrow">CHAT + TASKS + PROJECT DELIVERY</div>
            <h1>Корпоративный мессенджер, в котором проекты, роли и задачи живут в одном интерфейсе</h1>
            <p className="landing__hero-text">
              TeamBridge объединяет организации, проекты, общий чат, локальные и кастомные роли, задачи, task-board и уведомления.
              Здесь можно назначать роли, тегать людей и роли в сообщениях, превращать обсуждение в задачу и вести работу до результата без переключения между сервисами.
            </p>

            <div className="landing__hero-actions">
              {primaryAction}
            </div>

            <div className="landing__hero-meta">
              <div>
                <strong>2 слоя структуры</strong>
                <span>организации и проекты с отдельными участниками, ролями и правами</span>
              </div>
              <div>
                <strong>Роли и кураторы</strong>
                <span>кастомные роли организации, локальные роли проекта и куратор команды</span>
              </div>
              <div>
                <strong>Задачи с контекстом</strong>
                <span>напоминания, внутренний task-chat, board, календарь и уведомления для исполнителей</span>
              </div>
            </div>
          </div>

          <div className="landing__hero-visual" aria-label="Интерфейс TeamBridge">
            <div className="landing__hero-orb landing__hero-orb--one" />
            <div className="landing__hero-orb landing__hero-orb--two" />

            <div className="landing__app-shell">
              <div className="landing__app-topbar">
                <div className="landing__app-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="landing__app-title">TeamBridge workspace</div>
                <div className="landing__app-badge">LIVE</div>
              </div>

              <div className="landing__app-body">
                <div className="landing__panel landing__panel--board">
                  <div className="landing__panel-label">Task board</div>
                  <div className="landing__kanban">
                    <div className="landing__kanban-column">
                      <span>Backlog</span>
                      <div className="landing__kanban-card">Подготовить invite flow</div>
                    </div>
                    <div className="landing__kanban-column">
                      <span>In progress</span>
                      <div className="landing__kanban-card landing__kanban-card--active">Перенести задачу из чата</div>
                      <div className="landing__kanban-card">Назначить локальные роли</div>
                    </div>
                    <div className="landing__kanban-column">
                      <span>Done</span>
                      <div className="landing__kanban-card">Настроить уведомления</div>
                    </div>
                  </div>
                </div>

                <div className="landing__app-secondary">
                  <div className="landing__panel landing__panel--chat">
                    <div className="landing__panel-label">Project chat</div>
                    <div className="landing__message">
                      <span className="landing__message-author">Куратор проекта</span>
                      <p>@backend и @qa соберите правки по релизу. Из этого сообщения нужно сделать задачу и поставить напоминание на завтра.</p>
                    </div>
                    <div className="landing__message landing__message--accent">
                      <span className="landing__message-author">Действие</span>
                      <p>Сообщение превращено в задачу с исполнителями, тегами, временем дедлайна и отдельным обсуждением задачи.</p>
                    </div>
                  </div>

                  <div className="landing__panel landing__panel--calendar">
                    <div className="landing__panel-label">Calendar + activity</div>
                    <div className="landing__calendar-row">
                      <span>Mon</span>
                      <span>Tue</span>
                      <span className="is-active">Wed</span>
                      <span>Thu</span>
                      <span>Fri</span>
                    </div>
                    <div className="landing__activity-list">
                      <div>
                        <strong>14:00</strong>
                        <span>Ревью задач по спринту и статусов исполнителей</span>
                      </div>
                      <div>
                        <strong>16:30</strong>
                        <span>Созвон по ролям организации и составу проекта</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="landing__workflow" id="workflow-section">
          <div className="landing__section-heading">
            <span>Как это работает</span>
            <h2>Один рабочий цикл вместо набора разрозненных инструментов</h2>
            <p>
              TeamBridge построен вокруг полного цикла командной работы: настроили структуру, обсудили решение, перевели его в задачу и довели до результата.
            </p>
          </div>

          <div className="landing__workflow-grid">
            {workflowSteps.map((item) => (
              <article key={item.step} className="landing__workflow-card">
                <span className="landing__workflow-step">{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing__demo" id="scenarios-section">
          <div className="landing__section-heading landing__section-heading--light">
            <span>Сценарии</span>
            <h2>Не абстрактные фичи, а рабочие процессы команды</h2>
          </div>

          <Carousel>
            <Slide
              eyebrow="Сценарий 01"
              title="Из обсуждения в задачу с дедлайном и напоминанием"
              description="Контекст остается в проектном чате, а исполнение переезжает на доску задач без ручного переноса информации и без потери срока."
              highlights={['Контекст сообщения сохраняется', 'Можно назначить срок с точным временем, исполнителей и теги', 'У задачи появляется собственное обсуждение']}
              accent="Chat to task"
              visualCards={[
                { label: 'Source', title: 'Сообщение в проекте', description: 'Обсуждение остается привязанным к рабочему контексту', size: 'large' },
                { label: 'Task', title: 'Дата, время и теги' },
                { label: 'Thread', title: 'Чат внутри задачи' },
              ]}
            />
            <Slide
              eyebrow="Сценарий 02"
              title="Соберите структуру команды через роли организации и проекта"
              description="Участникам можно выдавать кастомные роли организации, а внутри проекта добавлять локальные роли и отдельного куратора."
              highlights={['Системные и кастомные роли организации', 'Локальные роли проекта для конкретной команды', 'Можно тегать людей и роли в сообщениях']}
              accent="Mentions + roles"
              visualCards={[
                { label: 'Org', title: 'Роли организации', description: 'Owner, moderator и кастомные роли с цветами', size: 'large' },
                { label: 'Project', title: 'Локальные роли' },
                { label: 'Lead', title: 'Куратор проекта' },
              ]}
            />
            <Slide
              eyebrow="Сценарий 03"
              title="Планируйте задачи в списке, kanban и календаре"
              description="Task-board помогает держать в фокусе статус задач, дедлайны и нагрузку по всем проектам, где участвует пользователь."
              highlights={['Список, kanban и календарный режим', 'Перетаскивание задач по статусам', 'Вкладка со всеми задачами по проектам и организациям']}
              accent="Board + calendar"
              visualCards={[
                { label: 'Board', title: 'Todo, In progress, Done', description: 'Статусы показывают, где застревает работа', size: 'large' },
                { label: 'Calendar', title: 'Дата и время дедлайна' },
                { label: 'All tasks', title: 'Задачи по всем проектам' },
              ]}
            />
            <Slide
              eyebrow="Сценарий 04"
              title="Следите за событиями через центр уведомлений"
              description="Упоминания, ответы, системные события и напоминания по задачам попадают во внутренние уведомления и могут дублироваться в браузер."
              highlights={['Browser notifications при включенном разрешении', 'Task reminders для исполнителей', 'Last seen и live-обновления структуры команды']}
              accent="Roles + alerts"
              visualCards={[
                { label: 'Invite', title: 'Ссылка в организацию', description: 'Новый участник подключается без ручной настройки', size: 'large' },
                { label: 'Browser', title: 'Push-оповещения' },
                { label: 'Feed', title: 'Центр уведомлений' },
              ]}
            />
          </Carousel>
        </section>

        <section className="landing__features" id="features-section">
          <div className="landing__section-heading">
            <span>Возможности</span>
            <h2>Все ключевые модули TeamBridge на одной рабочей поверхности</h2>
          </div>

          <div className="landing__features-grid">
            {coreFeatures.map((feature) => (
              <article key={feature.title} className="landing__feature-card">
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>

          <div className="landing__feature-banner">
            <div>
              <span className="landing__feature-banner-label">Безопасность и контроль</span>
              <h3>Email-auth, подтверждение аккаунта и управление доступом через роли</h3>
            </div>
            <p>
              В платформу уже встроены регистрация, подтверждение email, восстановление пароля, редактирование профиля, приглашения в организацию и контроль действий через роли организации и проекта.
            </p>
          </div>
        </section>

        <section className="landing__cta">
          <div className="landing__cta-panel">
            <div>
              <span className="landing__cta-label">Ready to bridge the gap?</span>
              <h2>Соберите организации, проекты, чат и управление задачами в одном интерфейсе</h2>
              <p>
                TeamBridge особенно полезен там, где проектная коммуникация должна сразу переходить в исполнение: через роли, задачи, task-board, уведомления и понятную структуру команды.
              </p>
            </div>

            <div className="landing__cta-actions">
              {isInitialized && user ? (
                <button onClick={() => navigate('/dashboard')} className="landing-button landing-button--primary">
                  Перейти в dashboard
                </button>
              ) : (
                <>
                  <Link to="/signup" className="landing-button landing-button--primary">Создать аккаунт</Link>
                  <Link to="/login" className="landing-button landing-button--ghost">У меня уже есть аккаунт</Link>
                </>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="landing__footer">
        <p>TeamBridge © 2026. Корпоративная коммуникация и управление задачами в одном рабочем пространстве.</p>
      </footer>
    </div>
  );
};

export default Landing;
