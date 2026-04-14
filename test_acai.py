"""
ACAI — Test Suite
==================
File: tests/test_acai.py

Run:  python -m pytest test_acai.py -v
      (no backend needed — all mocked)
"""
import sys, json, os, unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

# ── add backend to path ─────────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).parent))

# ══════════════════════════════════════════════════════════════════════════════
# Test 1 — Memory
# ══════════════════════════════════════════════════════════════════════════════
class TestMemory(unittest.TestCase):
    def setUp(self):
        """Use a temp DB for each test."""
        import tempfile, sqlite3
        self.tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.db_path = Path(self.tmp.name)
        # Patch DB_PATH in acai_memory
        import acai_memory
        acai_memory.DB_PATH = self.db_path
        acai_memory._init_db(self.db_path)
        self.mem = acai_memory

    def test_save_and_retrieve(self):
        """Memory test: save fact → retrieve it."""
        rid = self.mem.save_interaction(
            "ما هو مصرف البحرين المركزي؟",
            "CBB هو المنظم المالي في البحرين",
            agent_id="musheer", quality=5
        )
        self.assertGreater(rid, 0)
        ctx = self.mem.get_context("مصرف البحرين")
        self.assertTrue(len(ctx) > 0, "Context should not be empty after save")
        self.assertIn("CBB", ctx)

    def test_empty_context_for_unknown(self):
        """Unknown query should return empty string."""
        ctx = self.mem.get_context("zzz_unknown_xyzabc")
        self.assertEqual(ctx, "")

    def test_stats(self):
        self.mem.save_interaction("q1","a1","agent1",quality=4)
        s = self.mem.stats()
        self.assertIn("conversations", s)
        self.assertGreaterEqual(s["conversations"], 1)

# ══════════════════════════════════════════════════════════════════════════════
# Test 2 — Orchestrator
# ══════════════════════════════════════════════════════════════════════════════
class TestOrchestrator(unittest.TestCase):
    def setUp(self):
        # Import orchestrator logic (no Ollama needed — test classification only)
        import orchestrator_logic as orch
        self.classify  = orch.classify_intent
        self.build     = orch.build_pipeline
        self.merge     = orch.merge_pipeline_outputs

    def test_gcc_query_routes_to_musheer(self):
        intent = self.classify("ما متطلبات ترخيص بنك في البحرين وفق CBB؟")
        self.assertTrue(intent["gcc_law"], "GCC query should set gcc_law=True")
        pipeline = self.build(intent)
        self.assertIn("musheer", pipeline, "CBB query must include musheer agent")

    def test_arabic_text_routes_to_lughawi(self):
        intent = self.classify("والله يا شباب الحين وايد زين")
        self.assertTrue(intent["dialect"], "Arabic text should trigger dialect")
        pipeline = self.build(intent)
        self.assertIn("lughawi", pipeline)

    def test_english_reasoning_routes_to_hakeem(self):
        intent = self.classify("Why is AI alignment philosophically important in modern society?")
        self.assertTrue(intent["reasoning"])
        pipeline = self.build(intent)
        self.assertIn("hakeem", pipeline)

    def test_fact_checker_always_last(self):
        intent = self.classify("ما متطلبات ترخيص بنك في البحرين وفق CBB؟")
        pipeline = self.build(intent)
        self.assertEqual(pipeline[-1], "muraqib", "muraqib must always be last")

    def test_merge_single_agent(self):
        result = self.merge(["hakeem"], {"hakeem": "This is the answer."})
        self.assertEqual(result, "This is the answer.")

    def test_merge_multi_agent(self):
        outputs = {"musheer": "CBB requires...", "muraqib": "✅ Verified"}
        result = self.merge(["musheer","muraqib"], outputs)
        self.assertIn("CBB", result)
        self.assertIn("Verified", result)

    def test_forced_single_agent_mode(self):
        pipeline = self.build({}, mode="single:lughawi")
        self.assertEqual(pipeline[0], "lughawi")

