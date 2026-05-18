import { useState, useRef, useEffect, useCallback } from "react";
import { Bubble } from "./message-bubble";
import { AgentAvatar } from "./agent-avatar";
import { DARK, LIGHT } from "../../data/theme";
import { isAr } from "../../utils/arabic";
import { callBackend } from "../../features/chats/api/get-response";
import { BACKEND } from "../../data/backend";

// Capability descriptors per agent — these go on the empty-state cards
const AGENT_CAPABILITIES = {
  bahith: [
    { label: "Web Search", val: "Real-time", icon: "🌐" },
    { label: "Citations", val: "Auto-linked", icon: "🔗" },
    { label: "Hallucination Policy", val: "Strict", icon: "🛡" },
  ],
  hakeem: [
    { label: "Reasoning", val: "5-step CoT", icon: "◈" },
    { label: "Context", val: "32K tokens", icon: "∞" },
    { label: "Self-correction", val: "Enabled", icon: "↺" },
  ],
  musheer: [
    { label: "Coverage", val: "CBB · SAMA · UAECB", icon: "⚖" },
    { label: "Compliance", val: "Vision 2030", icon: "★" },
    { label: "Knowledge", val: "GCC regulations", icon: "◉" },
  ],
  lughawi: [
    { label: "Dialects", val: "BH · AE · SA · EG", icon: "ع" },
    { label: "Model", val: "bahraini-pro", icon: "★" },
    { label: "DCR Score", val: "87.5%", icon: "▲" },
  ],
  muraqib: [
    { label: "Verification", val: "Multi-source", icon: "✓" },
    { label: "Confidence", val: "0-1 scored", icon: "%" },
    { label: "Retries", val: "Auto", icon: "↺" },
  ],
  bani: [
    { label: "Extraction", val: "Entities + Triples", icon: "⬡" },
    { label: "Store", val: "SQLite KG", icon: "◊" },
    { label: "Linking", val: "Cross-doc", icon: "◉" },
  ],
  auto: [
    { label: "Classification", val: "Intent-based", icon: "◈" },
    { label: "Pipeline", val: "Adaptive", icon: "→" },
    { label: "Verification", val: "Always", icon: "✓" },
  ],
};

