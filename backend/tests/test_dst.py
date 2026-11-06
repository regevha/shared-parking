"""
Daylight-saving behaviour of request time calculation.

The app deliberately works in naive local wall-clock time: end = start + duration on the clock face, with no
timezone conversion (schemas.ParkingRequestCreate and the PATCH handler in routers/requests.py). These tests
pin that contract against the real schema code, so a change to the calculation (for example switching to
elapsed-time maths) shows up as a deliberate test change rather than a silent behaviour change.

The schema rejects past dates, so "today" is frozen at 2026-01-01 to keep these fixed DST dates valid forever.
"""

import datetime as dt

import pytest
from pydantic import ValidationError

import schemas
from schemas import ParkingRequestCreate


@pytest.fixture(autouse=True)
def _frozen_today(monkeypatch):
    class _FrozenDate(dt.date):
        @classmethod
        def today(cls):
            return cls(2026, 1, 1)

    monkeypatch.setattr(schemas, "DateType", _FrozenDate)


def _build(**overrides):
    payload = {"date": "2026-03-27", "start_time": "01:00", "duration": 2}
    payload.update(overrides)
    return ParkingRequestCreate(**payload)


def test_spring_forward_end_time_is_wall_clock():
    """Israel skips 02:00-03:00 on 2026-03-27: the app still reports 01:00 + 2h as 03:00 (wall clock)."""
    req = _build(date="2026-03-27", start_time="01:00", duration=2)
    assert (req.end_date, req.end_time) == ("2026-03-27", "03:00")


def test_fall_back_end_time_is_wall_clock():
    """Israel repeats 01:00-02:00 on 2026-10-25: the app still reports 00:00 + 3h as 03:00 (wall clock)."""
    req = _build(date="2026-10-25", start_time="00:00", duration=3)
    assert (req.end_date, req.end_time) == ("2026-10-25", "03:00")


def test_request_crossing_midnight_on_dst_day_rolls_end_date():
    req = _build(date="2026-03-27", start_time="22:00", duration=5)
    assert (req.end_date, req.end_time) == ("2026-03-28", "03:00")


def test_maximum_duration_spans_the_dst_change_by_wall_clock():
    """36h starting the evening before the change ends exactly 36 wall-clock hours later."""
    req = _build(date="2026-03-26", start_time="12:00", duration=36)
    assert (req.end_date, req.end_time) == ("2026-03-28", "00:00")


def test_explicit_end_matching_wall_clock_duration_is_accepted():
    req = _build(end_date="2026-03-27", end_time="03:00")
    assert req.end_time == "03:00"


def test_explicit_end_using_elapsed_time_is_rejected():
    """04:00 would be the real elapsed time across the gap; the app's contract is wall clock, so it refuses it."""
    with pytest.raises(ValidationError, match="do not match duration"):
        _build(end_date="2026-03-27", end_time="04:00")
