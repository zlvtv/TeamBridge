import React from 'react';
import { format, parseISO, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';
import styles from './calendar-view.module.css';

interface CalendarViewProps {
  tasks: any[];
  assignees: { [key: string]: any[] };
}

const CalendarView: React.FC<CalendarViewProps> = ({ tasks, assignees }) => {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const tasksByDay = days.map((day) => ({
    day,
    tasks: tasks.filter((task) => {
      if (!task.due_date) return false;
      const taskDate = parseISO(task.due_date);
      return (
        taskDate.getDate() === day.getDate() &&
        taskDate.getMonth() === day.getMonth() &&
        taskDate.getFullYear() === day.getFullYear()
      );
    }),
  }));

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
        {tasksByDay.map(({ day, tasks }) => (
          <div key={day.toISOString()} className={styles.dayColumn}>
            {tasks.length === 0 ? (
              <div className={styles.empty}>Нет задач</div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className={`${styles.task} ${task.status === 'done' ? styles.done : ''}`}
                  style={{ borderColor: getPriorityColor(task.priority) }}
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
        ))}
      </div>
    </div>
  );
};

function getPriorityColor(priority: string) {
  return { low: '#38a169', medium: '#d69e2e', high: '#e53e3e' }[priority] || '#888';
}

export default CalendarView;
