import React, { useState, useMemo } from 'react';
import styles from './task-board.module.css';
import { useProject } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/AuthContext';
import TaskCard from '../task-card/task-card';
import Button from '../ui/button/button';
import Select from '../ui/select/select';
import CalendarView from '../calendar-view/calendar-view';
import { TaskTab } from '../../types/task.types';
const TaskBoard: React.FC = () => {
  const { currentProject, refreshProjects } = useProject();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TaskTab>('project');
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    search: '',
  });

  const hasProject = !!currentProject;

  const tasks = hasProject ? currentProject.tasks : [];

  const filteredTasks = useMemo(() => {
    if (!hasProject) return [];

    let filtered = tasks;
    if (activeTab === 'project') {
      filtered = tasks.filter(task => task.project_id === currentProject?.id);
    } else if (activeTab === 'user') {
      filtered = tasks.filter(task => task.assignees?.includes(user?.id));
    }
    return filtered.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(filters.search.toLowerCase());
      const matchesStatus = !filters.status || task.status === filters.status;
      const matchesPriority = !filters.priority || task.priority === filters.priority;
      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [hasProject, tasks, filters, activeTab, currentProject?.id, user?.id]);

  const assigneesMap = useMemo(() => {
    if (!hasProject || !currentProject?.members) return {};
    
    const map: { [key: string]: any[] } = {};
    filteredTasks.forEach(task => {
      map[task.id] = currentProject.members
        .filter(m => task.assignees?.includes(m.user_id))
        .map(m => m.profile);
    });
    return map;
  }, [hasProject, filteredTasks, currentProject?.members]);

  const tabs = [
    { id: 'project', label: 'Задачи проекта' },
    { id: 'organization', label: 'Задачи организации' },
    { id: 'user', label: 'Все задачи' },
  ];

  if (!hasProject) {
    return <div className={styles.placeholder}>Выберите проект</div>;
  }

  return (
    <div className={styles.board}>
      <div className={styles.header}>
        <div className={styles.tabs}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
              onClick={() => setActiveTab(tab.id as any)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.controls}>
          <input
            type="text"
            placeholder="Поиск по названию..."
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
            className={styles.search}
          />

          <Select
            value={filters.status}
            onChange={value => setFilters({ ...filters, status: value as string })}
            options={[
              { value: '', label: 'Все статусы' },
              { value: 'todo', label: 'Не начата' },
              { value: 'in_progress', label: 'В процессе' },
              { value: 'done', label: 'Готово' },
            ]}
            placeholder="Статус"
            className={styles.filter}
          />

          <Select
            value={filters.priority}
            onChange={value => setFilters({ ...filters, priority: value as string })}
            options={[
              { value: '', label: 'Все приоритеты' },
              { value: 'low', label: 'Низкий' },
              { value: 'medium', label: 'Средний' },
              { value: 'high', label: 'Высокий' },
            ]}
            placeholder="Приоритет"
            className={styles.filter}
          />
        </div>
      </div>

      {activeTab === 'calendar' ? (
        <CalendarView tasks={filteredTasks} assignees={assigneesMap} />
      ) : (
        <div className={styles.taskList}>
          {filteredTasks.length === 0 ? (
            <div className={styles.noTasks}>Нет задач по заданным фильтрам</div>
          ) : (
            filteredTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                assignees={assigneesMap[task.id] || []}
                onStatusChange={async newStatus => {
                  console.log('Обновление статуса:', newStatus);
                }}
                tags={task.tags || []}
                priority={task.priority}
                dueDate={task.due_date}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default TaskBoard;
