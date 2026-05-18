// Small reusable presentation components for the executive shell.

export const StatusPill = ({ label, value, color, t }) => (
  <div style={{
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "5px 10px",
    background: `${color}10`,
    border: `0.5px solid ${color}40`,
    borderRadius: 6,
    fontSize: 10,
    letterSpacing: "0.08em",
    fontFamily: "'JetBrains Mono', 'Consolas', monospace",
  }}>
    <span style={{
      width: 6, height: 6, borderRadius: "50%",
      background: color,
      boxShadow: `0 0 6px ${color}`,
      flexShrink: 0,
    }} />
    <span style={{ color: t.faint, fontWeight: 500 }}>{label}</span>
    <span style={{ color, fontWeight: 700 }}>{value}</span>
  </div>
);

export const CapItem = ({ label, value, color }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
    <span style={{ width: 4, height: 4, borderRadius: "50%", background: color }} />
    <span style={{ color: "#64748b" }}>{label}</span>
    <span style={{ color, fontWeight: 600 }}>{value}</span>
  </span>
);

export const SectionHeader = ({ title, count, t }) => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 4px 8px",
    marginBottom: 4,
  }}>
    <span style={{
      fontSize: 9.5, fontWeight: 700, letterSpacing: "0.18em",
      color: t.faint,
      fontFamily: "'JetBrains Mono', 'Consolas', monospace",
    }}>
      {title}
    </span>
    {count != null && (
      <span style={{
        fontSize: 9, color: t.faint,
        padding: "1px 6px",
        border: `1px solid ${t.border}`,
        borderRadius: 3,
        fontFamily: "'JetBrains Mono', 'Consolas', monospace",
      }}>
        {count}
      </span>
    )}
  </div>
);
