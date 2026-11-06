import dayjs from 'dayjs';
import { isFromYesterdayOnward, isBeforeToday } from '../dates';

const fmt = (n: number) => dayjs().add(n, 'day').format('YYYY-MM-DD');

describe('isFromYesterdayOnward', () => {
  it('keeps yesterday, today and the future', () => {
    expect(isFromYesterdayOnward(fmt(-1))).toBe(true);
    expect(isFromYesterdayOnward(fmt(0))).toBe(true);
    expect(isFromYesterdayOnward(fmt(7))).toBe(true);
  });
  it('drops the day before yesterday and older', () => {
    expect(isFromYesterdayOnward(fmt(-2))).toBe(false);
    expect(isFromYesterdayOnward(fmt(-30))).toBe(false);
  });
});

describe('isBeforeToday', () => {
  it('is true for yesterday and false for today or later', () => {
    expect(isBeforeToday(dayjs().subtract(1, 'day'))).toBe(true);
    expect(isBeforeToday(dayjs())).toBe(false);
    expect(isBeforeToday(dayjs().add(1, 'day'))).toBe(false);
  });
});
