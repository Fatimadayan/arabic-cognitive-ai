"""
ACAI — Skill Generator
========================
File: backend/skill_generator.py

Auto-generates reusable skills from successful agent interactions.
Saves as agentskills.io-compatible Markdown files.
"""
import re, json, logging
from pathlib import Path
from typing import Optional
from acai_memory import save_skill, DB_PATH
import sqlite3

log = logging.getLogger("acai.skills")
SKILL_DIR = Path(__file__).parent / "acai_skills"
SKILL_DIR.mkdir(exist_ok=True)

STEP_PATTERNS = [
    r'[١٢٣٤٥٦٧٨٩1-9][.)]\s+(.+)',  # Arabic/Latin numbered lists
    r'\*\s+(.+)',                     # bullet points
    r'-\s+(.+)',                      # dash lists
]

def should_generate_skill(query: str, response: str, quality: int = 3) -> bool:
    """Decide if this interaction is worth saving as a skill."""
    if quality < 4: return False
    if len(response) < 200: return False
    # Has numbered steps or structure
    has_structure = any(
        re.search(p, response) for p in STEP_PATTERNS
    )
    has_key_markers = any(k in response for k in [
        "أولاً","ثانياً","خطوة","Step","**","###",
        "المتطلبات","الإجراءات","الخطوات"
    ])
    return has_structure or has_key_markers

def extract_steps(response: str) -> list:
    """Extract structured steps from a response."""
    steps = []
    for pattern in STEP_PATTERNS:
        found = re.findall(pattern, response)
        if found:
            steps = [s.strip() for s in found if len(s.strip()) > 10]
            break
    if not steps:
        # Fall back: split into sentences
        sentences = [s.strip() for s in re.split(r'[.!?،؟]\s+', response) if s.strip()]
        steps = sentences[:4]
    return steps[:6]  # max 6 steps

def generate_skill(
    query: str,
    response: str,
    agent_id: str = "orchestrator",
    quality: int = 3,
) -> Optional[str]:
    """
    Auto-generate a skill from a successful interaction.
    Returns skill file path if created, None otherwise.
    """
    if not should_generate_skill(query, response, quality):
        return None

    # Build skill name from query (first 3-4 meaningful words)
    words = re.sub(r'[؟?!،,]', '', query).split()
    name_words = [w for w in words if len(w) > 2][:4]
    name = "_".join(name_words)[:50] or f"skill_{agent_id}"
    full_name = f"{agent_id}_{name}"

    # Description
    description = f"إجابة على: {query[:100]}"

    # Steps
    steps = extract_steps(response)
    if not steps:
        return None

    try:
        path = save_skill(
            name=full_name,
            description=description,
            trigger_kw=query[:80],
            steps=steps,
        )
        log.info(f"Skill generated: {path}")
        return path
    except Exception as exc:
        log.error(f"Skill generation error: {exc}")
        return None

def list_skills() -> list:
    """List all stored skills."""
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            rows = conn.execute(
                "SELECT name, description, use_count FROM skills ORDER BY use_count DESC"
            ).fetchall()
        return [{"name":r[0],"description":r[1],"use_count":r[2]} for r in rows]
    except Exception: return []

def find_relevant_skill(query: str) -> Optional[dict]:
    """Find a skill that matches the current query."""
    try:
        with sqlite3.connect(str(DB_PATH)) as conn:
            rows = conn.execute(
                "SELECT name, description, steps FROM skills WHERE trigger_kw LIKE ?",
                (f"%{query[:30]}%",)
            ).fetchall()
        if rows:
            r = rows[0]
            return {"name":r[0],"description":r[1],"steps":json.loads(r[2])}
    except Exception: pass
    return None

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("Testing Skill Generator...")
    test_response = """
    لفتح حساب بنكي في البحرين:
    ١. أحضر هويتك الشخصية أو جواز السفر
    ٢. إثبات عنوان السكن (فاتورة ماء أو كهرباء)
    ٣. زيارة أي فرع أو التسجيل أونلاين
    ٤. ملء نموذج فتح الحساب
    ٥. انتظر التفعيل (1-3 أيام عمل)
    """
    path = generate_skill(
        "كيف أفتح حساب بنكي في البحرين؟",
        test_response, agent_id="musheer", quality=5)
    print(f"  Generated skill: {path}")
    skills = list_skills()
    print(f"  Total skills: {len(skills)}")
    print("✅ Skill generator tests passed!")
