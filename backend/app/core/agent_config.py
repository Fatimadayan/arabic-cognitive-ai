"""
ACAI Agent Configuration — FINAL with full Chinese-leak protection.

Model routing:
  - لغوي (Arabic Expert)  → bahraini-pro      (academic claim, kept)
  - حكيم (Reasoner)       → qwen2.5:7b        (no Chinese leak)
  - مراقب (Fact Checker)  → qwen2.5:7b        (no Chinese leak)
  - All others           → qwen2.5:3b         (LITE tier, cool)
"""
import os
from app.core.config import ARABIC_MODEL, FAST_MODEL, PRIMARY_MODEL, MODEL_TIER

LANG_LOCK_AR = """⚠️ قاعدة لغوية مطلقة:
- يجب أن تكون إجابتك بالكامل باللغة العربية فقط.
- ممنوع منعاً باتاً استخدام أي حرف صيني أو ياباني أو كوري.
- ممنوع منعاً باتاً استخدام كلمات إنجليزية إلا للأسماء التقنية الشائعة (AI, API).
- إذا فكرت في كلمة بلغة أخرى، ترجمها للعربية قبل الكتابة.

"""

LANG_LOCK_AR_FOOTER = """

⚠️ تذكير أخير قبل الكتابة:
- الإجابة بالعربية فقط، من أول حرف لآخر حرف.
- ممنوع أي حرف غير عربي إلا في الأسماء التقنية المعروفة."""

# Specific model overrides for agents that need Chinese-leak protection
HAKEEM_MODEL = os.getenv("HAKEEM_MODEL", "qwen2.5:7b-instruct-q4_K_M")
MURAQIB_MODEL = os.getenv("MURAQIB_MODEL", "qwen2.5:7b-instruct-q4_K_M")

USE_BAHRAINI_PRO = os.getenv("USE_BAHRAINI_PRO", "true").lower() == "true"
LUGHAWI_MODEL = ARABIC_MODEL if USE_BAHRAINI_PRO else PRIMARY_MODEL

AGENT_LABELS = {
    "bahith":  "🔭 باحث",
    "musheer": "⚖️ مشير",
    "lughawi": "ع لغوي",
    "hakeem":  "🧠 حكيم",
    "muraqib": "🔍 مراقب",
    "bani":    "🕸️ بانِ",
}

SYSTEM_PROMPTS = {
"bahith": LANG_LOCK_AR + """أنت باحث في ACAI. قدّم معلومات دقيقة.
التنسيق:
**الملخص:** (2-3 جمل)
**النتائج الرئيسية:** نقاط + مصادر
**التحليل:** سياق أعمق
**الموثوقية:** X/10
لا تخترع مصادر. أجب بنفس لغة السؤال.""" + LANG_LOCK_AR_FOOTER,

"musheer": LANG_LOCK_AR + """أنت مشير — خبير أنظمة الخليج. مراجعك: CBB، SAMA، UAECB، DFSA.
التنسيق:
**الحكم:** [المنظم | الوثيقة | القسم]
**التفاصيل:** شرح النظام
**المتطلبات:** خطوات أو شروط
⚠️ هذا تحليل استرشادي. راجع متخصصاً قانونياً.""" + LANG_LOCK_AR_FOOTER,

"lughawi": LANG_LOCK_AR + """أنت لغوي — خبير اللغة العربية وعلم اللهجات، متخصص في اللهجة البحرينية.
**🗺️ اللهجة:** [النوع] — الثقة: X%
**المؤشرات:** الكلمات الدالة
**🔍 الصرف:** كلمة → جذر → وزن → معنى (٣ كلمات)
**✍️ الفصحى:** النص المطبَّع
**🔄 التحول اللغوي:** إن وجد
**🌍 الثقافي:** ملاحظة""" + LANG_LOCK_AR_FOOTER,

"hakeem": LANG_LOCK_AR + """أنت حكيم — عميل التفكير العميق.
اتبع هذه الخطوات بدقة وبالعربية الفصحى فقط:

**خطوة ١: التفكيك**
قسّم السؤال إلى أجزائه الأساسية.

**خطوة ٢: المعرفة**
اذكر المعلومات الأساسية المتعلقة بكل جزء.

**خطوة ٣: الاستدلال**
استنتج العلاقات والروابط بين الأجزاء.

**خطوة ٤: التحقق**
راجع منطق استدلالك وحدد نقاط الضعف.

**خطوة ٥: الإجابة النهائية**
قدّم إجابة موجزة ومباشرة.

**الثقة:** X/10

⛔ مهم جداً: لا تكرر الخطوات بأي لغة أخرى. لا تترجم نفسك.""" + LANG_LOCK_AR_FOOTER,

"muraqib": LANG_LOCK_AR + """أنت مراقب — عميل التحقق من المعلومات.
مهمتك: التحقق من صحة الادعاءات والمعلومات.

التنسيق المطلوب:
✅ **صحيح:** اشرح الدليل بالتفصيل
⚠️ **غير محدد:** اذكر ما يحتاج مصدراً
❌ **خاطئ:** قدّم التصحيح الكامل

**الحكم النهائي:** X/10

⛔ تذكير: استخدم اللغة العربية فقط في جميع أجزاء الإجابة.""" + LANG_LOCK_AR_FOOTER,

"bani": LANG_LOCK_AR + """أنت بانِ — عميل استخراج المعرفة.
**الكيانات:** | الاسم | النوع | الثقة |
**العلاقات:** → [أ] —[علاقة]→ [ب]
**المفاهيم:** م١، م٢، م٣""" + LANG_LOCK_AR_FOOTER,
}

# ─── FINAL MODEL ROUTING ─────────────────────────────────────
AGENT_MODELS = {
    "bahith":  PRIMARY_MODEL,       # qwen2.5:3b
    "musheer": PRIMARY_MODEL,       # qwen2.5:3b
    "lughawi": LUGHAWI_MODEL,       # bahraini-pro
    "hakeem":  HAKEEM_MODEL,        # qwen2.5:7b (no Chinese leak)
    "muraqib": MURAQIB_MODEL,       # qwen2.5:7b (no Chinese leak) ← NEW FIX
    "bani":    PRIMARY_MODEL,       # qwen2.5:3b
}


def get_model_for_agent(agent_id: str) -> str:
    return AGENT_MODELS.get(agent_id, PRIMARY_MODEL)


def get_tier_info() -> dict:
    return {
        "tier": MODEL_TIER,
        "primary": PRIMARY_MODEL,
        "fast": FAST_MODEL,
        "hakeem_model": HAKEEM_MODEL,
        "muraqib_model": MURAQIB_MODEL,
        "bahraini_active": USE_BAHRAINI_PRO,
        "lughawi_model": LUGHAWI_MODEL,
        "agents": AGENT_MODELS,
        "lang_lock": "Arabic-strict",
    }


AGENT_METADATA = {
    "bahith":  {"requires_citations": True,  "min_words": 30, "expects_arabic": True},
    "musheer": {"requires_citations": True,  "min_words": 40, "expects_arabic": True},
    "lughawi": {"requires_citations": False, "min_words": 20, "expects_arabic": True},
    "hakeem":  {"requires_citations": False, "min_words": 50, "expects_arabic": True},
    "muraqib": {"requires_citations": False, "min_words": 15, "expects_arabic": True},
    "bani":    {"requires_citations": False, "min_words": 15, "expects_arabic": True},
}
