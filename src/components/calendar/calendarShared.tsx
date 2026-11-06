import React, { useCallback, useMemo } from 'react';
import { DatePicker } from 'antd';
import type { View } from 'react-big-calendar';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

/** Day-header cell for the compact mobile week view ("MO" over the day number). */
export const MobileDayHeader: React.FC<{ date: Date }> = ({ date: headerDate }) => {
  const isToday = dayjs(headerDate).isSame(dayjs(), 'day');
  return (
    <div className="mobile-week-header">
      <span className="mobile-week-header-day">{dayjs(headerDate).format('ddd').slice(0, 2).toUpperCase()}</span>
      <span className={`mobile-week-header-num${isToday ? ' mobile-week-header-today' : ''}`}>
        {dayjs(headerDate).format('D')}
      </span>
    </div>
  );
};

/** Highlights the current hour slot in the time grid. */
export const currentHourSlotPropGetter = (date: Date) => {
  const now = new Date();
  if (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate() &&
    date.getHours() === now.getHours()
  ) {
    return { style: { backgroundColor: 'rgba(22, 119, 255, 0.18)' } };
  }
  return {};
};

/** Scroll target (08:00) and visible range (whole day) for the calendars' time grid. */
export function useCalendarHours() {
  const scrollTo8AM = useMemo(() => { const d = new Date(); d.setHours(8, 0, 0, 0); return d; }, []);
  const minTime = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const maxTime = useMemo(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; }, []);
  return { scrollTo8AM, minTime, maxTime };
}

type CalendarNamespace = 'calendarView' | 'lotCalendarView';

/**
 * The desktop and mobile toolbars shared by both calendars. They differ only in the i18n
 * namespace, so each calendar passes its own. The returned functions change identity when the
 * date changes (as the inline versions did), which react-big-calendar relies on to re-render.
 */
export function useCalendarToolbars(ns: CalendarNamespace, date: Date, setDate: (d: Date) => void) {
  const { t } = useTranslation();

  const DesktopToolbar = useCallback((tb: any) => (
    <div className="desktop-toolbar">
      <div className="desktop-toolbar-nav">
        <button onClick={() => tb.onNavigate('TODAY')}>{t(`${ns}.toolbar.today`)}</button>
        <button onClick={() => tb.onNavigate('PREV')}>‹</button>
        <button onClick={() => tb.onNavigate('NEXT')}>›</button>
      </div>
      <span className="desktop-toolbar-label">{tb.label}</span>
      <div className="desktop-toolbar-right">
        <DatePicker
          size="small"
          value={dayjs(date)}
          onChange={(d) => { if (d) setDate(d.toDate()); }}
          allowClear={false}
          inputReadOnly
          style={{ width: 120 }}
        />
        <div className="desktop-toolbar-views">
          {tb.views.map((v: View) => (
            <button key={v} className={tb.view === v ? 'rbc-active' : ''} onClick={() => tb.onView(v)}>
              {t(`${ns}.viewNames.${v}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  ), [ns, date, setDate, t]);

  const MobileToolbar = useCallback((tb: any) => (
    <div className="mobile-toolbar">
      <div className="mobile-toolbar-nav">
        <button onClick={() => tb.onNavigate('TODAY')}>{t(`${ns}.toolbar.today`)}</button>
        <button onClick={() => tb.onNavigate('PREV')}>‹</button>
        <button onClick={() => tb.onNavigate('NEXT')}>›</button>
      </div>
      <span className="mobile-toolbar-label">{tb.label}</span>
      <div className="mobile-toolbar-right">
        <DatePicker
          size="small"
          value={dayjs(date)}
          onChange={(d) => { if (d) setDate(d.toDate()); }}
          allowClear={false}
          inputReadOnly
          style={{ width: 110 }}
        />
        <div className="mobile-toolbar-views">
          {tb.views.map((v: View) => (
            <button key={v} className={tb.view === v ? 'rbc-active' : ''} onClick={() => tb.onView(v)}>
              {v === 'week' ? t(`${ns}.toolbar.weekShort`) : t(`${ns}.viewNames.${v}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  ), [ns, date, setDate, t]);

  return { DesktopToolbar, MobileToolbar };
}
