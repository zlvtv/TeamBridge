// src/components/task-board/task-board.tsx

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
import { taskService } from '../../services/taskService'; // ✅ Добавлен импорт

interface EditTaskData {
  title: string;
  description: string | null;
  due_date: string | null;
  assignee_ids: string[];
  tags: string[];
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
}

// Дефолтные фильтры
const DEFAULT_FILTERS = {
  search: '',
  status: '',
  priority: '',
  tags: [] as string[],
  sortBy: 'date' as const,
  sortOrder: 'desc' as const,
};

const TaskBoard: React.FC = () => {
  const { currentProject, refreshProjects, projects: orgProjects } = useProject();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  const { projects: allUserProjects, loading: loadingAllProjects } = useAllUserProjects();
  const { filters, updateFilters, resetFilters } = usePersistedFilters();

  const [activeTab, setActiveTab] = useState<'project' | 'organization' | 'user' | 'calendar'>('user');
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'kanban'>('list');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const hasProject = !!currentProject && !!currentOrganization;

  // --- Переместите зависимости ВЫШЕ их использования ---

  const currentProjectTasks = useMemo(() => {
    if (!currentProject) return [];
    return (currentProject.tasks || []).map(task => ({
      ...task,
      project_id: currentProject.id,
      project_name: currentProject.name,
    }));
  }, [currentProject]);

  const allOrganizationTasks = useMemo(() => {
    if (!currentProject?.organization_id) return [];

    const allTasks: Task[] = [];
    orgProjects.forEach(project => {
      (project.tasks || []).forEach(task => {
        allTasks.push({
          ...task,
          project_id: project.id,
          project_name: project.name,
        });
      });
    });
    return allTasks;
  }, [orgProjects, currentProject?.organization_id]);

  const allUserTasks = useMemo(() => {
    const tasks: Task[] = [];
    allUserProjects.forEach(project => {
      (project.tasks || []).forEach(task => {
        tasks.push({
          ...task,
          project_id: project.id,
          project_name: project.name,
        });
      });
    });
    return tasks;
  }, [allUserProjects]);

  // --- Теперь можно использовать в allTags ---

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

    return Array.from(tagSet)
      .filter(Boolean)
      .sort()
      .map(tag => ({ value: tag, label: tag }));
  }, [activeTab, currentProject, currentProjectTasks, allOrganizationTasks, allUserTasks]);

  // --- Фильтрация и сортировка ---

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

  const assigneesMap = useMemo(() => {
    if (!currentProject?.members) return {};

    const map: { [key: string]: any[] } = {};
    sortedTasks.forEach(task => {
      map[task.id] = currentProject.members
        .filter(m => task.assignees?.includes(m.user_id))
        .map(m => m.profile);
    });
    return map;
  }, [currentProject?.members, sortedTasks]);

  const tabs = [
    ...(currentProject ? [{ id: 'project', label: 'Задачи проекта' }] : []),
    ...(currentProject ? [{ id: 'organization', label: 'Задачи организации' }] : []),
    { id: 'user', label: 'Все задачи' },
  ];

  // --- Обработчики ---

  const handleStatusChange = async (taskId: string, newStatus: 'todo' | 'in_progress' | 'done') => {
    try {
      await taskService.updateTaskStatus(taskId, newStatus);
      await refreshProjects();
    } catch (err) {
      console.error('Ошибка обновления статуса задачи:', err);
    }
  };

  const handleUpdateTask = async (taskId: string, data: EditTaskData) => {
    try {
      await taskService.updateTask(taskId, data);
      await refreshProjects();
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

  // --- Рендеринг вида ---

  const renderTaskView = () => {
    if (viewMode === 'calendar') {
      return (
        <CalendarView
          tasks={sortedTasks}
          onEditTask={handleEditTask}
          assigneesMap={assigneesMap}
        />
      );
    }

    if (viewMode === 'kanban') {
      return (
        <div className={styles['task-board__kanban']}>
          {(['todo', 'in_progress', 'done'] as const).map(status => (
            <div key={status} className={styles['task-board__column']}>
              <h4>
                {status === 'todo' ? 'Не начата' :
                 status === 'in_progress' ? 'В процессе' : 'Готово'}
              </h4>
              {sortedTasks
                .filter(t => t.status === status)
                .map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onStatusChange={handleStatusChange}
                    onEdit={handleEditTask}
                    assignees={assigneesMap[task.id] || []}
                  />
                ))}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className={styles['task-board__list']}>
        {sortedTasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            onStatusChange={handleStatusChange}
            onEdit={handleEditTask}
            assignees={assigneesMap[task.id] || []}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={styles['task-board__board']}>
      <div className={styles['task-board__header']}>
        <h3 className={styles['task-board__title']}>Задачи</h3>

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
          />

          <Select
            value={filters.tags}
            onChange={value => updateFilters({ tags: value as string[] })}
            options={allTags}
            placeholder="Фильтр по тегам"
            className={styles['task-board__filter']}
            multiple
            hasSearch
          />

          <Select
            value={filters.sortBy}
            onChange={value => updateFilters({ sortBy: value as 'date' | 'title' })}
            options={[
              { value: 'date', label: 'По дате' },
              { value: 'title', label: 'По названию' },
            ]}
            placeholder="Сортировка"
            className={styles['task-board__filter']}
          />

          <Button
            variant="secondary"
            size="small"
            onClick={() =>
              updateFilters({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })
            }
            aria-label={
              filters.sortOrder === 'asc' ? 'По возрастанию' : 'По убыванию'
            }
          >
            {filters.sortOrder === 'asc' ? '↑' : '↓'}
          </Button>
        </div>
      </div>

      {loadingAllProjects ? (
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
          {renderTaskView()}
        </>
      )}

      {isEditModalOpen && editingTask && (
        <EditTaskModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingTask(null);
          }}
          task={editingTask}
          refreshProjects={refreshProjects}
        />
      )}
    </div>
  );
};

export default TaskBoard;
