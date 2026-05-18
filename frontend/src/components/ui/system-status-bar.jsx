import { useEffect, useState } from "react";
import { DARK, LIGHT } from "../../data/theme";

// Bottom status bar — VS Code / Linear inspired.
// Shows system telemetry that makes the app feel "operational"

export const SystemStatusBar = ({ health, active, theme, latencyHint }) => {
  const t = theme === "dark" ? DARK : LIGHT;
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const iv = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const Section = ({ children, color }) => (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "0 12px",
      borderRight: `1px solid ${t.border}`,
      height: "100%",
      cursor: "default",
    }}>
      {color && (
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: color,
          boxShadow: `0 0 6px ${color}88`,
        }} />
      )}
      {children}
    </div>
  );

  return (
    <footer style={{
      height: 28,
      background: t.panel,
      borderTop: `1px solid ${t.border}`,
      display: "flex",
      alignItems: "center",
      fontSize: 10,
      letterSpacing: "0.05em",
      color: t.faint,
      fontFamily: "'JetBrains Mono', 'Consolas', monospace",
      flexShrink: 0,
      overflow: "hidden",
    }}>
      {/* Left side — operational state */}
      <Section color={health ? t.online : t.offline}>
        <span style={{ color: health ? t.online : t.offline, fontWeight: 700 }}>
          {health ? "OPERATIONAL" : "OFFLINE"}
        </span>
      </Section>

      <Section>
        <span>OLLAMA</span>
        <span style={{ color: t.text, fontWeight: 600 }}>127.0.0.1:11434</span>
      </Section>

      <Section>
        <span>AGENT</span>
        <span style={{ color: t.gold, fontWeight: 600 }}>{active || "auto"}</span>
      </Section>

      {latencyHint && (
        <Section>
          <span>LAT</span>
          <span style={{ color: t.cyan, fontWeight: 600 }}>{latencyHint}ms</span>
        </Section>
      )}

      <div style={{ flex: 1 }} />

      {/* Right side — meta */}
      <Section>
        <span style={{ color: t.gold }}>★</span>
        <span style={{ fontWeight: 600, color: t.text }}>87.5% ABBL</span>
      </Section>

      <Section>
        <span>BUILD</span>
        <span style={{ color: t.text, fontWeight: 600 }}>v3.1.0</span>
      </Section>

      <Section>
        <span style={{ color: t.text }}>{time.toLocaleTimeString("en-US", { hour12: false })}</span>
      </Section>
    </footer>
  );
};
