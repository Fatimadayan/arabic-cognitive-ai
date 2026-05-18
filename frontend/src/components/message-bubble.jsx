import { memo, useState, useRef } from "react";
import Markdown from 'react-markdown'

import { Chip } from "./chip";
import { isAr } from "../../utils/arabic";
import { BACKEND } from "../../data/backend";

export const Bubble = memo(({ msg, ag, t }) => {
  if (msg.role === "user") return (
    <div className="bubble" style={{ display:"flex", justifyContent:"flex-end",
      marginBottom:20, animation:"acai-up .25s ease" }}>
      <div style={{ maxWidth:"74%", background:t.userBg,
        border:"1px solid #2563eb22", borderRadius:"18px 18px 4px 18px",
        padding:"13px 18px" }}>
            <Markdown>{msg.content}</Markdown>
      </div>
    </div>
  );

  const ar2 = isAr(msg.content);
  const [ttsState, setTtsState] = useState("idle"); // idle | loading | playing
  const audioRef = useRef(null);

  const playTTS = async () => {
    // Already playing → stop
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
      // Cap text length so TTS is fast (first 1500 chars)
      fd.append("text", msg.content.slice(0, 1500));
      const resp = await fetch(`${BACKEND}/voice/synthesize`, {
        method: "POST", body: fd
      });
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

  return (
    <div className="bubble" style={{ display:"flex", gap:12, marginBottom:24, animation:"acai-up .3s ease" }}>
      <div style={{ width:36, height:36, borderRadius:10, flexShrink:0, marginTop:3,
        background:`${ag.hex}14`, border:`1.5px solid ${ag.hex}44`,
        display:"flex", alignItems:"center", justifyContent:"center",
        color:ag.hex, fontWeight:900,
        fontSize:ag.id==="lughawi"||ag.id==="auto"?19:14,
        fontFamily:ag.id==="lughawi"?"'Scheherazade New',serif":"inherit",
        boxShadow:`0 0 14px ${ag.glow}` }}>
        {ag.icon}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:7 }}>
          <span style={{ fontSize:15, fontWeight:700, color:ag.hex,
            fontFamily:"'Scheherazade New',serif" }}>{ag.ar}</span>
          <span style={{ fontSize:8, padding:"2px 7px", borderRadius:20,
            background:`${ag.hex}18`, color:ag.hex,
            fontWeight:700, letterSpacing:".12em" }}>{ag.badge}</span>
          {msg.streaming && <div style={{ width:11, height:11, borderRadius:"50%",
            border:`1.5px solid ${ag.hex}33`, borderTopColor:ag.hex,
            animation:"acai-spin .65s linear infinite", marginLeft:2 }}/>}
          {msg.latency && !msg.streaming &&
            <span style={{ fontSize:10, color:t.muted, marginLeft:"auto" }}>
              {(msg.latency/1000).toFixed(1)}s
            </span>}
        </div>

        {msg.searches?.length > 0 && (
          <div style={{ marginBottom:8 }}>
            {msg.searches.map((s, i) => <Chip key={i} q={s.q} done={s.done}/>)}
          </div>
        )}

        <div style={{ background:t.card,
          border:`1px solid ${msg.streaming ? ag.hex+"44" : t.border}`,
          borderRadius:"4px 18px 18px 18px", padding:"16px 20px",
          boxShadow:msg.streaming?`0 0 18px ${ag.glow}`:"none",
          transition:"border-color .3s,box-shadow .3s" }}>
          {msg.content
            ? <div style={{ margin:0,
                color:msg.error?"#f87171":t.text,
                fontSize:ar2?17:14.5, lineHeight:1.95,
                whiteSpace:"pre-wrap", wordBreak:"break-word",
                direction:ar2?"rtl":"ltr", textAlign:ar2?"right":"left"}}>
                <Markdown>{msg.content}</Markdown>
              </div>
            : <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                <div style={{ width:15, height:15, borderRadius:"50%",
                  border:`2px solid ${ag.hex}33`, borderTopColor:ag.hex,
                  animation:"acai-spin .65s linear infinite" }}/>
                <span style={{ fontSize:12, color:t.muted,
                  fontFamily:"'Scheherazade New',serif" }}>يعالج...</span>
              </div>}
        </div>

        {/* Action buttons: copy + TTS playback */}
        {!msg.streaming && msg.content && !msg.error && (
          <div style={{ marginTop:6, display:"flex", gap:6, flexWrap:"wrap" }}>
            <button onClick={() => navigator.clipboard.writeText(msg.content)}
              title="نسخ النص"
              style={{ background:"none", border:`1px solid ${t.border}`,
                borderRadius:6, padding:"3px 10px", cursor:"pointer",
                fontSize:11, color:t.muted, transition:"all .2s" }}
              onMouseOver={e=>{e.currentTarget.style.borderColor=ag.hex;
                e.currentTarget.style.color=ag.hex;}}
              onMouseOut={e=>{e.currentTarget.style.borderColor=t.border;
                e.currentTarget.style.color=t.muted;}}>
              ⎘ نسخ
            </button>

            {/* TTS playback button */}
            <button onClick={playTTS}
              title={ttsState === "playing" ? "إيقاف الصوت" : "استمع للرد بصوت بحريني"}
              disabled={ttsState === "loading"}
              style={{
                background: ttsState !== "idle" ? `${ag.hex}18` : "none",
                border:`1px solid ${ttsState !== "idle" ? ag.hex : t.border}`,
                borderRadius:6, padding:"3px 10px",
                cursor: ttsState === "loading" ? "wait" : "pointer",
                fontSize:11, color: ttsState !== "idle" ? ag.hex : t.muted,
                transition:"all .2s",
                display:"inline-flex", alignItems:"center", gap:4
              }}
              onMouseOver={e=>{ if(ttsState==="idle"){
                e.currentTarget.style.borderColor=ag.hex;
                e.currentTarget.style.color=ag.hex;
              }}}
              onMouseOut={e=>{ if(ttsState==="idle"){
                e.currentTarget.style.borderColor=t.border;
                e.currentTarget.style.color=t.muted;
              }}}>
              {ttsState === "loading" && (
                <div style={{ width:9, height:9, borderRadius:"50%",
                  border:`1.5px solid ${ag.hex}40`, borderTopColor:ag.hex,
                  animation:"acai-spin .65s linear infinite" }}/>
              )}
              {ttsState === "playing" && "⏸"}
              {ttsState === "idle" && "🔊"}
              <span>
                {ttsState === "loading" ? "جارٍ التحويل..." :
                 ttsState === "playing" ? "إيقاف" :
                 "استمع"}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
