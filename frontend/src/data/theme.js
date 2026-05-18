// Executive theme palette — matte black + graphite + premium gold
// Replaces the navy/blue MVP look with venture-grade surfaces.

export const DARK = {
  // Surfaces — true matte black hierarchy
  bg: "#08080c",           // App background (deeper than navy)
  panel: "#0e0e14",        // Header, sidebar, footer
  card: "#13131a",         // Card surfaces, message bubbles
  input: "#0a0a10",        // Input fields
  sub: "#16161e",          // Sub-surfaces, hover states

  // Borders — graphite tones
  border: "#1f1f2a",
  borderStrong: "#2a2a36",

  // Text hierarchy — high contrast
  text: "#f1f5f9",
  muted: "#94a3b8",
  faint: "#64748b",

  // Premium accent — gold (subtle, executive)
  gold: "#d4a574",
  goldDim: "#a8845c",

  // Status colors
  cyan: "#22d3ee",
  green: "#10b981",
  warning: "#f59e0b",
  red: "#ef4444",
  online: "#10b981",
  offline: "#ef4444",

  // User message bubble — sophisticated gradient
  userBg: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
};

export const LIGHT = {
  bg: "#fafbfc",
  panel: "#ffffff",
  card: "#ffffff",
  input: "#f7f8fa",
  sub: "#f1f5f9",

  border: "#e4e7eb",
  borderStrong: "#cbd5e1",

  text: "#0f172a",
  muted: "#475569",
  faint: "#64748b",

  gold: "#a8845c",
  goldDim: "#d4a574",

  cyan: "#0891b2",
  green: "#059669",
  warning: "#d97706",
  red: "#dc2626",
  online: "#059669",
  offline: "#dc2626",

  userBg: "linear-gradient(135deg, #1e40af, #1d4ed8)",
};