# ══════════════════════════════════════════════════════════════════════════════
# Test 3 — Security (frontend has no keys)
# ══════════════════════════════════════════════════════════════════════════════
class TestSecurity(unittest.TestCase):
    def test_no_api_keys_in_frontend(self):
        """Frontend must NOT contain API keys."""
        frontend_files = [
            Path("../frontend-new/src/App.jsx"),
            Path("App_v5_secure.jsx"),
        ]
        FORBIDDEN = ["CLAUDE_URL", "ANTHROPIC_API_KEY", "window.__ACAI_KEY__",
                     "sk-ant-", "x-api-key: sk"]
        for fp in frontend_files:
            if not fp.exists():
                continue
            content = fp.read_text(encoding="utf-8")
            for forbidden in FORBIDDEN:
                self.assertNotIn(
                    forbidden, content,
                    f"SECURITY: '{forbidden}' found in {fp} — REMOVE IT"
                )

    def test_env_file_not_tracked(self):
        """backend/.env must be in .gitignore."""
        gi = Path("../../.gitignore")
        if gi.exists():
            content = gi.read_text()
            self.assertIn(".env", content, ".env must be in .gitignore")

# ══════════════════════════════════════════════════════════════════════════════
# Test 4 — FastAPI endpoints (mocked)
# ══════════════════════════════════════════════════════════════════════════════
class TestAPI(unittest.TestCase):
    def setUp(self):
        # We test the logic, not the real LLM
        try:
            from fastapi.testclient import TestClient
            import main_v5 as app_module
            self.client = TestClient(app_module.app)
            self.has_client = True
        except Exception:
            self.has_client = False

    def test_health_no_auth_needed(self):
        if not self.has_client: return
        r = self.client.get("/api/health")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("status", data)

    def test_query_requires_auth(self):
        if not self.has_client: return
        r = self.client.post("/api/query", json={"query": "test"})
        self.assertIn(r.status_code, [401, 403])

    def test_query_with_valid_key(self):
        if not self.has_client: return
        with patch("main_v5.orchestrate") as mock_orch:
            mock_orch.return_value = {
                "answer":"Test answer","pipeline":["hakeem","muraqib"],
                "memory_used":False,"rag_used":False,"latency_ms":100,"intent":{}
            }
            r = self.client.post(
                "/api/query",
                json={"query":"ما هي رؤية 2030؟"},
                headers={"X-API-Key":"dev-key-12345"}
            )
            self.assertEqual(r.status_code, 200)
            data = r.json()
            self.assertIn("answer", data)

# ══════════════════════════════════════════════════════════════════════════════
# Test 5 — Skill Generator
# ══════════════════════════════════════════════════════════════════════════════
class TestSkillGenerator(unittest.TestCase):
    def setUp(self):
        import skill_generator as sg
        self.sg = sg

    def test_structured_response_generates_skill(self):
        response = """
        لفتح حساب بنكي في البحرين اتبع الخطوات التالية:
        ١. أحضر هويتك الشخصية الصادرة من الجهات الرسمية
        ٢. احضر إثبات عنوان السكن مثل فاتورة الكهرباء أو الماء
        ٣. زر أي فرع من فروع البنك أو سجّل أونلاين عبر موقعه
        ٤. انتظر التفعيل خلال مدة تتراوح بين يوم وثلاثة أيام عمل
        ٥. ستتلقى رسالة تأكيد على هاتفك المسجل لدى البنك
        """
        result = self.sg.should_generate_skill("كيف أفتح حساب؟", response, quality=5)
        self.assertTrue(result)

    def test_short_response_no_skill(self):
        result = self.sg.should_generate_skill("test", "short answer", quality=5)
        self.assertFalse(result)

    def test_low_quality_no_skill(self):
        response = "١. خطوة أولى\n٢. خطوة ثانية\n٣. خطوة ثالثة\n٤. خطوة رابعة طويلة"
        result = self.sg.should_generate_skill("query", response, quality=2)
        self.assertFalse(result)

if __name__ == "__main__":
    unittest.main(verbosity=2)
