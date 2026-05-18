import { useEffect } from "react";
import { IconClose, IconSparkle } from "./icons";

const STATS = [
  { label: "Active Tier", value: "LITE", note: "qwen2.5:3b across agents", color: "#3b82f6" },
  { label: "Agents", value: "6+1", note: "Specialized + orchestrator", color: "#a855f7" },
  { label: "Languages", value: "AR + EN", note: "Bahraini · GCC · MSA", color: "#f97316" },
  { label: "Inference", value: "LOCAL", note: "100% on-premise", color: "#10b981" },
];

const CAPABILITIES = [
  { title: "Multi-Agent Orchestration",
    desc: "Six specialized Arabic agents — Researcher, Reasoner, GCC Advisor, Language Expert, Fact Checker, Knowledge Graph — coordinated by an autonomous router.",
    color: "#3b82f6" },
  { title: "Bahraini-Pro Fine-Tuned LLM",
    desc: "Separately fine-tuned Arabic model achieving 87.5% on the ABBL dialect benchmark, outperforming GPT-4o, Jais-30B, and Aya-8B in benchmark evaluation. Available for high-RAM deployments (>12 GB). Live demo uses qwen2.5:3b for hardware compatibility.",
    color: "#f97316" },
  { title: "Retrieval-Augmented Generation",
    desc: "Hybrid BM25 + dense vector search with reciprocal rank fusion. Native PDF/DOCX/TXT ingestion with Arabic OCR.",
    color: "#0d9488" },
  { title: "Voice + Vision",
    desc: "End-to-end Arabic speech (whisper STT, Bahraini Edge TTS) and multimodal image understanding (moondream + Tesseract Arabic OCR).",
    color: "#a855f7" },
  { title: "Self-Verification",
    desc: "Every response scored 0-1 by an independent verifier agent. Sub-threshold responses trigger automatic retry with refined prompts.",
    color: "#eab308" },
  { title: "GCC Compliance",
    desc: "Built-in knowledge of CBB, SAMA, UAECB regulations and Vision 2030 frameworks. Direct fit for fintech, banking, and government deployments.",
    color: "#14b8a6" },
];

