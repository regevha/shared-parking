import dayjs from 'dayjs';

/** True when `date` is yesterday or later: list/calendar views hide anything older. */
export function isFromYesterdayOnward(date: string | Date | dayjs.Dayjs): boolean {
  return !dayjs(date).isBefore(dayjs().subtract(1, 'day').startOf('day'));
}

/** True for dates before today: used to disable past days in date pickers. */
export function isBeforeToday(date: dayjs.Dayjs): boolean {
  return date.isBefore(dayjs().startOf('day'));
}
