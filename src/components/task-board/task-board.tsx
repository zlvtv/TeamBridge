import React, { useState, useEffect, useMemo } from 'react';
import styles from './task-board.module.css';
import { useProject } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import TaskCard from '../task-card/task-card';
import Button from '../ui/button/button';
import Select from '../ui/select/select';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import CalendarView from '../calendar-view/calendar-view';

const TaskBoard: React.FC = () => {
  const { currentProject, refreshProjects } = useProject();
  const { user } = useAuth();

  const [tasks, setTasks] = useState<any[]>([]);
  const [assignees, setAssignees] = useState<{ [key: string]: any[] }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'my' | 'project' | 'calendar'>('my');

  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    search: '',
  });

  // Загрузка задач
  useEffect(() => {
    if (!currentProject) return;

    const fetchTasks = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error } = await supabase
          .from('tasks')
          .select(`
            id,
            title,
            description,
            created_at,
            due_date,
            status,
            priority,
            created_by,
            profiles (
              id,
              full_name,
              username,
              avatar_url
            ),
            task_assignees (
              user_id,
              profiles (
                id,
                full_name,
                username,
                avatar_url
              )
            )
          `)
          .eq('project_id', currentProject.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const tasksData = data || [];

        // Загрузим assignees для каждой задачи
        const assigneesMap: { [key: string]: any[] } = {};
        tasksData.forEach((task: any) => {
          assigneesMap[task.id] = task.task_assignees.map((ta: any) => ta.profiles);
        });

        setTasks(tasksData);
        setAssignees(assigneesMap);
      } catch (err: any) {
        setError('Ошибка загрузки задач');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTasks();
  }, [currentProject?.id]);

  // Подписка на изменения
  useEffect(() => {
    if (!currentProject) return;

    const channel = supabase
      .channel(`tasks:${currentProject.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${currentProject.id}`,
        },
        async (payload) => {
          const newTask = payload.new;
          const { data: assigneesData } = await supabase
            .from('task_assignees')
            .select('profiles (*)')
            .eq('task_id', newTask.id);

          const assigneesList = assigneesData?.map((ta: any) => ta.profiles) || [];

          setTasks((prev) => [newTask, ...prev]);
          setAssignees((prev) => ({
            ...prev,
            [newTask.id]: assigneesList,
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${currentProject.id}`,
        },
        (payload) => {
          setTasks((prev) =>
            prev.map((t) => (t.id === payload.new.id ? payload.new : t))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentProject?.id]);

  // Фильтрация задач
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch = task.title.toLowerCase().includes(filters.search.toLowerCase());
      const matchesStatus = !filters.status || task.status === filters.status;
      const matchesPriority = !filters.priority || task.priority === filters.priority;

      const isMyTask = activeTab === 'my'
        ? task.task_assignees.some((ta: any) => ta.user_id === user?.id)
        : true;

      return matchesSearch && matchesStatus && matchesPriority && isMyTask;
    });
  }, [tasks, filters, activeTab, user?.id]);

  const tabs = [
    { id: 'my', label: 'Мои задачи' },
    { id: 'project', label: 'Проект' },
    { id: 'calendar', label: 'Календарь' },
  ];

  if (!currentProject) {
    return <div className={styles.placeholder}>Выберите проект</div>;
  }

  return (
    <div className={styles.board}>
      <div className={styles.header}>
        <h3>Задачи</h3>

        <div className={styles.tabs}>
          {tabs.map((tab) => (
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
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className={styles.search}
          />

          <Select
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value as string })}
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
            onChange={(value) => setFilters({ ...filters, priority: value as string })}
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

      {error && <div className={styles.error}>{error}</div>}

      {isLoading ? (
        <div className={styles.loading}>Загрузка задач...</div>
      ) : activeTab === 'calendar' ? (
        <CalendarView tasks={filteredTasks} assignees={assignees} />
      ) : (
        <div className={styles.taskList}>
          {filteredTasks.length === 0 ? (
            <div className={styles.noTasks}>Нет задач по заданным фильтрам</div>
          ) : (
            filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                assignees={assignees[task.id] || []}
                onStatusChange={async (newStatus) => {
                  const { error } = await supabase
                    .from('tasks')
                    .update({ status: newStatus })
                    .eq('id', task.id);

                  if (error) {
                    setError('Ошибка обновления статуса');
                  } else {
                    setTasks((prev) =>
                      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
                    );
                  }
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default TaskBoard;
