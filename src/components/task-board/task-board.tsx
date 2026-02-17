import React, { useState, useMemo } from 'react';
import styles from './task-board.module.css';
import { useProject } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/AuthContext';
import TaskCard from '../task-card/task-card';
import Button from '../ui/button/button';
import Select from '../ui/select/select';
import CalendarView from '../calendar-view/calendar-view';
import { TaskTab } from '../../types/task.types';
import EditTaskModal from '../modals/edit-task-modal/edit-task-modal';
import { Task } from '../../types/task.types';
import { updateDocById } from '../../lib/firestore';

interface EditTaskData {
  title: string;
  description: string | null;
  due_date: string | null;
  assignee_ids: string[];
  tags: string[];
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'done';
}

const TaskBoard: React.FC = () => {
  const { currentProject, refreshProjects, projects } = useProject();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TaskTab | 'calendar'>('project');
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    search: '',
  });

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const hasProject = !!currentProject;

  const allOrganizationTasks = useMemo(() => {
    if (!currentProject?.organization_id) return [];
    
    const allTasks: Task[] = [];
    
    projects.forEach(project => {
      
      if (project.id !== currentProject.id) { 
        project.tasks.forEach(task => {
          const taskWithProject = {
            ...task,
            project_id: project.id,
            project_name: project.name 
          };
          allTasks.push(taskWithProject);
        });
      }
    });
    
    return allTasks;
  }, [projects, currentProject]);

  const tasks = hasProject ? currentProject.tasks : [];

  const filteredTasks = useMemo(() => {
    if (!hasProject) return [];
    
    let filtered: Task[] = [];
    
    if (activeTab === 'project') {
      filtered = tasks.filter(task => task.project_id === currentProject?.id);
    } else if (activeTab === 'user') {
      filtered = tasks;
    } else if (activeTab === 'organization' && currentProject?.organization_id) {
      filtered = allOrganizationTasks;
    } else if (activeTab === 'calendar') {
      filtered = tasks;
    }

    const filteredBySearch = filtered.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(filters.search.toLowerCase());
      const matchesStatus = !filters.status || task.status === filters.status;
      const matchesPriority = !filters.priority || task.priority === filters.priority;
      return matchesSearch && matchesStatus && matchesPriority;
    });
    
    return filteredBySearch;
  }, [hasProject, tasks, filters, activeTab, currentProject?.id, currentProject?.organization_id, allOrganizationTasks]);

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
    { id: 'calendar', label: 'Календарь' },
  ];

  const handleStatusChange = async (taskId: string, newStatus: 'todo' | 'in_progress' | 'done') => {
    try {
      await updateDocById('tasks', taskId, { status: newStatus, updated_at: new Date().toISOString() });
      await refreshProjects();
    } catch (err) {
      console.error('Ошибка обновления статуса задачи:', err);
    }
  };

  const handleEditTask = (task: Task) => {
    if (!task.assignees || task.assignees.length === 0) {
      console.error('Задача не имеет ответственных');
      return;
    }
    setEditingTask(task);
    setIsEditModalOpen(true);
  };

  const handleUpdateTask = async (taskId: string, data: EditTaskData) => {
    try {
      await updateDocById('tasks', taskId, { ...data, updated_at: new Date().toISOString() });
      await refreshProjects();
    } catch (err) {
      console.error('Ошибка обновления задачи:', err);
    }
  };

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
                onStatusChange={(newStatus) => handleStatusChange(task.id, newStatus)}
                onEdit={() => handleEditTask(task)}
                tags={task.tags || []}
                priority={task.priority || 'medium'}
                dueDate={task.due_date}
              />
            ))
          )}
        </div>
      )}

      {isEditModalOpen && editingTask && (
        <EditTaskModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingTask(null);
          }}
          task={editingTask}
          onUpdate={handleUpdateTask}
          refreshProjects={refreshProjects}
        />
      )}
    </div>
  );
};

export default TaskBoard;
