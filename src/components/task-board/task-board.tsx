import React, { useState, useMemo, useEffect } from 'react';
import styles from './task-board.module.css';
import { useProject } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import LoadingState from '../ui/loading/LoadingState';
import { useAllUserProjects } from '../../hooks/useAllUserProjects';
import { usePersistedFilters } from '../../hooks/usePersistedFilters';
import TaskCard from '../task-card/task-card/TaskCard';
import Button from '../ui/button/button';
import Select from '../ui/select/select';
import CalendarView from '../calendar-view/calendar-view';
import EditTaskModal from '../modals/edit-task-modal/edit-task-modal';
import { Task } from '../../types/task.types';
import { taskService } from '../../services/taskService'; 
import { projectService } from '../../services/projectService';
import { formatCount } from '../../utils/formatCount';
import {
  canEditTask as canEditTaskByPolicy,
  canManageTaskStatus as canManageTaskStatusByPolicy,
} from '../../utils/permissions';

interface EditTaskData {
  title: string;
  description: string | null;
  due_date: string | null;
  assignee_ids: string[];
  tags: string[];
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
}

const DEFAULT_FILTERS = {
  search: '',
  status: '',
  priority: '',
  tags: [] as string[],
  sortBy: 'date' as const,
  sortOrder: 'desc' as const,
};

const SORT_OPTIONS = [
  { value: 'date_desc', label: 'По дате' },
  { value: 'title_asc', label: 'По алфавиту: А-Я' },
  { value: 'title_desc', label: 'По алфавиту: Я-А' },
];

type TaskEventDetail =
  | { type: 'created' | 'updated'; task: Task }
  | { type: 'deleted'; taskId: string; projectId: string };

const mergeTasksWithOverrides = (
  baseTasks: Task[],
  overrides: Record<string, Task | null> | undefined
): Task[] => {
  if (!overrides || Object.keys(overrides).length === 0) return baseTasks;

  const map = new Map(baseTasks.map((task) => [task.id, task] as const));
  Object.entries(overrides).forEach(([taskId, task]) => {
    if (task === null) {
      map.delete(taskId);
      return;
    }
    map.set(taskId, task);
  });

  return Array.from(map.values());
};

const excludeArchivedTasks = (tasks: Task[]) => tasks.filter((task) => !task.archived_at);

