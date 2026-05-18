"""
ACAI Agent Configuration with model-tier support.

Three tiers controlled by MODEL_TIER env var:
  - FULL    : qwen2.5:7b for everything except لغوي (~16 GB active RAM)
  - LITE    : qwen2.5:3b for most agents, bahraini-pro for لغوي (~6 GB)
  - MOBILE  : qwen2.5:1.5b for most agents, bahraini-pro for لغوي (~3 GB)

لغوي (Language Expert) ALWAYS uses bahraini-pro because it's the
academic differentiator (87.5% ABBL benchmark claim).

Vision model (moondream) is configured separately in .env.
"""
import os

# ─── TIER SELECTION ───────────────────────────────────────────
MODEL_TIER = os.getenv("MODEL_TIER", "LITE").upper()

# ─── PER-TIER MODEL MAPS ──────────────────────────────────────
# bahraini-pro is the ALWAYS choice for لغوي across all tiers.

TIER_MODELS = {
    "FULL": {
        "primary":  "qwen2.5:7b-instruct-q4_K_M",  # 4.7 GB
        "fast":     "qwen2.5:7b-instruct-q4_K_M",
        "bahraini": "bahraini-pro:latest",          # 9 GB - keep
    },
    "LITE": {
        "primary":  "qwen2.5:3b",                   # 1.9 GB
        "fast":     "qwen2.5:3b",
        "bahraini": "bahraini-pro:latest",
    },
    "MOBILE": {
        "primary":  "qwen2.5:1.5b",                 # 1.0 GB
        "fast":     "qwen2.5:1.5b",
        "bahraini": "bahraini-pro:latest",
    },
}

# Fall back to LITE if env var is invalid
_models = TIER_MODELS.get(MODEL_TIER, TIER_MODELS["LITE"])

PRIMARY_MODEL  = _models["primary"]
FAST_MODEL     = _models["fast"]
BAHRAINI_MODEL = _models["bahraini"]

# ─── AGENT → MODEL ROUTING ────────────────────────────────────
AGENT_MODEL_MAP = {
    "bahith":   PRIMARY_MODEL,    # Researcher
    "hakeem":   PRIMARY_MODEL,    # Reasoner
    "musheer":  PRIMARY_MODEL,    # GCC Advisor
    "lughawi":  BAHRAINI_MODEL,   # Language Expert (always bahraini-pro)
    "muraqib":  FAST_MODEL,       # Fact Checker (can be faster)
    "bani":     PRIMARY_MODEL,    # Knowledge Builder
    "orchestrator": FAST_MODEL,   # Router classification
}

# ─── AGENT METADATA (used by frontend agent cards) ────────────
AGENT_METADATA = {
    "bahith": {
        "ar": "باحث", "en": "Researcher",
        "model": PRIMARY_MODEL,
        "description": "Web search with source citations",
    },
    "hakeem": {
        "ar": "حكيم", "en": "Reasoner",
        "model": PRIMARY_MODEL,
        "description": "Deep step-by-step reasoning",
    },
    "musheer": {
        "ar": "مشير", "en": "GCC Advisor",
        "model": PRIMARY_MODEL,
        "description": "CBB, SAMA, UAECB, Vision 2030",
    },
    "lughawi": {
        "ar": "لغوي", "en": "Arabic Expert",
        "model": BAHRAINI_MODEL,  # the academic claim
        "description": "Bahraini dialect + MSA + morphology",
    },
    "muraqib": {
        "ar": "مراقب", "en": "Fact Checker",
        "model": FAST_MODEL,
        "description": "Verification with confidence scoring",
    },
    "bani": {
        "ar": "بانِ", "en": "Knowledge Graph",
        "model": PRIMARY_MODEL,
        "description": "Entity + triple extraction",
    },
}

# ─── SYSTEM PROMPTS (unchanged from your existing) ─────────────
# Your existing prompts go here — this file replaces ONLY the
# model routing. Keep your system prompt strings as they are.
#
# If your current agent_config.py has SYSTEM_PROMPTS dict, paste
# it below this line. The model routing above will replace the
# model selection logic only.


def get_model_for_agent(agent_id: str) -> str:
    """Return the Ollama model name for a given agent ID."""
    return AGENT_MODEL_MAP.get(agent_id, PRIMARY_MODEL)


def get_tier_info() -> dict:
    """Return current tier info — exposed via /health for the frontend."""
    return {
        "tier": MODEL_TIER,
        "primary": PRIMARY_MODEL,
        "fast": FAST_MODEL,
        "bahraini": BAHRAINI_MODEL,
        "available_tiers": list(TIER_MODELS.keys()),
    }
