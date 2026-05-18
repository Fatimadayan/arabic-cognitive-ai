import { AgentAvatar } from "./agent-avatar";

// Per-agent metadata reflecting REAL backend routing.
// Agents on qwen2.5:7b: hakeem, muraqib (both for Chinese-leak protection)
// لغوي on bahraini-pro (academic claim preserved)
// All others on qwen2.5:3b (LITE tier)

const AGENT_META = {
  bahith:   { model: "qwen2.5:3b",       acc: "—",     tag: "WEB" },
  hakeem:   { model: "qwen2.5:7b",       acc: "—",     tag: "CoT" },
  musheer:  { model: "qwen2.5:3b",       acc: "—",     tag: "GCC" },
  lughawi:  { model: "bahraini-pro",     acc: "87.5%", tag: "FT" },
  muraqib:  { model: "qwen2.5:7b",       acc: "—",     tag: "VERIFY" },
  bani:     { model: "qwen2.5:3b",       acc: "—",     tag: "KG" },
  auto:     { model: "orchestrator",     acc: "—",     tag: "ROUTE" },
};

export const AgentCard = ({ ag, active, onClick, t, featured = false }) => {
  const meta = AGENT_META[ag.id] || { model: "—", acc: "—", tag: "—" };

  return (
    <button onClick={onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        padding: "10px 12px",
        borderRadius: 8,
        background: active
          ? `linear-gradient(135deg, ${ag.hex}14 0%, ${ag.hex}04 100%)`
          : "transparent",
        border: `1px solid ${active ? ag.hex + "44" : "transparent"}`,
        borderLeft: `3px solid ${active ? ag.hex : "transparent"}`,
        transition: "all 0.2s ease",
        boxShadow: active ? `inset 0 0 24px ${ag.hex}10, 0 0 0 1px ${ag.hex}22` : "none",
        position: "relative",
      }}
      onMouseOver={e => {
        if (!active) {
          e.currentTarget.style.background = `${ag.hex}06`;
          e.currentTarget.style.borderLeftColor = `${ag.hex}55`;
        }
      }}
      onMouseOut={e => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.borderLeftColor = "transparent";
        }
      }}>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <AgentAvatar ag={ag} size="small" active={active} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{
              fontSize: 14,
              fontWeight: 700,
              color: active ? ag.hex : t.text,
              fontFamily: "'Tajawal', 'Inter', sans-serif",
            }}>
              {ag.ar}
            </span>
            <span style={{
              fontSize: 10.5,
              color: t.faint,
              fontWeight: 500,
              letterSpacing: "0.02em",
            }}>
              {ag.en}
            </span>
          </div>
          <div style={{
            fontSize: 9.5,
            color: t.faint,
            marginTop: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily: "'Tajawal', 'Inter', sans-serif",
          }}>
            {ag.title}
          </div>
        </div>

        <div style={{
          width: 7, height: 7, borderRadius: "50%",
          background: active ? "#10b981" : `${t.faint}40`,
          boxShadow: active ? "0 0 8px #10b98180" : "none",
          flexShrink: 0,
          transition: "all 0.3s ease",
        }} />
      </div>

      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        paddingLeft: 46,
        fontSize: 9,
        fontFamily: "'JetBrains Mono', 'Consolas', monospace",
        letterSpacing: "0.04em",
      }}>
        <span style={{ color: t.faint }}>{meta.model}</span>
        {meta.acc !== "—" && (
          <>
            <span style={{ color: t.border }}>·</span>
            <span style={{ color: ag.hex, fontWeight: 700 }}>{meta.acc}</span>
          </>
        )}
        <span style={{ color: t.border }}>·</span>
        <span style={{
          color: t.faint,
          padding: "1px 5px",
          border: `0.5px solid ${t.border}`,
          borderRadius: 3,
          fontWeight: 600,
        }}>
          {meta.tag}
        </span>
      </div>

      {featured && (
        <div style={{
          position: "absolute",
          top: 8, right: 8,
          fontSize: 8, fontWeight: 700,
          letterSpacing: "0.15em",
          color: ag.hex,
          padding: "2px 6px",
          background: `${ag.hex}14`,
          border: `1px solid ${ag.hex}33`,
          borderRadius: 3,
          fontFamily: "'JetBrains Mono', 'Consolas', monospace",
        }}>
          ★ AUTO
        </div>
      )}
    </button>
  );
};
