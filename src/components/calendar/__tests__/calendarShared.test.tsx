import React from 'react';
import { render, screen, fireEvent, renderHook } from '@testing-library/react';
import dayjs from 'dayjs';
import { MobileDayHeader, currentHourSlotPropGetter, useCalendarHours, useCalendarToolbars } from '../calendarShared';

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  DatePicker: () => <input data-testid="date-picker" type="date" readOnly />,
}));

describe('MobileDayHeader', () => {
  it('shows the two-letter weekday and the day number, marking today', () => {
    render(<MobileDayHeader date={new Date()} />);
    expect(screen.getByText(dayjs().format('D')).className).toContain('mobile-week-header-today');
    expect(screen.getByText(dayjs().format('ddd').slice(0, 2).toUpperCase())).toBeInTheDocument();
  });
  it('does not mark other days as today', () => {
    render(<MobileDayHeader date={dayjs().add(3, 'day').toDate()} />);
    expect(screen.getByText(dayjs().add(3, 'day').format('D')).className).not.toContain('today');
  });
});

describe('currentHourSlotPropGetter', () => {
  it('highlights the current hour only', () => {
    expect(currentHourSlotPropGetter(new Date())).toEqual({ style: { backgroundColor: 'rgba(22, 119, 255, 0.18)' } });
    expect(currentHourSlotPropGetter(dayjs().add(2, 'hour').toDate())).toEqual({});
    expect(currentHourSlotPropGetter(dayjs().add(1, 'day').toDate())).toEqual({});
  });
});

describe('useCalendarHours', () => {
  it('returns 08:00 scroll target and a whole-day range', () => {
    const { result } = renderHook(() => useCalendarHours());
    expect(result.current.scrollTo8AM.getHours()).toBe(8);
    expect(result.current.minTime.getHours()).toBe(0);
    expect(result.current.maxTime.getHours()).toBe(23);
  });
});

describe('useCalendarToolbars', () => {
  const tb = (over = {}) => ({
    label: 'Nov 2026', views: ['week', 'day'], view: 'week',
    onNavigate: jest.fn(), onView: jest.fn(), ...over,
  });

  function setup(ns: 'calendarView' | 'lotCalendarView') {
    const setDate = jest.fn();
    const { result } = renderHook(() => useCalendarToolbars(ns, new Date(), setDate));
    return result.current;
  }

  it.each(['calendarView', 'lotCalendarView'] as const)('desktop toolbar navigates and switches view (%s)', ns => {
    const { DesktopToolbar } = setup(ns);
    const props = tb();
    render(<>{DesktopToolbar(props)}</>);
    fireEvent.click(screen.getByText('Today'));
    expect(props.onNavigate).toHaveBeenCalledWith('TODAY');
    fireEvent.click(screen.getByText('›'));
    expect(props.onNavigate).toHaveBeenCalledWith('NEXT');
    fireEvent.click(screen.getByText('Day'));
    expect(props.onView).toHaveBeenCalledWith('day');
    expect(screen.getByText('Nov 2026')).toBeInTheDocument();
  });

  it('mobile toolbar uses the short label for the week view', () => {
    const { MobileToolbar } = setup('calendarView');
    render(<>{MobileToolbar(tb())}</>);
    expect(screen.getByText('Wk')).toBeInTheDocument();
    expect(screen.queryByText('Week')).not.toBeInTheDocument();
    expect(screen.getByText('Day')).toBeInTheDocument();
  });
});
