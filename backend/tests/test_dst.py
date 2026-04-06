import pytest
from datetime import datetime
import datetime as dt_mod
try:
    import zoneinfo
except ImportError:
    from backports import zoneinfo

def test_dst_spring_forward_naive():
    """
    Verification of naive math on DST spring forward.
    In 2026, Israel jumps 02:00 -> 03:00 on March 27.
    """
    # Current codebase math:
    start_str = "2026-03-27 01:00"
    duration = 2
    
    start_dt = datetime.strptime(start_str, "%Y-%m-%d %H:%M")
    end_dt = start_dt + dt_mod.timedelta(hours=duration)
    
    # Naive math fails (01:00 + 2h = 03:00), ignoring the missing hour.
    assert end_dt.strftime("%H:%M") == "03:00"

def test_dst_spring_forward_aware():
    """
    Verification using timezone-aware logic (correct way).
    """
    try:
        tz = zoneinfo.ZoneInfo("Asia/Jerusalem")
        
        start_str = "2026-03-27 01:00"
        duration = 2
        
        # 1. Create a UTC-aware datetime first (Absolute time)
        # Or create localized then convert to UTC
        start_dt_naive = datetime.strptime(start_str, "%Y-%m-%d %H:%M")
        start_dt = start_dt_naive.replace(tzinfo=tz)
        
        # 2. To correctly add ELAPSED hours, we should normally convert to UTC, add, then back.
        # But aware + timedelta in Python is supposed to handle it if the tz handles it.
        # However, to be extra safe across platforms:
        start_utc = start_dt.astimezone(dt_mod.timezone.utc)
        end_utc = start_utc + dt_mod.timedelta(hours=duration)
        end_dt = end_utc.astimezone(tz)
        
        # 01:00 + 2h ELAPSED should land on 04:00 local time 
        # (because 02:00 was skipped by the gap)
        assert end_dt.strftime("%H:%M") == "04:00"
    except (zoneinfo.ZoneInfoNotFoundError, ModuleNotFoundError):
        pytest.skip("Asia/Jerusalem timezone info not found in zoneinfo registry")
