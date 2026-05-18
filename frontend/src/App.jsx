import { useState, useEffect } from "react";
import { AGENTS } from "./data/agents";
import { ChatPanel } from "./components/ui/chat-panel";
import { AgentCard } from "./components/ui/agent-card";
import { SystemStatusBar } from "./components/ui/system-status-bar";
import { StatusPill, CapItem, SectionHeader } from "./components/ui/shell-bits";
import { DARK, LIGHT } from "./data/theme";
import { BACKEND } from "./data/backend";

export default function App() {
  const [active, setActive] = useState("auto");
  const [theme, setTheme] = useState("dark");
  const [sidebar, setSidebar] = useState(true);
  const [health, setHealth] = useState(null);
  const [memCount, setMemCount] = useState(0);
  const t = theme === "dark" ? DARK : LIGHT;
  const ag = AGENTS.find(a => a.id === active);

  useEffect(() => {
    const check = () =>
      fetch(`${BACKEND}/health`)
        .then(r => r.json()).then(() => setHealth(true))
        .catch(() => setHealth(false));
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, []);

  // Try to fetch doc count from /documents/list (silent fail)
  useEffect(() => {
    fetch(`${BACKEND}/documents/list`)
      .then(r => r.json())
      .then(d => setMemCount(d.count || d.documents?.length || d.total || 0))
      .catch(() => {});
  }, [health]);

  return (
    <div style={{
      background: t.bg,
      color: t.text,
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      width: "100vw",
      fontFamily: "'Inter', 'Tajawal', system-ui, -apple-system, sans-serif",
      overflow: "hidden",
    }}>

      {/* ════════ EXECUTIVE HEADER ════════ */}
      <header style={{
        height: 56,
        background: t.panel,
        borderBottom: `1px solid ${t.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 18px",
        flexShrink: 0,
      }}>
        {/* Left: brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img src="/agents/acai-logo.png" alt="ACAI"
            style={{
              height: 36,
              filter: theme === "dark" ? "drop-shadow(0 0 12px rgba(212, 165, 116, 0.2))" : "none",
            }} />
          <div style={{
            borderLeft: `1px solid ${t.border}`,
            paddingLeft: 14,
            display: "flex", flexDirection: "column", justifyContent: "center"
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", color: t.text }}>
              ACAI
            </div>
            <div style={{
              fontSize: 9.5,
              color: t.faint,
              letterSpacing: "0.18em",
              fontWeight: 500,
              fontFamily: "'JetBrains Mono', 'Consolas', monospace",
              marginTop: 2,
            }}>
              COGNITIVE&nbsp;AI&nbsp;ENGINE
            </div>
          </div>
        </div>

        {/* Center: live system status pills */}
        <div style={{ display: "flex", gap: 8 }}>
          <StatusPill label="OLLAMA"
            value={health === null ? "..." : health ? "ONLINE" : "OFFLINE"}
            color={health === null ? t.warning : health ? t.online : t.offline}
            t={t} />
          <StatusPill label="MEMORY"
            value={memCount > 0 ? `${memCount} DOCS` : "—"}
            color={t.gold} t={t} />
          <StatusPill label="MODE" value="PRIVATE" color={t.green} t={t} />
          <StatusPill label="REGION" value="GCC" color={t.cyan} t={t} />
        </div>

        {/* Right: controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setTheme(th => th === "dark" ? "light" : "dark")}
            title="Toggle theme"
            style={{
              width: 32, height: 32, borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.sub,
              color: t.muted,
              cursor: "pointer",
              fontSize: 14,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
            {theme === "dark" ? "☾" : "☀"}
          </button>
          <button onClick={() => setSidebar(o => !o)}
            title="Toggle sidebar"
            style={{
              padding: "0 12px", height: 32, borderRadius: 8,
              border: `1px solid ${t.border}`,
              background: t.sub,
              color: t.muted,
              cursor: "pointer",
              fontSize: 11,
              fontFamily: "'JetBrains Mono', 'Consolas', monospace",
              letterSpacing: "0.05em",
            }}>
            {sidebar ? "▶ CLOSE" : "◀ OPEN"}
          </button>
        </div>
      </header>

      {/* ════════ CAPABILITY BAR ════════ */}
      <div style={{
        height: 30,
        background: t.bg,
        borderBottom: `1px solid ${t.border}`,
        display: "flex",
        alignItems: "center",
        padding: "0 20px",
        gap: 22,
        fontSize: 9.5,
        fontWeight: 500,
        letterSpacing: "0.14em",
        fontFamily: "'JetBrains Mono', 'Consolas', monospace",
        color: t.faint,
        flexShrink: 0,
        overflow: "hidden",
      }}>
        <CapItem label="INFERENCE" value="LOCAL" color={t.gold} />
        <CapItem label="ORCHESTRATION" value="MULTI-AGENT" color={t.cyan} />
        <CapItem label="LANG" value="AR + EN" color="#f97316" />
        <CapItem label="DEPLOYMENT" value="ON-PREMISE" color={t.green} />
        <CapItem label="BENCHMARK" value="87.5% ABBL" color="#a855f7" />
        <span style={{ marginLeft: "auto", color: t.faint, fontSize: 9, opacity: 0.7 }}>
          ARABICNLP&nbsp;2026 · UB
        </span>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

        {/* ════════ EXECUTIVE SIDEBAR ════════ */}
        <aside style={{
          width: sidebar ? 340 : 0,
          background: t.panel,
          borderLeft: sidebar ? `1px solid ${t.border}` : "none",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transition: "width 0.25s ease",
          flexShrink: 0,
        }}>
          <div style={{
            flex: 1, overflowY: "auto", overflowX: "hidden",
            padding: "16px 12px",
          }}>

            {/* CORE AGENTS SECTION */}
            <SectionHeader title="CORE AGENTS" count="6" t={t} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 20 }}>
              {AGENTS.filter(a => a.id !== "auto").map(a => (
                <AgentCard key={a.id} ag={a} active={a.id === active}
                  onClick={() => setActive(a.id)} t={t} />
              ))}
            </div>

            {/* ORCHESTRATION SECTION */}
            <SectionHeader title="ORCHESTRATION" count="1" t={t} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 20 }}>
              {AGENTS.filter(a => a.id === "auto").map(a => (
                <AgentCard key={a.id} ag={a} active={a.id === active}
                  onClick={() => setActive(a.id)} t={t} featured />
              ))}
            </div>

            {/* SYSTEM PANEL */}
            <SectionHeader title="SYSTEM" t={t} />
            <div style={{
              padding: "10px 12px",
              background: t.card,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              fontSize: 10,
              fontFamily: "'JetBrains Mono', 'Consolas', monospace",
              display: "flex", flexDirection: "column", gap: 6,
            }}>
              <Row label="Backend" value={health ? "8001 · alive" : "offline"}
                color={health ? t.online : t.offline} t={t} />
              <Row label="Vision" value="moondream" color={t.cyan} t={t} />
              <Row label="STT" value="whisper · ar" color={t.gold} t={t} />
              <Row label="TTS" value="ar-BH-Laila" color="#a855f7" t={t} />
              <Row label="Build" value="v3.1.0" color={t.muted} t={t} />
            </div>

          </div>
        </aside>

        {/* ════════ MAIN ════════ */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          <ChatPanel key={active} ag={ag} theme={theme} />
        </main>
      </div>

      {/* ════════ BOTTOM STATUS BAR ════════ */}
      <SystemStatusBar health={health} active={active} theme={theme} />
    </div>
  );
}

const Row = ({ label, value, color, t }) => (
  <div style={{ display: "flex", justifyContent: "space-between" }}>
    <span style={{ color: t.faint }}>{label}</span>
    <span style={{ color: color || t.text, fontWeight: 600 }}>{value}</span>
  </div>
);
