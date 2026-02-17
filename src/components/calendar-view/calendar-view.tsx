import React, { useMemo } from 'react';
import { format, parseISO, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import styles from './calendar-view.module.css';

interface CalendarViewProps {
  tasks: any[];
  assignees: { [key: string]: any[] };
}

const CalendarView: React.FC<CalendarViewProps> = ({ tasks, assignees }) => {
  const weekDays = useMemo(() => {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, []);

  const tasksByDay = useMemo(() => {
    return weekDays.map(day => {
      const dayTasks = tasks.filter(task => {
        if (!task.due_date) return false;
        
        let taskDate: Date | null = null;
        
        if (typeof task.due_date === 'string') {
          taskDate = parseISO(task.due_date);
        } else if (task.due_date?.toDate) {
          taskDate = task.due_date.toDate();
        }
        
        if (!taskDate || isNaN(taskDate.getTime())) return false;
        
        return isSameDay(taskDate, day);
      });
      
      return {
        day,
        tasks: dayTasks
      };
    });
  }, [tasks, weekDays]);

  const hasTasksThisWeek = useMemo(() => {
    return tasksByDay.some(day => day.tasks.length > 0);
  }, [tasksByDay]);

  return (
    <div className={styles.calendar}>
      <div className={styles.header}>
        {tasksByDay.map(({ day }) => (
          <div key={day.toISOString()} className={styles.dayHeader}>
            <div className={styles.dayName}>
              {format(day, 'EEE', { locale: ru })}
            </div>
            <div className={styles.dayNumber}>
              {format(day, 'd')}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.body}>
        {hasTasksThisWeek ? (
          tasksByDay.map(({ day, tasks }) => (
            <div key={day.toISOString()} className={styles.dayColumn}>
              {tasks.length === 0 ? (
                <div className={styles.empty}>Нет задач</div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`${styles.task} ${task.status === 'done' ? styles.done : ''}`}
                    style={{ borderColor: getPriorityColor(task.priority) }}
                    title={`Срок: ${format(parseISO(task.due_date), 'dd.MM.yyyy HH:mm')}`}
                  >
                    <div className={styles.taskTitle}>{task.title}</div>
                    <div className={styles.taskAssignees}>
                      {assignees[task.id]?.slice(0, 2).map((user) => (
                        <div
                          key={user.id}
                          className={styles.avatar}
                          style={{ backgroundImage: user.avatar_url ? `url(${user.avatar_url})` : 'none' }}
                        >
                          {!user.avatar_url && (
                            <span>{(user.full_name || user.username)?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                      ))}
                      {assignees[task.id]?.length > 2 && (
                        <div className={styles.avatarMore}>+{assignees[task.id].length - 2}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          ))
        ) : (
          <div className={styles.noTasksContainer}>
            <div className={styles.noTasksIcon}>🗓️</div>
            <div className={styles.noTasksTitle}>Нет задач на этой неделе</div>
            <div className={styles.noTasksSubtitle}>Добавьте задачи с датой выполнения, чтобы они отобразились в календаре</div>
          </div>
        )}
      </div>
    </div>
  );
};

function getPriorityColor(priority: string) {
  return { low: '#38a169', medium: '#d69e2e', high: '#e53e3e' }[priority] || '#888';
}

export default CalendarView;
