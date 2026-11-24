from app.phone import normalize_phone, spoken_phone


def test_plain_and_formatted():
    assert normalize_phone("9876543210") == "9876543210"
    assert normalize_phone("+91 98765-43210") == "9876543210"
    assert normalize_phone("098765 43210") == "9876543210"


def test_words_and_double():
    assert normalize_phone("nine eight seven six five four three two one zero") == "9876543210"
    assert normalize_phone("double nine 8 7 6 5 4 3 2 1") == "9987654321"


def test_invalid():
    assert normalize_phone("12345") is None
    assert normalize_phone(None) is None


def test_spoken():
    assert spoken_phone("9876543210") == "9 8 7 6 5, 4 3 2 1 0"