const TaskBoard: React.FC = () => {
  const { currentProject, refreshProjects, projects: orgProjects } = useProject();
  const { user } = useAuth();
  const { currentOrganization, organizations } = useOrganization();

  const { projects: allUserProjects, loading: loadingAllProjects, refresh: refreshAllUserProjects } = useAllUserProjects();
  const { filters, updateFilters, resetFilters } = usePersistedFilters();

  const [activeTab, setActiveTab] = useState<'project' | 'organization' | 'user' | 'calendar'>('user');
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'kanban'>('list');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [organizationTasksMap, setOrganizationTasksMap] = useState<Record<string, Task[]>>({});
  const [isLoadingOrganizationTasks, setIsLoadingOrganizationTasks] = useState(false);
  const [taskOverrides, setTaskOverrides] = useState<Record<string, Record<string, Task | null>>>({});
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const hasProject = !!currentProject && !!currentOrganization;

  useEffect(() => {
    setTaskOverrides({});
    if (!currentOrganization?.id || orgProjects.length === 0) {
      setOrganizationTasksMap({});
      setIsLoadingOrganizationTasks(false);
      return;
    }

    let cancelled = false;

    const loadOrganizationTasks = async () => {
      setIsLoadingOrganizationTasks(true);
      try {
        const entries = await Promise.all(
          orgProjects.map(async (project) => {
            const tasks = await projectService.getTasks(project.id);
            return [
              project.id,
              (tasks || []).map((task) => ({
                ...task,
                project_id: project.id,
                project_name: project.name,
              })),
            ] as const;
          })
        );

        if (!cancelled) {
          setOrganizationTasksMap(Object.fromEntries(entries));
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Ошибка загрузки задач организации:', error);
          setOrganizationTasksMap({});
        }
      } finally {
        if (!cancelled) {
          setIsLoadingOrganizationTasks(false);
        }
      }
    };

    void loadOrganizationTasks();

    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id, orgProjects]);

  useEffect(() => {
    const handleTaskChanged = (event: Event) => {
      const detail = (event as CustomEvent<TaskEventDetail>).detail;
      if (!detail) return;

      setTaskOverrides((prev) => {
        if (detail.type === 'deleted') {
          return {
            ...prev,
            [detail.projectId]: {
              ...(prev[detail.projectId] || {}),
              [detail.taskId]: null,
            },
          };
        }

        const task = detail.task;
        return {
          ...prev,
          [task.project_id]: {
            ...(prev[task.project_id] || {}),
            [task.id]: task,
          },
        };
      });
    };

    window.addEventListener('teambridge:task-changed', handleTaskChanged as EventListener);
    return () => {
      window.removeEventListener('teambridge:task-changed', handleTaskChanged as EventListener);
    };
  }, []);

  const currentProjectTasks = useMemo(() => {
    if (!currentProject) return [];
    const loadedTasks = organizationTasksMap[currentProject.id];
    const baseTasks = loadedTasks || (currentProject.tasks || []).map(task => ({
      ...task,
      project_id: currentProject.id,
      project_name: currentProject.name,
    }));
    return excludeArchivedTasks(mergeTasksWithOverrides(baseTasks, taskOverrides[currentProject.id]));
  }, [currentProject, organizationTasksMap, taskOverrides]);

  const allOrganizationTasks = useMemo(() => {
    if (!currentOrganization?.id) return [];

    return orgProjects.flatMap((project) => {
      const loadedTasks = organizationTasksMap[project.id];
      const baseTasks = loadedTasks || (project.tasks || []).map((task) => ({
        ...task,
        project_id: project.id,
        project_name: project.name,
      }));
      return excludeArchivedTasks(mergeTasksWithOverrides(baseTasks, taskOverrides[project.id]));
    });
  }, [currentOrganization?.id, orgProjects, organizationTasksMap, taskOverrides]);

  const allUserTasks = useMemo(() => {
    const tasks: Task[] = [];
    allUserProjects.forEach(project => {
      const mergedTasks = excludeArchivedTasks(mergeTasksWithOverrides(
        (project.tasks || []).map((task) => ({
          ...task,
          project_id: project.id,
          project_name: project.name,
        })),
        taskOverrides[project.id]
      ));

      mergedTasks.forEach(task => {
        tasks.push({
          ...task,
          project_id: project.id,
          project_name: project.name,
        });
      });
    });
    return tasks;
  }, [allUserProjects, taskOverrides]);

  const projectLookup = useMemo(() => {
    const map = new Map<string, any>();

    if (currentProject?.id) {
      map.set(currentProject.id, currentProject);
    }

    orgProjects.forEach((project) => {
      map.set(project.id, project);
    });

    allUserProjects.forEach((project) => {
      map.set(project.id, project);
    });

    return map;
  }, [allUserProjects, currentProject, orgProjects]);

  const organizationNameById = useMemo(() => {
    return new Map(organizations.map((organization) => [organization.id, organization.name] as const));
  }, [organizations]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    let tasksToScan: Task[] = [];

    if (activeTab === 'project' && currentProject) {
      tasksToScan = currentProjectTasks;
    } else if (activeTab === 'organization') {
      tasksToScan = allOrganizationTasks;
    } else {
      tasksToScan = allUserTasks;
    }

    tasksToScan.forEach(task => {
      task.tags?.forEach(tag => tagSet.add(tag.trim()));
    });

    (currentOrganization?.task_tags || []).forEach((tag) => {
      const normalized = String(tag || '').trim();
      if (normalized) tagSet.add(normalized);
    });

    return Array.from(tagSet)
      .filter(Boolean)
      .sort()
      .map(tag => ({ value: tag, label: tag }));
  }, [activeTab, currentProject, currentOrganization?.task_tags, currentProjectTasks, allOrganizationTasks, allUserTasks]);

  const filteredTasks = useMemo(() => {
    let filtered: Task[] = [];

    if (activeTab === 'project' && currentProject) {
      filtered = currentProjectTasks;
    } else if (activeTab === 'organization' && currentProject?.organization_id) {
      filtered = allOrganizationTasks;
    } else if (activeTab === 'calendar' && currentProject) {
      filtered = currentProjectTasks;
    } else {
      filtered = allUserTasks;
    }

    return filtered.filter(task => {
      const matchesSearch = !filters.search ||
        task.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        (task.tags || []).some(tag => tag.toLowerCase().includes(filters.search.toLowerCase()));

      const matchesStatus = !filters.status || task.status === filters.status;
      const matchesPriority = !filters.priority || task.priority === filters.priority;
      const matchesTags = filters.tags.length === 0 ||
        (task.tags || []).some(tag => filters.tags.includes(tag));

      return matchesSearch && matchesStatus && matchesPriority && matchesTags;
    });
  }, [
    activeTab,
    currentProject,
    currentProjectTasks,
    allOrganizationTasks,
    allUserTasks,
    filters,
  ]);

  const sortBy = filters.sortBy || DEFAULT_FILTERS.sortBy;
  const sortOrder = filters.sortOrder || DEFAULT_FILTERS.sortOrder;

  const sortedTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      if (sortBy === 'title') {
        return sortOrder === 'asc'
          ? a.title.localeCompare(b.title)
          : b.title.localeCompare(a.title);
      } else {
        const dateA = a.due_date ? new Date(a.due_date).getTime() : 0;
        const dateB = b.due_date ? new Date(b.due_date).getTime() : 0;
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }
    });
  }, [filteredTasks, sortBy, sortOrder]);

  const tasksForView = viewMode === 'list' ? sortedTasks : filteredTasks;

  const taskSummary = useMemo(() => {
    const now = Date.now();
    return filteredTasks.reduce(
      (acc, task) => {
        acc.total += 1;

        if (task.status === 'done') {
          acc.done += 1;
        } else if (task.status === 'in_progress') {
          acc.inProgress += 1;
        } else {
          acc.todo += 1;
        }

        if (task.priority === 'high') {
          acc.highPriority += 1;
        }

        if (task.due_date && task.status !== 'done' && new Date(task.due_date).getTime() < now) {
          acc.overdue += 1;
        }

        return acc;
      },
      {
        total: 0,
        todo: 0,
        inProgress: 0,
        done: 0,
        overdue: 0,
        highPriority: 0,
      }
    );
  }, [filteredTasks]);

  const summaryCards = useMemo(() => {
    return [
      {
        key: 'total',
        label: 'В работе всего',
        value: formatCount(taskSummary.total, 'задача', 'задачи', 'задач'),
      },
      {
        key: 'inProgress',
        label: 'Активные',
        value: formatCount(taskSummary.inProgress, 'задача', 'задачи', 'задач'),
      },
      {
        key: 'overdue',
        label: 'Просроченные',
        value: formatCount(taskSummary.overdue, 'задача', 'задачи', 'задач'),
        tone: taskSummary.overdue > 0 ? 'danger' : undefined,
      },
      {
        key: 'done',
        label: 'Выполненные',
        value: formatCount(taskSummary.done, 'задача', 'задачи', 'задач'),
      },
    ];
  }, [taskSummary]);

  const assigneesMap = useMemo(() => {
    const map: { [key: string]: any[] } = {};
    tasksForView.forEach(task => {
      const project = projectLookup.get(task.project_id);
      const members = project?.members || [];

      map[task.id] = members
        .filter(m => task.assignees?.includes(m.user_id))
        .map(m => m.profile);
    });
    return map;
  }, [projectLookup, tasksForView]);

  const tabs = [
    ...(currentProject ? [{ id: 'project', label: 'Задачи проекта' }] : []),
    ...(currentProject ? [{ id: 'organization', label: 'Задачи организации' }] : []),
    { id: 'user', label: 'Все задачи' },
  ];

  const canManageTaskStatus = (task: Task) => {
    const project = projectLookup.get(task.project_id);
    return canManageTaskStatusByPolicy(task, project, currentOrganization, user?.id);
  };

  const canEditTask = (task: Task) => {
    const project = projectLookup.get(task.project_id);
    return canEditTaskByPolicy(task, project, currentOrganization, user?.id);
  };

  const getTaskContext = (task: Task) => {
    const project = projectLookup.get(task.project_id);
    return {
      projectName: (task as Task & { project_name?: string }).project_name || project?.name || null,
      organizationName: project?.organization_id ? organizationNameById.get(project.organization_id) || null : null,
    };
  };

  const handleStatusChange = async (task: Task, newStatus: 'todo' | 'in_progress' | 'done') => {
    if (!canManageTaskStatus(task) || task.status === newStatus) return;

    try {
      await taskService.updateTaskStatus(task.id, newStatus, {
        id: user?.id || null,
        name: user?.full_name || user?.username || null,
      });
    } catch (err) {
      console.error('Ошибка обновления статуса задачи:', err);
    }
  };

  const handleUpdateTask = async (taskId: string, data: EditTaskData) => {
    try {
      await taskService.updateTask(taskId, {
        title: data.title,
        description: data.description,
        due_date: data.due_date,
        assignees: data.assignee_ids,
        tags: data.tags,
        priority: data.priority,
        status: data.status,
      });
    } catch (err) {
      console.error('Ошибка обновления задачи:', err);
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsEditModalOpen(true);
  };

  useEffect(() => {
    if (!hasProject && activeTab !== 'user') {
      setActiveTab('user');
    }
  }, [hasProject, activeTab]);

  useEffect(() => {
    const focusTaskId = localStorage.getItem('focusTaskId');
    if (!focusTaskId) return;
    const task = tasksForView.find(item => item.id === focusTaskId);
    if (!task) return;
    handleEditTask(task);
    localStorage.removeItem('focusTaskId');
  }, [tasksForView]);

  const handleTaskDragStart = (taskId: string) => {
    setDraggedTaskId(taskId);
  };

  const handleTaskDrop = async (status: 'todo' | 'in_progress' | 'done') => {
    if (!draggedTaskId) return;
    const task = filteredTasks.find((item) => item.id === draggedTaskId);
    setDraggedTaskId(null);
    if (!task) return;
    await handleStatusChange(task, status);
  };

  const isLoadingBoard = loadingAllProjects || (activeTab === 'organization' && isLoadingOrganizationTasks);
  const toggleTagFilter = (tag: string) => {
    const currentTags = Array.isArray(filters.tags) ? filters.tags : [];
    const nextTags = currentTags.includes(tag)
      ? currentTags.filter((item) => item !== tag)
      : [...currentTags, tag];

    updateFilters({ tags: nextTags });
  };

  const handleExportTasks = () => {
    const rows = filteredTasks.map((task) => {
      const context = getTaskContext(task);
      const assigneeNames = (assigneesMap[task.id] || [])
        .map((profile) => profile?.full_name || profile?.username || profile?.email || 'Без имени')
        .join(', ');

      return {
        title: task.title,
        organization: context.organizationName || '',
        project: context.projectName || '',
        status:
          task.status === 'todo'
            ? 'Не начата'
            : task.status === 'in_progress'
              ? 'В процессе'
              : 'Готово',
        priority:
          task.priority === 'high'
            ? 'Высокий'
            : task.priority === 'medium'
              ? 'Средний'
              : 'Низкий',
        dueDate: task.due_date ? new Date(task.due_date).toLocaleString('ru-RU') : '',
        assignees: assigneeNames,
        tags: (task.tags || []).join(', '),
      };
    });

    const escapeCsv = (value: string) => `"${String(value || '').replace(/"/g, '""')}"`;
    const header = [
      'Название задачи',
      'Организация',
      'Проект',
      'Статус',
      'Приоритет',
      'Срок',
      'Исполнители',
      'Теги',
    ];

    const separator = ';';

    const csv = [
      header.map(escapeCsv).join(separator),
      ...rows.map((row) =>
        [
          row.title,
          row.organization,
          row.project,
          row.status,
          row.priority,
          row.dueDate,
          row.assignees,
          row.tags,
        ]
          .map(escapeCsv)
          .join(separator)
      ),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const tabLabel =
      activeTab === 'project'
        ? 'project'
        : activeTab === 'organization'
          ? 'organization'
          : 'all';

    link.href = url;
    link.download = `teambridge-tasks-${tabLabel}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderTaskView = () => {
    if (viewMode === 'calendar') {
      return (
        <CalendarView
          tasks={tasksForView}
          onTaskClick={handleEditTask}
          assigneesMap={assigneesMap}
        />
      );
    }

    if (viewMode === 'kanban') {
      return (
        <div className={styles['task-board__kanban']}>
          {(['todo', 'in_progress', 'done'] as const).map(status => (
            <div
              key={status}
              className={`${styles['task-board__column']} ${draggedTaskId ? styles['task-board__column--droppable'] : ''}`}
              onDragOver={(e) => {
                if (!draggedTaskId) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                void handleTaskDrop(status);
              }}
            >
              <h4>
                {status === 'todo' ? 'Не начата' :
                 status === 'in_progress' ? 'В процессе' : 'Готово'}
              </h4>
              {filteredTasks
                .filter(t => t.status === status)
                .map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    canManageStatus={canManageTaskStatus(task)}
                    onStatusChange={(status) => handleStatusChange(task, status)}
                    onEdit={() => handleEditTask(task)}
                    assignees={assigneesMap[task.id] || []}
                    projectName={activeTab === 'user' ? getTaskContext(task).projectName : null}
                    organizationName={activeTab === 'user' ? getTaskContext(task).organizationName : null}
                    hideActions
                    draggable={canManageTaskStatus(task)}
                    onDragStart={() => handleTaskDragStart(task.id)}
                  />
                ))}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className={styles['task-board__list']}>
        {tasksForView.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            canManageStatus={canManageTaskStatus(task)}
            onStatusChange={(status) => handleStatusChange(task, status)}
            onEdit={() => handleEditTask(task)}
            assignees={assigneesMap[task.id] || []}
            projectName={activeTab === 'user' ? getTaskContext(task).projectName : null}
            organizationName={activeTab === 'user' ? getTaskContext(task).organizationName : null}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={styles['task-board__board']}>
      <div className={styles['task-board__header']}>

        <div className={styles['task-board__tabs']}>
          {tabs.map(tab => (
            <Button
              key={tab.id}
              variant="ghost"
              size="small"
              className={`${styles['task-board__tab']} ${
                activeTab === tab.id ? styles['task-board__tab--active'] : ''
              }`}
              onClick={() => setActiveTab(tab.id as any)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <div className={styles['task-board__controls']}>
          <input
            type="text"
            placeholder="Поиск по названию или тегу..."
            value={filters.search}
            onChange={e => updateFilters({ search: e.target.value })}
            className={styles['task-board__search']}
          />

          <Select
            value={filters.status}
            onChange={value => updateFilters({ status: value as string })}
            options={[
              { value: '', label: 'Все статусы' },
              { value: 'todo', label: 'Не начата' },
              { value: 'in_progress', label: 'В процессе' },
              { value: 'done', label: 'Готово' },
            ]}
            placeholder="Статус"
            className={styles['task-board__filter']}
            hasSearch={false}
          />
          <Select
            value={filters.priority}
            onChange={value => updateFilters({ priority: value as string })}
            options={[
              { value: '', label: 'Все приоритеты' },
              { value: 'low', label: 'Низкий' },
              { value: 'medium', label: 'Средний' },
              { value: 'high', label: 'Высокий' },
            ]}
            placeholder="Приоритет"
            className={styles['task-board__filter']}
            hasSearch={false}
          />

          {viewMode === 'list' ? (
            <Select
              value={`${sortBy}_${sortOrder}`}
              onChange={value => {
                const [nextSortBy, nextSortOrder] = String(value).split('_');
                updateFilters({
                  sortBy: (nextSortBy === 'title' ? 'title' : 'date') as 'date' | 'title',
                  sortOrder: (nextSortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
                });
              }}
              options={SORT_OPTIONS}
              placeholder="Сортировка"
              className={styles['task-board__filter']}
              hasSearch={false}
            />
          ) : null}
        </div>

        {allTags.length > 0 ? (
          <div className={styles['task-board__tag-filters']}>
            <span className={styles['task-board__tag-filters-label']}>Теги:</span>
            <div className={styles['task-board__tag-filters-row']}>
              {allTags.map((tag) => {
                const isActive = filters.tags.includes(tag.value);
                return (
                  <button
                    key={tag.value}
                    type="button"
                    className={`${styles['task-board__tag-filter-chip']} ${isActive ? styles['task-board__tag-filter-chip--active'] : ''}`}
                    onClick={() => toggleTagFilter(tag.value)}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className={styles['task-board__summary']}>
          <div className={styles['task-board__summary-grid']}>
            {summaryCards.map((card) => (
              <div
                key={card.key}
                className={`${styles['task-board__summary-card']} ${
                  card.tone === 'danger' ? styles['task-board__summary-card--danger'] : ''
                }`}
              >
                <span className={styles['task-board__summary-label']}>{card.label}</span>
                <strong className={styles['task-board__summary-value']}>{card.value}</strong>
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            size="small"
            onClick={handleExportTasks}
            className={styles['task-board__export-button']}
            disabled={filteredTasks.length === 0}
          >
            Экспорт CSV
          </Button>
        </div>
      </div>

      {isLoadingBoard ? (
        <LoadingState message="Загрузка всех задач..." />
      ) : (
        <>
          <div className={styles['task-board__view-controls']}>
            <Button
              variant="ghost"
              size="small"
              className={`${styles['task-board__view-button']} ${
                viewMode === 'list' ? styles['task-board__view-button--active'] : ''
              }`}
              onClick={() => setViewMode('list')}
            >
              Список
            </Button>
            <Button
              variant="ghost"
              size="small"
              className={`${styles['task-board__view-button']} ${
                viewMode === 'calendar' ? styles['task-board__view-button--active'] : ''
              }`}
              onClick={() => setViewMode('calendar')}
            >
              Календарь
            </Button>
            <Button
              variant="ghost"
              size="small"
              className={`${styles['task-board__view-button']} ${
                viewMode === 'kanban' ? styles['task-board__view-button--active'] : ''
              }`}
              onClick={() => setViewMode('kanban')}
            >
              Канбан
            </Button>
            <Button
              variant="ghost"
              size="small"
              onClick={resetFilters}
              className={styles['task-board__reset-button']}
              disabled={JSON.stringify(filters) === JSON.stringify(DEFAULT_FILTERS)}
            >
              Сбросить
            </Button>
          </div>
          <div className={styles['task-board__content']}>
            {sortedTasks.length === 0 ? (
              <div className={styles['task-board__empty-state']}>
                <strong>Задачи не найдены</strong>
                <span>Попробуйте сменить вкладку или сбросить фильтры.</span>
              </div>
            ) : (
              renderTaskView()
            )}
          </div>
        </>
      )}

      {isEditModalOpen && editingTask && (
        <EditTaskModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingTask(null);
          }}
          readOnly={!editingTask || !canEditTask(editingTask)}
          task={editingTask}
          refreshProjects={async () => undefined}
        />
      )}
    </div>
  );
};

export default TaskBoard;
