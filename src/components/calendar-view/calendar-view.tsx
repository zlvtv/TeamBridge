import React, { useMemo, useState } from 'react';
import { format, parseISO, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, subWeeks, addWeeks, startOfMonth, endOfMonth, isWithinInterval, subMonths, addMonths, isSameMonth } from 'date-fns';
import { ru } from 'date-fns/locale';
import styles from './calendar-view.module.css';

interface CalendarViewProps {
  tasks: any[];
  assignees: { [key: string]: any[] };
}

const CalendarView: React.FC<CalendarViewProps> = ({ tasks, assignees }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'week' | 'month'>('week');
  const weekDays = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [currentDate]);

  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const displayedDays = view === 'week' ? weekDays : monthDays;

  const tasksByDay = useMemo(() => {
    return displayedDays.map(day => {
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
  }, [tasks, displayedDays]);

  const hasTasks = useMemo(() => {
    return tasksByDay.some(day => day.tasks.length > 0);
  }, [tasksByDay]);

  const formatInterval = () => {
    if (view === 'week') {
      return `${format(displayedDays[0], 'd MMM', { locale: ru })} - ${format(displayedDays[6], 'd MMM yyyy', { locale: ru })}`;
    } else {
      return format(currentDate, 'LLLL yyyy', { locale: ru }).replace('мая', 'май').replace('января', 'январь').replace('февраля', 'февраль');
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    if (view === 'week') {
      setCurrentDate(prev => 
        direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1)
      );
    } else {
      setCurrentDate(prev => 
        direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1)
      );
    }
  };

  const weeksInMonth = [];
  if (view === 'month') {
    for (let i = 0; i < monthDays.length; i += 7) {
      weeksInMonth.push(monthDays.slice(i, i + 7));
    }
  }

  return (
    <div className={styles.calendar}>
      <div className={styles.navigation}>
        <button 
          className={styles.navButton} 
          onClick={() => navigateDate('prev')}
          aria-label="Previous week"
        >
          ←
        </button>
        
        <div className={styles.weekRange}>{formatInterval()}</div>
        
        <button 
          className={styles.navButton} 
          onClick={() => navigateDate('next')}
          aria-label="Next week"
        >
          →
        </button>
        
        <div className={styles.viewToggle}>
          <button 
            className={`${styles.viewButton} ${view === 'week' ? styles.active : ''}`} 
            onClick={() => setView('week')}
          >
            Неделя
          </button>
          <button 
            className={`${styles.viewButton} ${view === 'month' ? styles.active : ''}`} 
            onClick={() => setView('month')}
          >
            Месяц
          </button>
        </div>
      </div>
      
      <div className={styles.header}>
        {view === 'week' ? (
          weekDays.map((day) => (
            <div key={day.toISOString()} className={styles.dayHeader}>
              <div className={styles.dayName}>
                {format(day, 'EEE', { locale: ru })}
              </div>
              <div className={styles.dayNumber}>
                {format(day, 'd')}
              </div>
            </div>
          ))
        ) : (
          ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day, index) => (
            <div key={index} className={styles.dayHeader}>
              <div className={styles.dayName}>
                {day}
              </div>
            </div>
          ))
        )}
      </div>

      <div className={styles.body}>
        {view === 'week' ? (
          <div className={styles.weekRow}>
            {tasksByDay.map(({ day, tasks }) => (
              <div key={day.toISOString()} className={styles.dayColumn}>
                {tasks.length === 0 ? (
                  <div className={styles.empty}></div>
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
            ))}
          </div>
        ) : (
          <div className={styles.monthGrid}>
            {weeksInMonth.map((week, weekIndex) => (
              <div key={weekIndex} className={styles.weekRow}>
                {week.map((day) => {
                  const dayTasks = tasksByDay.find(tb => isSameDay(tb.day, day));
                  return (
                    <div key={day.toISOString()} className={`${styles.dayColumn} ${!isSameMonth(day, currentDate) ? styles.outside : ''}`}>
                      <div className={`${styles.dayNumber} ${!isSameMonth(day, currentDate) ? styles.outside : ''}`}>{format(day, 'd')}</div>
                      {dayTasks && dayTasks.tasks.length > 0 ? (
                        dayTasks.tasks.map((task) => (
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
                      ) : (
                        <div className={styles.empty}></div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
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
