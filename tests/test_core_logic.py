import pytest

# Logic Verification Functions
def _detect_language(text: str) -> str:
    ms_particles = {"nak", "minta", "hantar", "bagi", "saya", "boss", "lah", "ya"}
    en_markers = {"please", "want", "need", "deliver", "thank", "hello", "yes"}
    words = set(text.lower().split())
    if len(words & ms_particles) > len(words & en_markers):
        return "ms"
    return "en"

def _is_confirmation(text: str):
    affirmative = {"yes", "ya", "ok", "confirm", "setuju", "boleh"}
    negative = {"no", "nope", "cancel", "batal", "tidak", "tak", "x", "tak nak"}
    clean = text.strip().lower()
    if clean in affirmative or any(clean.startswith(k) for k in affirmative):
        return True
    if clean in negative or any(clean.startswith(k) for k in negative):
        return False
    return None

# --- QATD Unit Tests with Visible Output ---

def test_UT01_detect_bahasa_rojak():
    input_str = "Boss, nak hantar ayam"
    result = _detect_language(input_str)
    print(f"\n[UT-01] Input: '{input_str}' -> Actual Result: '{result}'")
    assert result == "ms"

def test_UT02_detect_english():
    input_str = "Please deliver tomorrow"
    result = _detect_language(input_str)
    print(f"\n[UT-02] Input: '{input_str}' -> Actual Result: '{result}'")
    assert result == "en"

def test_UT03_confirm_affirmative():
    input_str = "Ok lah"
    result = _is_confirmation(input_str)
    print(f"\n[UT-03] Input: '{input_str}' -> Actual Result: {result}")
    assert result is True

def test_UT04_confirm_negative_slang():
    input_str = "tak nak"
    result = _is_confirmation(input_str)
    print(f"\n[UT-04] Input: '{input_str}' -> Actual Result: {result}")
    assert result is False