export const ChatPanel = ({ ag, theme }) => {
  const t = theme === "dark" ? DARK : LIGHT;
  const [msgs, setMsgs] = useState([]);
  const [inp, setInp] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const endRef = useRef(null);
  const taRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const imgInputRef = useRef(null);
  const docInputRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  useEffect(() => {
    fetch(`${BACKEND}/chat/${ag.id}`)
      .then(r => r.json())
      .then(data => {
        const loaded = (data.messages || []).map((m, i) => ({
          id: Date.now() + i, role: m.role, content: m.content,
          streaming: false, searches: []
        }));
        setMsgs(loaded);
      })
      .catch(() => { });
  }, [ag.id]);

  const clearChat = async () => {
    await fetch(`${BACKEND}/chat/${ag.id}`, { method: "DELETE" });
    setMsgs([]);
  };

  const send = useCallback(async (text) => {
    const q = (text || inp).trim();
    if (!q || busy) return;
    setInp(""); if (taRef.current) taRef.current.style.height = "auto";
    setBusy(true);
    const uid = Date.now(), aid = uid + 1;
    setMsgs(p => [...p,
    { id: uid, role: "user", content: q },
    { id: aid, role: "assistant", content: "", streaming: false, searches: [] }
    ]);
    const t0 = Date.now();
    const upd = fn => setMsgs(p => p.map(m => m.id === aid ? fn(m) : m));

    await callBackend(q, ag.mode, ag.id,
      chunk => upd(m => ({ ...m, content: m.content + chunk })),
      q2 => upd(m => ({ ...m, searches: [...m.searches, { q: q2, done: false }] })),
      () => upd(m => ({ ...m, streaming: false, latency: Date.now() - t0,
        searches: m.searches.map(s => ({ ...s, done: true })) })),
      meta => upd(m => ({ ...m, streaming: false, latency: Date.now() - t0, pipeline: meta?.pipeline })),
    );
    setBusy(false);
  }, [inp, busy, ag]);

  // ─── VOICE / IMAGE / DOC handlers (same as Batch B, unchanged) ───
  const startRecording = async () => {
    if (recording || busy) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        streamRef.current?.getTracks().forEach(tr => tr.stop());
        setRecording(false);
        if (blob.size < 1000) return;
        setBusy(true);
        try {
          const fd = new FormData();
          fd.append('audio', blob, 'recording.webm');
          fd.append('language', 'ar');
          const resp = await fetch(`${BACKEND}/voice/transcribe`, { method: 'POST', body: fd });
          const data = await resp.json();
          if (data.text) {
            setInp(data.text);
            if (taRef.current) {
              taRef.current.style.height = 'auto';
              taRef.current.style.height = Math.min(taRef.current.scrollHeight, 160) + 'px';
              taRef.current.focus();
            }
          } else if (data.error) alert('Transcription error: ' + data.error);
        } catch (err) { alert('Voice transcription failed: ' + err.message); }
        finally { setBusy(false); }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      alert('Microphone denied. Allow microphone in browser settings.\n\n' + err.message);
    }
  };
  const stopRecording = () => { if (recorderRef.current && recording) recorderRef.current.stop(); };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || busy) return;
    const uid = Date.now(), aid = uid + 1;
    setMsgs(p => [...p,
      { id: uid, role: "user", content: `🖼️ صورة: ${file.name}` },
      { id: aid, role: "assistant", content: "", streaming: true, searches: [] }]);
    setBusy(true); setUploading(true);
    const t0 = Date.now();
    try {
      const fd = new FormData(); fd.append('image', file);
      fd.append('prompt', 'صف هذه الصورة بالتفصيل. إذا كان هناك نص عربي، استخرجه كاملاً.');
      const resp = await fetch(`${BACKEND}/vision/analyze`, { method: 'POST', body: fd });
      const data = await resp.json();
      const content = data.description ||
        (data.error ? `خطأ: ${data.error}${data.metadata?.hint ? '\n\n' + data.metadata.hint : ''}` : 'لم يتم التحليل');
      setMsgs(p => p.map(m => m.id === aid ? { ...m, content, streaming: false, latency: Date.now() - t0, error: !!data.error } : m));
    } catch (err) {
      setMsgs(p => p.map(m => m.id === aid ? { ...m, content: `خطأ: ${err.message}`, streaming: false, error: true } : m));
    } finally { setBusy(false); setUploading(false); }
  };

  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || busy) return;
    const uid = Date.now(), aid = uid + 1;
    setMsgs(p => [...p,
      { id: uid, role: "user", content: `📄 مستند: ${file.name}` },
      { id: aid, role: "assistant", content: "", streaming: true, searches: [] }]);
    setBusy(true); setUploading(true);
    const t0 = Date.now();
    try {
      const fd = new FormData(); fd.append('file', file);
      const resp = await fetch(`${BACKEND}/documents/upload`, { method: 'POST', body: fd });
      const data = await resp.json().catch(() => ({}));
      const ok = resp.ok && !data.error && !data.detail;
      const chunks = data.chunks_indexed || data.chunks || data.num_chunks || data.indexed || 0;
      const content = ok
        ? `✅ تم رفع المستند بنجاح\n\n- **الاسم:** ${file.name}\n- **الحجم:** ${(file.size / 1024).toFixed(1)} KB${chunks ? `\n- **عدد المقاطع المفهرسة:** ${chunks}` : ''}\n\nيمكنك الآن السؤال عن محتوى المستند.`
        : `خطأ في الرفع (HTTP ${resp.status}): ${data.error || data.detail || JSON.stringify(data).slice(0,200) || 'فشل الرفع'}`;
      setMsgs(p => p.map(m => m.id === aid ? { ...m, content, streaming: false, latency: Date.now() - t0, error: !ok } : m));
    } catch (err) {
      setMsgs(p => p.map(m => m.id === aid ? { ...m, content: `خطأ: ${err.message}`, streaming: false, error: true } : m));
    } finally { setBusy(false); setUploading(false); }
  };

  const onKey = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };
  const resize = e => {
    const el = e.target; el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
    setInp(e.target.value);
  };

  const actionBtn = (color, active = false) => ({
    width: 36, height: 36, borderRadius: 8,
    border: `1px solid ${active ? color : color + "40"}`,
    background: active ? `${color}22` : "transparent",
    color, cursor: busy && !active ? "not-allowed" : "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 15, transition: "all .2s", flexShrink: 0,
    boxShadow: active ? `0 0 14px ${color}66` : "none",
    opacity: (busy && !active) ? 0.4 : 1,
  });

  const capabilities = AGENT_CAPABILITIES[ag.id] || AGENT_CAPABILITIES.auto;

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100%", background: t.bg,
    }}>
      <style>{`
        @keyframes acai-bar { 0%, 100% { transform: scaleY(0.3); } 50% { transform: scaleY(1); } }
        @keyframes acai-float-soft { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      `}</style>

      {/* ─── CHAT HEADER ─── */}
      <div style={{
        height: 64,
        borderBottom: `1px solid ${t.border}`,
        background: t.panel,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <AgentAvatar ag={ag} size="medium" active />
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <h2 style={{
                color: ag.hex, margin: 0, fontSize: 22, fontWeight: 700,
                fontFamily: "'Tajawal', 'Inter', sans-serif",
              }}>{ag.ar}</h2>
              <span style={{ fontSize: 12, color: t.muted, letterSpacing: 0.5 }}>{ag.en}</span>
              <span style={{
                fontSize: 9, padding: "2px 7px", borderRadius: 4,
                background: `${ag.hex}14`, color: ag.hex,
                border: `0.5px solid ${ag.hex}40`,
                fontWeight: 700, letterSpacing: ".12em",
                fontFamily: "'JetBrains Mono', 'Consolas', monospace",
              }}>{ag.badge}</span>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: 11.5, color: t.muted }}>{ag.title}</p>
          </div>
        </div>

        <button onClick={clearChat}
          style={{
            padding: "6px 12px", borderRadius: 6,
            border: `1px solid ${t.border}`, background: t.sub,
            color: t.muted, fontSize: 11, cursor: "pointer",
            letterSpacing: 0.3, transition: "all 0.2s",
          }}
          onMouseOver={e => { e.currentTarget.style.color = t.text; e.currentTarget.style.borderColor = t.borderStrong; }}
          onMouseOut={e => { e.currentTarget.style.color = t.muted; e.currentTarget.style.borderColor = t.border; }}>
          امسح المحادثة
        </button>
      </div>

      {/* ─── MESSAGES OR EMPTY STATE ─── */}
      <div style={{
        flex: 1, overflowY: "auto", padding: "32px 28px",
        background: t.bg,
      }}>
        {msgs.length === 0 && (
          <div style={{
            maxWidth: 880, margin: "0 auto", padding: "20px 0",
            animation: "acai-up .5s ease",
          }}>
            {/* HERO: avatar + name */}
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div style={{
                display: "inline-block",
                animation: "acai-float-soft 4s ease-in-out infinite",
              }}>
                <AgentAvatar ag={ag} size="large" active />
              </div>
              <h1 style={{
                margin: "16px 0 4px", fontSize: 32, fontWeight: 700,
                color: t.text, fontFamily: "'Tajawal', 'Inter', sans-serif",
              }}>
                {ag.ar}
              </h1>
              <p style={{
                margin: "0 0 4px", color: t.muted, fontSize: 14,
                letterSpacing: "0.05em",
              }}>{ag.title}</p>
              <p style={{
                margin: 0, fontSize: 10.5, color: t.faint, letterSpacing: "0.2em", fontWeight: 600,
                fontFamily: "'JetBrains Mono', 'Consolas', monospace",
              }}>
                {ag.badge} · {ag.en.toUpperCase()}
              </p>
            </div>

            {/* CAPABILITY CARDS - 3 per agent */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10, marginBottom: 28,
            }}>
              {capabilities.map((cap, i) => (
                <div key={i} style={{
                  padding: "14px 16px",
                  background: t.card,
                  border: `1px solid ${t.border}`,
                  borderRadius: 10,
                  display: "flex", flexDirection: "column", gap: 6,
                  transition: "all 0.2s",
                  cursor: "default",
                }}
                onMouseOver={e => { e.currentTarget.style.borderColor = ag.hex + "55"; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = t.border; }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16, color: ag.hex, fontWeight: 700 }}>{cap.icon}</span>
                    <span style={{
                      fontSize: 10, color: t.faint, letterSpacing: "0.12em", fontWeight: 600,
                      fontFamily: "'JetBrains Mono', 'Consolas', monospace",
                    }}>
                      {cap.label.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                    {cap.val}
                  </div>
                </div>
              ))}
            </div>

            {/* PROMPT SUGGESTIONS - now styled as cards */}
            <div style={{
              fontSize: 10, color: t.faint, letterSpacing: "0.15em", fontWeight: 600,
              marginBottom: 10, paddingRight: 4,
              fontFamily: "'JetBrains Mono', 'Consolas', monospace",
            }}>
              SUGGESTED PROMPTS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ag.tips.map((s, i) => (
                <button key={i} onClick={() => send(s)}
                  style={{
                    all: "unset", cursor: "pointer",
                    background: t.card,
                    border: `1px solid ${t.border}`,
                    borderLeft: `3px solid ${ag.hex}`,
                    borderRadius: 8, padding: "14px 18px",
                    color: t.muted, transition: "all .2s",
                    fontSize: isAr(s) ? 15 : 13,
                    fontFamily: isAr(s) ? "'Tajawal', 'Inter', sans-serif" : "'Inter', sans-serif",
                    direction: isAr(s) ? "rtl" : "ltr",
                    textAlign: isAr(s) ? "right" : "left",
                    display: "flex", alignItems: "center",
                    justifyContent: isAr(s) ? "flex-end" : "space-between",
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.background = `${ag.hex}08`;
                    e.currentTarget.style.color = t.text;
                    e.currentTarget.style.borderColor = ag.hex + "55";
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.background = t.card;
                    e.currentTarget.style.color = t.muted;
                    e.currentTarget.style.borderColor = t.border;
                  }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {msgs.map(m => <Bubble key={m.id} msg={m} ag={ag} t={t} />)}
        <div ref={endRef} />
      </div>

      {/* ─── INPUT BAR ─── */}
      <div style={{
        padding: "12px 24px 16px",
        borderTop: `1px solid ${t.border}`,
        background: t.panel, flexShrink: 0,
      }}>
        <div style={{
          display: "flex", gap: 8, alignItems: "flex-end",
          background: t.input,
          border: `1px solid ${recording ? t.red : (busy ? t.border : t.border)}`,
          borderRadius: 12, padding: "10px 12px",
          transition: "all .25s",
          boxShadow: recording ? `0 0 24px ${t.red}50`
            : busy ? "none"
            : `0 0 0 1px ${ag.hex}00, 0 0 24px ${ag.hex}10`,
        }}>
          <textarea ref={taRef} value={inp} onChange={resize}
            onKeyDown={onKey}
            placeholder={recording ? "🔴 يستمع... اضغط الميكروفون للإيقاف" : ag.hint}
            rows={1} disabled={busy && !recording}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: t.text,
              resize: "none", fontSize: isAr(inp) ? 15.5 : 14,
              lineHeight: 1.6,
              maxHeight: 160, overflowY: "auto",
              fontFamily: isAr(inp) ? "'Tajawal', 'Inter', sans-serif" : "'Inter', sans-serif",
            }} />

          {/* Send button — primary action */}
          <button onClick={() => send()} disabled={!inp.trim() || busy}
            title="إرسال"
            style={{
              width: 38, height: 38, borderRadius: 9, border: "none", flexShrink: 0,
              background: (!inp.trim() || busy)
                ? t.border
                : `linear-gradient(135deg, ${ag.hex} 0%, ${ag.hex}cc 100%)`,
              color: (!inp.trim() || busy) ? t.muted : "#fff",
              fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: (!inp.trim() || busy) ? "not-allowed" : "pointer",
              transition: "all .2s",
              boxShadow: (!inp.trim() || busy) ? "none" : `0 6px 18px ${ag.hex}55`,
            }}>
            {busy && !recording && !uploading
              ? <div style={{
                  width: 14, height: 14, borderRadius: "50%",
                  border: `2px solid ${t.muted}44`, borderTopColor: t.muted,
                  animation: "acai-spin .65s linear infinite",
                }} />
              : "↑"}
          </button>

          {/* Mic */}
          <button onClick={recording ? stopRecording : startRecording}
            disabled={busy && !recording}
            title={recording ? "إيقاف التسجيل" : "تسجيل صوتي"}
            style={actionBtn(t.red, recording)}>
            {recording ? (
              <div style={{ display: "flex", alignItems: "center", gap: 2, height: 14 }}>
                {[0,1,2].map(i => (
                  <span key={i} style={{
                    display: "block", width: 3, height: 12,
                    background: t.red, borderRadius: 1.5, transformOrigin: "center",
                    animation: `acai-bar 0.8s ease-in-out ${i * 0.15}s infinite`,
                  }}/>
                ))}
              </div>
            ) : "🎤"}
          </button>

          {/* Image */}
          <button onClick={() => imgInputRef.current?.click()} disabled={busy}
            title="رفع صورة للتحليل" style={actionBtn(t.cyan)}>🖼️</button>
          <input ref={imgInputRef} type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
            onChange={handleImageUpload} style={{ display: "none" }} />

          {/* Doc */}
          <button onClick={() => docInputRef.current?.click()} disabled={busy}
            title="رفع مستند (PDF / DOCX / TXT)" style={actionBtn(t.green)}>📄</button>
          <input ref={docInputRef} type="file"
            accept=".pdf,.docx,.txt,.md"
            onChange={handleDocUpload} style={{ display: "none" }} />
        </div>

        {/* Telemetry strip under input */}
        <div style={{
          margin: "8px 4px 0", display: "flex", justifyContent: "space-between",
          alignItems: "center", gap: 8,
          fontSize: 9.5, color: t.faint,
          fontFamily: "'JetBrains Mono', 'Consolas', monospace",
          letterSpacing: "0.06em",
        }}>
          <div style={{ display: "flex", gap: 14 }}>
            <span><span style={{ color: t.red }}>●</span> VOICE</span>
            <span><span style={{ color: t.cyan }}>●</span> VISION</span>
            <span><span style={{ color: t.green }}>●</span> DOCS</span>
          </div>
          <span style={{ color: t.faint }}>
            <span style={{ color: ag.hex }}>{ag.en.toUpperCase()}</span> · {inp.length} CHARS
          </span>
        </div>
      </div>
    </div>
  );
};