export const InfoModal = ({ open, onClose, theme, t }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  const mono = "'JetBrains Mono', 'Consolas', monospace";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
        animation: "acai-fade-in 0.2s ease",
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: t.panel,
          border: `1px solid ${t.border}`,
          borderRadius: 16,
          maxWidth: 900,
          width: "100%",
          maxHeight: "90vh",
          overflow: "auto",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.6)",
          animation: "acai-up 0.3s ease",
        }}>

        <div style={{
          padding: "24px 28px 20px",
          borderBottom: `1px solid ${t.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, background: t.panel, zIndex: 1,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img src="/agents/acai-logo.png" alt="ACAI" style={{ height: 44 }} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.text }}>ACAI</div>
              <div style={{
                fontSize: 10, color: t.faint, letterSpacing: "0.18em",
                fontFamily: mono, marginTop: 2,
              }}>
                ARABIC COGNITIVE AI ENGINE
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: t.sub, border: `1px solid ${t.border}`,
            color: t.muted, width: 36, height: 36, borderRadius: 8,
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", transition: "all 0.2s",
          }}
          onMouseOver={e => e.currentTarget.style.color = t.text}
          onMouseOut={e => e.currentTarget.style.color = t.muted}>
            <IconClose size={16} />
          </button>
        </div>

        <div style={{ padding: "24px 28px 28px" }}>

          <p style={{
            margin: "0 0 24px",
            color: t.muted, fontSize: 15, lineHeight: 1.7,
            maxWidth: 720,
          }}>
            ACAI is a private, on-premise, multi-agent AI system engineered for Arabic
            cognitive workloads. Built for enterprises and academic institutions across
            the GCC who require dialect-accurate Arabic understanding, regulatory
            compliance reasoning, and verifiable AI output — all without sending data to
            external cloud providers.
          </p>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10, marginBottom: 28,
          }}>
            {STATS.map((s, i) => (
              <div key={i} style={{
                padding: "14px 16px",
                background: t.card,
                border: `1px solid ${t.border}`,
                borderRadius: 10,
              }}>
                <div style={{
                  fontSize: 9.5, color: t.faint, letterSpacing: "0.14em",
                  fontFamily: mono, fontWeight: 600,
                }}>
                  {s.label.toUpperCase()}
                </div>
                <div style={{
                  fontSize: 22, fontWeight: 800, color: s.color,
                  marginTop: 6, letterSpacing: "-0.02em",
                }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 10.5, color: t.muted, marginTop: 4 }}>
                  {s.note}
                </div>
              </div>
            ))}
          </div>

          {/* HONESTY BLOCK - replaces marketing fluff */}
          <div style={{
            padding: "16px 18px",
            background: `${t.gold}08`,
            border: `1px solid ${t.gold}33`,
            borderLeft: `3px solid ${t.gold}`,
            borderRadius: 8,
            marginBottom: 28,
          }}>
            <div style={{
              fontSize: 10, color: t.gold, letterSpacing: "0.2em",
              fontWeight: 700, fontFamily: mono, marginBottom: 8,
            }}>
              DEPLOYMENT TRANSPARENCY
            </div>
            <p style={{
              margin: 0, color: t.muted, fontSize: 13, lineHeight: 1.65,
            }}>
              The live demo runs in <span style={{ color: t.text, fontFamily: mono, fontWeight: 600 }}>LITE</span> tier (qwen2.5:3b)
              for laptop compatibility. The fine-tuned <span style={{ color: t.text, fontFamily: mono, fontWeight: 600 }}>bahraini-pro</span> model
              that achieved <span style={{ color: t.gold, fontWeight: 700 }}>87.5% on ABBL</span> is a separately-evaluated benchmark
              result, available for production deployments with sufficient RAM (>12 GB).
              This separation is intentional: ACAI's architecture supports tiered model selection
              to match hardware constraints without misrepresenting which model is currently active.
            </p>
          </div>

          <div style={{
            fontSize: 10, color: t.faint, letterSpacing: "0.2em",
            fontWeight: 700, fontFamily: mono, marginBottom: 12,
          }}>
            CORE CAPABILITIES
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 10, marginBottom: 28,
          }}>
            {CAPABILITIES.map((c, i) => (
              <div key={i} style={{
                padding: "16px 18px",
                background: t.card,
                border: `1px solid ${t.border}`,
                borderLeft: `2px solid ${c.color}`,
                borderRadius: 8,
              }}>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: t.text,
                  marginBottom: 6,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{ color: c.color }}><IconSparkle size={12} /></span>
                  {c.title}
                </div>
                <div style={{ fontSize: 11.5, color: t.muted, lineHeight: 1.6 }}>
                  {c.desc}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            fontSize: 10, color: t.faint, letterSpacing: "0.2em",
            fontWeight: 700, fontFamily: mono, marginBottom: 12,
          }}>
            TECHNICAL STACK
          </div>

          <div style={{
            background: t.card,
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            padding: "14px 16px",
            fontSize: 11.5, color: t.muted, lineHeight: 1.9,
            fontFamily: mono,
          }}>
            <Row label="Backend" value="FastAPI · Python 3.13 · uv" t={t} />
            <Row label="Active LLM" value="qwen2.5:3b (LITE tier)" t={t} />
            <Row label="Specialist (available)" value="bahraini-pro (FT, 12+ GB RAM)" t={t} />
            <Row label="Vision" value="moondream · Tesseract Arabic OCR" t={t} />
            <Row label="Voice" value="faster-whisper · Edge TTS (ar-BH-Laila)" t={t} />
            <Row label="Storage" value="SQLite · FTS5 · Vector embeddings" t={t} />
            <Row label="Frontend" value="React 19 · Vite 8 · Inter + Tajawal" t={t} />
          </div>

          <div style={{
            marginTop: 24, paddingTop: 20,
            borderTop: `1px solid ${t.border}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            gap: 12, flexWrap: "wrap",
            fontSize: 10.5, color: t.faint,
          }}>
            <div>
              <span style={{ color: t.muted, fontWeight: 600 }}>ACAI v3.1.0</span>
              <span style={{ margin: "0 8px" }}>·</span>
              <span>Target: ArabicNLP 2026 @ EMNLP</span>
            </div>
            <div style={{ fontFamily: mono, letterSpacing: "0.1em" }}>
              UNIVERSITY OF BAHRAIN · BENEFIT&nbsp;AI&nbsp;LAB
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Row = ({ label, value, t }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
    <span style={{ color: t.faint }}>{label}</span>
    <span style={{ color: t.text, fontWeight: 600, textAlign: "right" }}>{value}</span>
  </div>
);
