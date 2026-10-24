import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import useLoad from '../hooks/useLoad.js';
import Heading from '../components/common/Heading.jsx';

/**
 * Calendar Page Component
 * 
 * Displays monthly task deadlines in a Monday-first 42-day calendar matrix.
 * Allows direct navigation across months and click-to-create tasks on specific calendar days.
 */
export function Calendar({ refresh, onAdd }) {
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const { data } = useLoad('/tasks', refresh);

  // Compute 42-cell calendar grid starting on Monday
  const firstDayOfMonth = new Date(
    currentMonthDate.getFullYear(),
    currentMonthDate.getMonth(),
    1
  );
  const mondayOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const gridStartDate = new Date(firstDayOfMonth);
  gridStartDate.setDate(1 - mondayOffset);

  const calendarCells = Array.from({ length: 42 }, (_, index) => {
    const cellDate = new Date(gridStartDate);
    cellDate.setDate(gridStartDate.getDate() + index);
    return cellDate;
  });

  const tasksList = data?.tasks || [];
  const todayLocalDateStr = new Date().toLocaleDateString('en-CA');

  return (
    <>
      <Heading
        eyebrow="SEE THE BIG PICTURE"
        title="Calendar"
        sub="Tasks and deadlines, arranged around your time."
        action={
          <button
            type="button"
            className="primary-btn"
            onClick={() => onAdd(todayLocalDateStr)}
          >
            <Plus size={17} /> New task
          </button>
        }
      />

      <div className="panel calendar-panel">
        <div className="calendar-toolbar">
          <div>
            <h3>
              {currentMonthDate.toLocaleDateString(undefined, {
                month: 'long',
                year: 'numeric',
              })}
            </h3>
            <p>Monthly overview</p>
          </div>

          <div className="calendar-controls">
            <button
              type="button"
              className="secondary-btn"
              onClick={() => setCurrentMonthDate(new Date())}
            >
              Today
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() =>
                setCurrentMonthDate(
                  new Date(
                    currentMonthDate.getFullYear(),
                    currentMonthDate.getMonth() - 1,
                    1
                  )
                )
              }
            >
              <ChevronLeft size={17} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() =>
                setCurrentMonthDate(
                  new Date(
                    currentMonthDate.getFullYear(),
                    currentMonthDate.getMonth() + 1,
                    1
                  )
                )
              }
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>

        <div className="calendar-grid">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayLabel) => (
            <div className="calendar-weekday" key={dayLabel}>
              {dayLabel}
            </div>
          ))}

          {calendarCells.map((d, index) => {
            const dateStr = d.toLocaleDateString('en-CA');
            const dayTasks = tasksList.filter(
              (t) =>
                t.dueDate &&
                new Date(t.dueDate).toLocaleDateString('en-CA') === dateStr
            );
            const isOutsideMonth = d.getMonth() !== currentMonthDate.getMonth();
            const isCurrentToday = dateStr === todayLocalDateStr;

            return (
              <div
                className={`calendar-day ${isOutsideMonth ? 'outside' : ''} ${
                  isCurrentToday ? 'is-today' : ''
                }`}
                key={index}
              >
                <button
                  type="button"
                  className="calendar-date"
                  onClick={() => onAdd(dateStr)}
                >
                  {d.getDate()}
                </button>

                {dayTasks.slice(0, 3).map((t) => (
                  <button
                    type="button"
                    className={`calendar-task ${t.priority}`}
                    title={t.title}
                    key={t._id}
                    onClick={() => onAdd(dateStr)}
                  >
                    {t.title}
                  </button>
                ))}

                {dayTasks.length > 3 && (
                  <small>+{dayTasks.length - 3} more</small>
                )}
              </div>
            );
          })}
        </div>

        <div className="calendar-legend">
          <span>
            <i className="priority-dot urgent" />
            Urgent
          </span>
          <span>
            <i className="priority-dot high" />
            High
          </span>
          <span>
            <i className="priority-dot medium" />
            Medium
          </span>
          <span>
            <i className="priority-dot low" />
            Low
          </span>
        </div>
      </div>
    </>
  );
}

export default Calendar;
