import re
from typing import Any

from app.core.agent_config import AGENT_LABELS
from app.core.config import CONFIDENCE_THRESHOLD

ARABIC_REGEXP = re.compile(r"[\u0600-\u06FF]")


def verify_agent_output(agent_id: str, content: str) -> dict[str, Any]:
    issues: list[str] = []
    text = (content or "").strip()

    if not text:
        issues.append("empty_response")
        return {
            "agent_id": agent_id,
            "agent_name": AGENT_LABELS.get(agent_id, agent_id),
            "confidence": 0.0,
            "issues": issues,
        }

    words = len(text.split())
    arabic_present = bool(ARABIC_REGEXP.search(text))
    confidence = min(1.0, max(0.0, words / 20.0))

    if not arabic_present:
        issues.append("expected_arabic_but_found_non_arabic")
        confidence *= 0.5

    if words < 8:
        issues.append("short_response")
        confidence *= 0.75

    low_phrases = (
        "i don't know",
        "sorry",
        "cannot",
        "لا أستطيع",
        "ليس لدي",
        "لا أعرف",
    )
    if any(text.lower().startswith(phrase) for phrase in low_phrases):
        issues.append("low_certainty")
        confidence *= 0.6

    confidence = round(confidence, 3)
    if confidence < CONFIDENCE_THRESHOLD:
        issues.append("confidence_below_threshold")

    return {
        "agent_id": agent_id,
        "agent_name": AGENT_LABELS.get(agent_id, agent_id),
        "confidence": confidence,
        "issues": issues,
    }
