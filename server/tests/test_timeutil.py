from datetime import date, datetime

from app.timeutil import parse_date_arg, spoken_time

TODAY = date(2026, 11, 25)  # a Wednesday


def test_parse():
    assert parse_date_arg("2026-11-27", TODAY) == date(2026, 11, 27)
    assert parse_date_arg("tomorrow", TODAY) == date(2026, 11, 26)
    assert parse_date_arg("Friday", TODAY) == date(2026, 11, 27)
    assert parse_date_arg("wednesday", TODAY) == TODAY


def test_spoken_time():
    assert spoken_time(datetime(2026, 1, 1, 10, 0)) == "10 AM"
    assert spoken_time(datetime(2026, 1, 1, 17, 30)) == "5:30 PM"
    assert spoken_time(datetime(2026, 1, 1, 12, 0)) == "12 PM"
