import { memo, useState, useRef } from "react";
import Markdown from 'react-markdown';

import { Chip } from "./chip";
import { AgentAvatar } from "./agent-avatar";
import { isAr } from "../../utils/arabic";
import { BACKEND } from "../../data/backend";

export const Bubble = memo(({ msg, ag, t }) => {
  if (msg.role === "user") return (
    <div style={{
      display: "flex", justifyContent: "flex-end",
      marginBottom: 20, animation: "acai-up .25s ease",
    }}>
      <div style={{
        maxWidth: "72%", background: t.userBg,
        border: "1px solid rgba(99, 102, 241, 0.15)",
        borderRadius: "14px 14px 4px 14px",
        padding: "12px 18px",
        boxShadow: "0 4px 14px rgba(0, 0, 0, 0.3)",
        color: t.text,
      }}>
        <Markdown>{msg.content}</Markdown>
      </div>
    </div>
  );

  const ar2 = isAr(msg.content);
  const [ttsState, setTtsState] = useState("idle");
  const audioRef = useRef(null);

  const playTTS = async () => {
    if (ttsState === "playing" && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setTtsState("idle");
      return;
    }
    if (ttsState === "loading") return;
    if (!msg.content || msg.content.length < 2) return;

    setTtsState("loading");
    try {
      const fd = new FormData();
      fd.append("text", msg.content.slice(0, 1500));
      const resp = await fetch(`${BACKEND}/voice/synthesize`, { method: "POST", body: fd });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        alert("TTS error: " + (err.error || resp.statusText));
        setTtsState("idle");
        return;
      }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setTtsState("idle"); URL.revokeObjectURL(url); };
      audio.onerror = () => { setTtsState("idle"); URL.revokeObjectURL(url); };
      audio.onplay = () => setTtsState("playing");
      await audio.play();
    } catch (err) {
      alert("TTS failed: " + err.message);
      setTtsState("idle");
    }
  };

  // Extract telemetry from msg.pipeline if available
  const confidence = msg.pipeline?.confidence
    ?? msg.pipeline?.verification?.confidence
    ?? null;
  const verified = msg.pipeline?.verified === true
    || (confidence != null && confidence >= 0.8);
  const confidencePct = confidence != null ? Math.round(confidence * 100) : null;
  const confColor = confidencePct == null ? null
    : confidencePct >= 85 ? t.green
    : confidencePct >= 65 ? t.warning
    : t.red;

  const mono = "'JetBrains Mono', 'Consolas', monospace";

  return (
    <div style={{
      display: "flex", gap: 12, marginBottom: 28,
      animation: "acai-up .3s ease",
    }}>
      {/* Cartoon avatar */}
      <div style={{ marginTop: 4 }}>
        <AgentAvatar ag={ag} size="small" active={msg.streaming} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header row: name + badges */}
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          marginBottom: 8, flexWrap: "wrap",
        }}>
          <span style={{
            fontSize: 14.5, fontWeight: 700, color: ag.hex,
            fontFamily: "'Tajawal', 'Inter', sans-serif",
          }}>
            {ag.ar}
          </span>

          <span style={{
            fontSize: 8.5, padding: "2px 7px", borderRadius: 4,
            background: `${ag.hex}14`, color: ag.hex,
            border: `0.5px solid ${ag.hex}40`,
            fontWeight: 700, letterSpacing: ".14em",
            fontFamily: mono,
          }}>
            {ag.badge}
          </span>

          {/* Confidence badge */}
          {confidencePct != null && !msg.streaming && (
            <span style={{
              fontSize: 9, padding: "2.5px 7px", borderRadius: 4,
              background: `${confColor}14`, color: confColor,
              border: `0.5px solid ${confColor}50`,
              fontWeight: 700, letterSpacing: ".08em",
              fontFamily: mono,
            }}>
              {confidencePct}%
            </span>
          )}

          {/* Verified chip */}
          {verified && !msg.streaming && (
            <span style={{
              fontSize: 9, padding: "2.5px 7px", borderRadius: 4,
              background: `${t.green}14`, color: t.green,
              border: `0.5px solid ${t.green}50`,
              fontWeight: 700, letterSpacing: ".14em",
              display: "inline-flex", alignItems: "center", gap: 3,
              fontFamily: mono,
            }}>
              ✓ VERIFIED
            </span>
          )}

          {msg.streaming && (
            <div style={{
              width: 11, height: 11, borderRadius: "50%",
              border: `1.5px solid ${ag.hex}33`, borderTopColor: ag.hex,
              animation: "acai-spin .65s linear infinite", marginLeft: 2,
            }} />
          )}

          {msg.latency && !msg.streaming && (
            <span style={{
              fontSize: 10, color: t.faint, marginLeft: "auto",
              fontFamily: mono, fontWeight: 600,
            }}>
              {(msg.latency / 1000).toFixed(2)}s
            </span>
          )}
        </div>

        {/* Search chips */}
        {msg.searches?.length > 0 && (
          <div style={{ marginBottom: 8 }}>
            {msg.searches.map((s, i) => <Chip key={i} q={s.q} done={s.done} />)}
          </div>
        )}

        {/* Message body */}
        <div style={{
          background: t.card,
          border: `1px solid ${msg.streaming ? ag.hex + "44" : t.border}`,
          borderRadius: "4px 14px 14px 14px",
          padding: "18px 22px",
          boxShadow: msg.streaming
            ? `0 0 24px ${ag.hex}20, 0 0 0 1px ${ag.hex}22`
            : "0 1px 3px rgba(0, 0, 0, 0.1)",
          transition: "border-color .3s, box-shadow .3s",
        }}>
          {msg.content
            ? <div style={{
                margin: 0,
                color: msg.error ? t.red : t.text,
                fontSize: ar2 ? 16 : 14,
                lineHeight: 1.85,
                whiteSpace: "pre-wrap", wordBreak: "break-word",
                direction: ar2 ? "rtl" : "ltr",
                textAlign: ar2 ? "right" : "left",
                fontFamily: ar2 ? "'Tajawal', 'Inter', sans-serif" : "'Inter', sans-serif",
              }}>
                <Markdown>{msg.content}</Markdown>
              </div>
            : <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 14, height: 14, borderRadius: "50%",
                  border: `2px solid ${ag.hex}33`, borderTopColor: ag.hex,
                  animation: "acai-spin .65s linear infinite",
                }} />
                <span style={{ fontSize: 12, color: t.muted, fontFamily: "'Tajawal', 'Inter', sans-serif" }}>
                  يعالج...
                </span>
              </div>}
        </div>

        {/* Pipeline trace */}
        {!msg.streaming && msg.pipeline?.agents_run?.length > 0 && (
          <div style={{
            marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center",
          }}>
            <span style={{
              fontSize: 9, color: t.faint, letterSpacing: ".15em", marginRight: 4,
              fontFamily: mono, fontWeight: 600,
            }}>
              PIPELINE
            </span>
            {msg.pipeline.agents_run.map((agentId, i) => (
              <span key={i} style={{
                fontSize: 9, padding: "2px 6px", borderRadius: 3,
                background: t.sub, color: t.muted,
                border: `0.5px solid ${t.border}`,
                fontWeight: 600, letterSpacing: ".06em",
                fontFamily: mono,
              }}>
                {agentId}{i < msg.pipeline.agents_run.length - 1 ? " →" : ""}
              </span>
            ))}
          </div>
        )}

        {/* Actions: copy + TTS */}
        {!msg.streaming && msg.content && !msg.error && (
          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => navigator.clipboard.writeText(msg.content)}
              title="نسخ النص"
              style={{
                background: "none", border: `1px solid ${t.border}`,
                borderRadius: 5, padding: "3px 10px", cursor: "pointer",
                fontSize: 10.5, color: t.muted, transition: "all .2s",
                fontFamily: mono, letterSpacing: ".05em",
              }}
              onMouseOver={e => {
                e.currentTarget.style.borderColor = ag.hex;
                e.currentTarget.style.color = ag.hex;
              }}
              onMouseOut={e => {
                e.currentTarget.style.borderColor = t.border;
                e.currentTarget.style.color = t.muted;
              }}>
              ⎘ COPY
            </button>

            <button onClick={playTTS}
              title={ttsState === "playing" ? "إيقاف الصوت" : "استمع للرد بصوت بحريني"}
              disabled={ttsState === "loading"}
              style={{
                background: ttsState !== "idle" ? `${ag.hex}14` : "none",
                border: `1px solid ${ttsState !== "idle" ? ag.hex : t.border}`,
                borderRadius: 5, padding: "3px 10px",
                cursor: ttsState === "loading" ? "wait" : "pointer",
                fontSize: 10.5, color: ttsState !== "idle" ? ag.hex : t.muted,
                transition: "all .2s",
                display: "inline-flex", alignItems: "center", gap: 4,
                fontFamily: mono, letterSpacing: ".05em",
              }}
              onMouseOver={e => {
                if (ttsState === "idle") {
                  e.currentTarget.style.borderColor = ag.hex;
                  e.currentTarget.style.color = ag.hex;
                }
              }}
              onMouseOut={e => {
                if (ttsState === "idle") {
                  e.currentTarget.style.borderColor = t.border;
                  e.currentTarget.style.color = t.muted;
                }
              }}>
              {ttsState === "loading" && (
                <div style={{
                  width: 9, height: 9, borderRadius: "50%",
                  border: `1.5px solid ${ag.hex}40`, borderTopColor: ag.hex,
                  animation: "acai-spin .65s linear infinite",
                }} />
              )}
              {ttsState === "playing" && "⏸"}
              {ttsState === "idle" && "🔊"}
              <span>
                {ttsState === "loading" ? "SYNTHESIZING..." :
                 ttsState === "playing" ? "STOP" :
                 "LISTEN"}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
