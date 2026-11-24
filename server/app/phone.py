"""Phone number normalisation. The phone number is the ONLY caller identity."""
import re

_WORDS = {
    "zero": "0", "oh": "0", "o": "0", "one": "1", "two": "2", "three": "3", "four": "4",
    "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
}
_REPEAT = {"double": 2, "triple": 3}


def normalize_phone(raw) -> str | None:
    """Return a 10-digit string, or None if the input is not a valid number."""
    if raw is None:
        return None
    tokens = re.findall(r"[a-z]+|\d", str(raw).lower())
    digits: list[str] = []
    repeat = 1
    for tok in tokens:
        if tok in _REPEAT:
            repeat = _REPEAT[tok]
            continue
        digit = tok if tok.isdigit() else _WORDS.get(tok)
        if digit is not None:
            digits.append(digit * repeat)
        repeat = 1
    number = "".join(digits)
    if len(number) == 12 and number.startswith("91"):
        number = number[2:]
    elif len(number) == 11 and number.startswith("0"):
        number = number[1:]
    return number if len(number) == 10 else None


def spoken_phone(number: str) -> str:
    """'9876543210' -> '9 8 7 6 5, 4 3 2 1 0' (TTS reads it digit by digit with a pause)."""
    return f"{' '.join(number[:5])}, {' '.join(number[5:])}"


def display_phone(number: str) -> str:
    """'9876543210' -> '98765 43210' (for the dashboard)."""
    return f"{number[:5]} {number[5:]}"
