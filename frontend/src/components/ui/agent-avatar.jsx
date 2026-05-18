import { useState } from "react";

/**
 * Reusable agent avatar - shows the cartoon character with a colored ring.
 *
 * Sizes:
 *   - tiny:   24x24  (for inline labels)
 *   - small:  36x36  (for chat message avatars)
 *   - medium: 56x56  (for chat header)
 *   - large:  120x120 (for empty state)
 *
 * Props:
 *   ag        - agent object from agents.js
 *   size      - "tiny" | "small" | "medium" | "large"
 *   active    - boolean, adds glow ring when true
 *   floating  - boolean, adds gentle bobbing animation (use for large/empty state)
 */
export const AgentAvatar = ({ ag, size = "small", active = false, floating = false }) => {
  const [imgError, setImgError] = useState(false);

  const sizes = {
    tiny:   { px: 24,  fontSize: 12, glowSize: 6,  borderWidth: 1 },
    small:  { px: 36,  fontSize: 16, glowSize: 10, borderWidth: 1.5 },
    medium: { px: 56,  fontSize: 26, glowSize: 18, borderWidth: 2 },
    large:  { px: 120, fontSize: 56, glowSize: 36, borderWidth: 2 },
  };
  const s = sizes[size] || sizes.small;

  const ringStyle = {
    width: s.px,
    height: s.px,
    borderRadius: "50%",
    overflow: "hidden",
    position: "relative",
    flexShrink: 0,
    background: imgError ? `${ag.hex}14` : "transparent",
    border: `${s.borderWidth}px solid ${active ? ag.hex : ag.hex + "55"}`,
    boxShadow: active
      ? `0 0 ${s.glowSize}px ${ag.glow}, 0 0 ${s.glowSize * 2}px ${ag.glow}`
      : `0 0 ${s.glowSize / 2}px ${ag.glow}`,
    transition: "all 0.3s ease",
    animation: floating ? "acai-float 5s ease-in-out infinite" : undefined,
  };

  return (
    <div style={ringStyle} className="agent-avatar">
      {ag.img && !imgError ? (
        <img
          src={ag.img}
          alt={ag.en}
          onError={() => setImgError(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        // Fallback to unicode icon if image fails to load
        <div style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: ag.hex,
          fontSize: s.fontSize,
          fontWeight: 900,
          fontFamily: ag.id === "lughawi" ? "'Scheherazade New',serif" : "inherit",
        }}>
          {ag.icon}
        </div>
      )}
    </div>
  );
};
