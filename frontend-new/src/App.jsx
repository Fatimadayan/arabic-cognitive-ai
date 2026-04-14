import { useState, useRef, useEffect, useCallback, memo } from "react";

// ═══════════════════════════════════════════════════════════════════════
//  ع  ACAI v5 — Secure Frontend
//     ALL external calls → backend only. ZERO API keys in this file.
//     Anthropic key lives in backend/.env on the server.
// ═══════════════════════════════════════════════════════════════════════

const BACKEND = "http://localhost:8000";
const API_KEY = "dev-key-12345";  // backend auth only — not an AI API key

const DARK = {
  bg:"#030712", panel:"#060f1e", card:"#070d1a", input:"#040a16",
  border:"#0e2040", text:"#e2e8f0", muted:"#4a6280", faint:"#0e2040",
  sub:"#0a1628", userBg:"linear-gradient(135deg,#1a3560,#0f2444)",
};
const LIGHT = {
  bg:"#f0f4f8", panel:"#ffffff", card:"#ffffff", input:"#f8fafc",
  border:"#e2e8f0", text:"#0f172a", muted:"#64748b", faint:"#e2e8f0",
  sub:"#f1f5f9", userBg:"linear-gradient(135deg,#1e40af,#1d4ed8)",
};

const AGENTS = [
  {
    id:"bahith", ar:"باحث", en:"Researcher",
    title:"البحث في الويب بالذكاء الاصطناعي", badge:"WEB SEARCH",
    icon:"◉", hex:"#06b6d4", glow:"#06b6d428",
    hint:"ابحث عن أي موضوع... سأبحث في الويب عبر الباكند",
    tips:[
      "ما أحدث تطورات الذكاء الاصطناعي في الخليج؟",
      "What are Bahrain CBB regulations for fintech 2025?",
      "مقارنة بين GPT-4o و Qwen2.5 للغة العربية",
    ],
    mode: "single:bahith",
  },
  {
    id:"hakeem", ar:"حكيم", en:"Reasoner",
    title:"التفكير العميق والاستدلال", badge:"DEEP THINK",
    icon:"◈", hex:"#7c3aed", glow:"#7c3aed28",
    hint:"اطرح مشكلة معقدة... سأفكر خطوة بخطوة",
    tips:[
      "لماذا يُعدّ الذكاء الاصطناعي العام تهديداً وجودياً؟",
      "Analyze the AI alignment problem from first principles",
      "هل يمكن للأخلاق أن تكون نسبية تماماً؟",
    ],
    mode: "single:hakeem",
  },
  {
    id:"musheer", ar:"مشير", en:"GCC Advisor",
    title:"مستشار أنظمة الخليج والمصارف", badge:"GCC LAW",
    icon:"◆", hex:"#d97706", glow:"#d9770628",
    hint:"اسأل عن أنظمة CBB، SAMA، رؤية 2030...",
    tips:[
      "ما متطلبات ترخيص البنك في البحرين؟",
      "ما الفرق بين تنظيم CBB و SAMA للذكاء الاصطناعي؟",
      "ما أهداف رؤية البحرين 2030 الاقتصادية؟",
    ],
    mode: "single:musheer",
  },
  {
    id:"lughawi", ar:"لغوي", en:"Arabic Expert",
    title:"اللغة العربية واللهجات", badge:"ARABIC NLP",
    icon:"ع", hex:"#059669", glow:"#05966928",
    hint:"أدخل أي نص عربي... سأحلل اللهجة والصرف",
    tips:[
      "والله يا شباب الحين وايد زين هالمشروع حيل",
      "هذا النظام combines AI مع اللغة العربية الحديثة",
      "إيه رأيك في الذكاء الاصطناعي؟ أنا عايز أعرف",
    ],
    mode: "single:lughawi",
  },
  {
    id:"muraqib", ar:"مراقب", en:"Fact Checker",
    title:"التحقق من صحة المعلومات", badge:"VERIFY",
    icon:"◎", hex:"#dc2626", glow:"#dc262628",
    hint:"أرسل معلومة... سأتحقق من صحتها",
    tips:[
      "البحرين هي أكبر دولة في الخليج العربي",
      "GPT-4 was released in 2021 with 1 trillion parameters",
      "يضم مجلس التعاون الخليجي 8 دول عربية",
    ],
    mode: "single:muraqib",
  },
  {
    id:"bani", ar:"بانِ", en:"Knowledge Graph",
    title:"استخراج المعرفة والكيانات", badge:"KG EXTRACT",
    icon:"⬡", hex:"#6d28d9", glow:"#6d28d928",
    hint:"أرسل نصاً... سأستخرج الكيانات والعلاقات",
    tips:[
      "مصرف البحرين المركزي ينظم القطاع المصرفي ويحمي المستهلكين",
      "أنثروبيك وأوبن إيه آي وغوغل تتنافس في مجال الذكاء الاصطناعي",
      "رؤية 2030 تهدف لتنويع الاقتصاد عبر التقنية والسياحة",
    ],
    mode: "single:bani",
  },
  {
    id:"auto", ar:"ذكي", en:"Auto-Route",
    title:"الوضع الذكي — يختار الوكلاء تلقائياً", badge:"AUTO",
    icon:"⚡", hex:"#f59e0b", glow:"#f59e0b28",
    hint:"اسأل أي شيء... سأختار أفضل وكلاء تلقائياً",
    tips:[
      "ما أحدث أنظمة CBB للفنتك وهل هي متوافقة مع الذكاء الاصطناعي؟",
      "حلل جملة: الحين وايد تعبان من الشغل — وهل هي صحيحة نظامياً؟",
      "What makes Bahrain's financial regulations unique in the GCC?",
    ],
    mode: "auto",
  },
];

const isAr = t => /[\u0600-\u06FF]{3,}/.test(t || "");
const headers = { "Content-Type":"application/json", "X-API-Key": API_KEY };

// ─── Backend query call (streaming) ──────────────────────────────────────────
async function callBackend(query, mode, agentId, onChunk, onSearch, onDone, onError) {
  try {
    // Announce which agents will run (via health check intent)
    onSearch("⚙️ " + mode.replace("single:",""));

    const r = await fetch(`${BACKEND}/api/query/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, mode, session_id: agentId }),
    });

    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${r.status}`);
    }

    const reader = r.body.getReader();
    const dec    = new TextDecoder();
    let   buf    = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const d = JSON.parse(line.slice(6));
          if (d.type === "chunk" && d.text) onChunk(d.text);
          if (d.type === "done") {
            if (d.pipeline?.length > 1) {
              d.pipeline.forEach(a => onSearch(`✓ ${a}`));
            }
            onDone(d);
            return;
          }
          if (d.type === "error") { onError(d.error); return; }
        } catch {}
      }
    }
    onDone({});
  } catch (e) {
    onError(e.message);
  }
}

// ─── Chip component ───────────────────────────────────────────────────────────
const Chip = ({ q, done }) => (
  <span style={{
    display:"inline-flex", alignItems:"center", gap:5,
    padding:"3px 10px", borderRadius:20, marginRight:6, marginBottom:4,
    background: done ? "#06b6d418" : "#06b6d40e",
    border: `1px solid ${done ? "#06b6d455" : "#06b6d422"}`,
    animation: "acai-up .2s ease",
  }}>
    {!done
      ? <div style={{ width:8, height:8, borderRadius:"50%",
          border:"1.5px solid #06b6d430", borderTopColor:"#06b6d4",
          animation:"acai-spin .65s linear infinite" }}/>
      : <span style={{ fontSize:9, color:"#06b6d4" }}>✓</span>}
    <span style={{ fontSize:11, color:"#06b6d4", maxWidth:230,
      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{q}</span>
  </span>
);

// ─── Message bubble ───────────────────────────────────────────────────────────
const Bubble = memo(({ msg, ag, t }) => {
  const ar = isAr(msg.content);
  if (msg.role === "user") return (
    <div style={{ display:"flex", justifyContent:"flex-end",
      marginBottom:20, animation:"acai-up .25s ease" }}>
      <div style={{ maxWidth:"74%", background:t.userBg,
        border:"1px solid #2563eb22", borderRadius:"18px 18px 4px 18px",
        padding:"13px 18px" }}>
        <p style={{ margin:0, color:"#e2e8f0",
          fontSize:ar?17:14.5, lineHeight:1.85,
          direction:ar?"rtl":"ltr", textAlign:ar?"right":"left",
          fontFamily:ar?"'Scheherazade New',serif":"inherit",
          whiteSpace:"pre-wrap" }}>{msg.content}</p>
      </div>
    </div>
  );

  const ar2 = isAr(msg.content);
  return (
    <div style={{ display:"flex", gap:12, marginBottom:24, animation:"acai-up .3s ease" }}>
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
            ? <p style={{ margin:0,
                color:msg.error?"#f87171":t.text,
                fontSize:ar2?17:14.5, lineHeight:1.95,
                whiteSpace:"pre-wrap", wordBreak:"break-word",
                direction:ar2?"rtl":"ltr", textAlign:ar2?"right":"left",
                fontFamily:ar2?"'Scheherazade New',serif"
                              :"'JetBrains Mono','Fira Code',monospace" }}>
                {msg.content}
                {msg.streaming &&
                  <span style={{ opacity:.5, animation:"acai-blink 1s infinite" }}>▌</span>}
              </p>
            : <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                <div style={{ width:15, height:15, borderRadius:"50%",
                  border:`2px solid ${ag.hex}33`, borderTopColor:ag.hex,
                  animation:"acai-spin .65s linear infinite" }}/>
                <span style={{ fontSize:12, color:t.muted,
                  fontFamily:"'Scheherazade New',serif" }}>يعالج...</span>
              </div>}
        </div>

        {!msg.streaming && msg.content && !msg.error && (
          <div style={{ marginTop:6 }}>
            <button onClick={() => navigator.clipboard.writeText(msg.content)}
              style={{ background:"none", border:`1px solid ${t.border}`,
                borderRadius:6, padding:"3px 10px", cursor:"pointer",
                fontSize:11, color:t.muted, transition:"all .2s" }}
              onMouseOver={e=>{e.currentTarget.style.borderColor=ag.hex;
                e.currentTarget.style.color=ag.hex;}}
              onMouseOut={e=>{e.currentTarget.style.borderColor=t.border;
                e.currentTarget.style.color=t.muted;}}>
              ⎘ نسخ
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

// ─── Chat panel ───────────────────────────────────────────────────────────────
const ChatPanel = ({ ag, theme }) => {
  const t    = theme === "dark" ? DARK : LIGHT;
  const [msgs, setMsgs] = useState([]);
  const [inp,  setInp]  = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  const taRef  = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [msgs]);

  const send = useCallback(async (text) => {
    const q = (text || inp).trim();
    if (!q || busy) return;
    setInp(""); if (taRef.current) taRef.current.style.height = "auto";
    setBusy(true);

    const uid = Date.now(), aid = uid + 1;
    setMsgs(p => [...p,
      { id:uid, role:"user", content:q },
      { id:aid, role:"assistant", content:"", streaming:true, searches:[] }
    ]);
    const t0 = Date.now();
    const upd = fn => setMsgs(p => p.map(m => m.id === aid ? fn(m) : m));

    await callBackend(
      q, ag.mode, ag.id,
      chunk  => upd(m => ({ ...m, content: m.content + chunk })),
      q2     => upd(m => ({ ...m, searches: [...m.searches, { q:q2, done:false }] })),
      (meta) => upd(m => ({
        ...m, streaming:false,
        latency: Date.now() - t0,
        searches: m.searches.map(s => ({ ...s, done:true }))
      })),
      err    => upd(m => ({
        ...m,
        content: `خطأ في الاتصال: ${err}\n\nتأكد من تشغيل:\ncd backend && uvicorn main_v5:app --port 8000`,
        streaming:false, error:true
      })),
    );
    setBusy(false);
  }, [inp, busy, ag]);

  const onKey  = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };
  const resize = e => {
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
    setInp(e.target.value);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column",
      height:"100%", overflow:"hidden" }}>

      {/* Agent header */}
      <div style={{ padding:"18px 28px", borderBottom:`1px solid ${t.border}`,
        background:t.panel, flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:52, height:52, borderRadius:14,
            background:`${ag.hex}12`, border:`2px solid ${ag.hex}44`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:ag.id==="lughawi"?26:ag.id==="auto"?24:21,
            color:ag.hex, fontWeight:900,
            fontFamily:ag.id==="lughawi"?"'Scheherazade New',serif":"inherit",
            boxShadow:`0 0 24px ${ag.glow}` }}>
            {ag.icon}
          </div>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <h2 style={{ margin:0, fontSize:22, fontWeight:700,
                color:ag.hex, fontFamily:"'Scheherazade New',serif" }}>{ag.ar}</h2>
              <span style={{ fontSize:13, color:t.muted }}>{ag.en}</span>
              {ag.id === "auto" && (
                <span style={{ fontSize:9, padding:"2px 8px", borderRadius:20,
                  background:"#f59e0b18", color:"#f59e0b",
                  border:"1px solid #f59e0b33", fontWeight:700,
                  letterSpacing:".1em", animation:"acai-pulse 2s infinite" }}>
                  ⚡ SMART ROUTE
                </span>
              )}
            </div>
            <p style={{ margin:0, fontSize:12, color:t.muted,
              fontFamily:"'Scheherazade New',serif" }}>{ag.title}</p>
          </div>
          <div style={{ marginLeft:"auto", padding:"5px 14px", borderRadius:20,
            background:`${ag.hex}12`, border:`1px solid ${ag.hex}33`,
            fontSize:10, color:ag.hex, fontWeight:700,
            letterSpacing:".12em" }}>{ag.badge}</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto",
        padding:"24px 28px", background:t.bg }}>
        {msgs.length === 0 && (
          <div style={{ textAlign:"center", padding:"40px 16px",
            animation:"acai-up .5s ease" }}>
            <div style={{ width:90, height:90, borderRadius:24,
              margin:"0 auto 20px",
              background:`${ag.hex}0e`, border:`2px solid ${ag.hex}2a`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:40, color:ag.hex, fontWeight:900,
              fontFamily:ag.id==="lughawi"?"'Scheherazade New',serif":"inherit",
              boxShadow:`0 0 36px ${ag.glow}`,
              animation:"acai-float 5s ease-in-out infinite" }}>
              {ag.icon}
            </div>
            <h3 style={{ margin:"0 0 10px", fontSize:21, fontWeight:700,
              color:t.text, fontFamily:"'Scheherazade New',serif" }}>
              {ag.title}
            </h3>
            <p style={{ margin:"0 0 30px", color:t.muted, fontSize:13,
              maxWidth:420, marginLeft:"auto", marginRight:"auto",
              fontFamily:"'Scheherazade New',serif",
              direction:"rtl", lineHeight:1.9 }}>
              {ag.id === "auto"
                ? "يحلل سؤالك ويختار أفضل وكلاء تلقائياً — Researcher + GCC Advisor + Reasoner + Verifier"
                : ag.badge + " · " + ag.en}
            </p>
            <div style={{ display:"flex", flexDirection:"column",
              gap:8, maxWidth:520, margin:"0 auto" }}>
              {ag.tips.map((s, i) => (
                <button key={i} onClick={() => send(s)}
                  style={{ background:t.sub,
                    border:`1px solid ${t.border}`,
                    borderLeft:`3px solid ${ag.hex}`,
                    borderRadius:12, padding:"12px 16px",
                    color:t.muted, cursor:"pointer",
                    transition:"all .2s",
                    fontSize:isAr(s)?15:13.5,
                    fontFamily:isAr(s)?"'Scheherazade New',serif":"inherit",
                    direction:isAr(s)?"rtl":"ltr",
                    textAlign:isAr(s)?"right":"left" }}
                  onMouseOver={e=>{e.currentTarget.style.background=`${ag.hex}0a`;
                    e.currentTarget.style.color=t.text;}}
                  onMouseOut={e=>{e.currentTarget.style.background=t.sub;
                    e.currentTarget.style.color=t.muted;}}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {msgs.map(m => <Bubble key={m.id} msg={m} ag={ag} t={t}/>)}
        <div ref={endRef}/>
      </div>

      {/* Input */}
      <div style={{ padding:"14px 28px 20px",
        borderTop:`1px solid ${t.border}`,
        background:t.panel, flexShrink:0 }}>
        <div style={{ display:"flex", gap:10, alignItems:"flex-end",
          background:t.input,
          border:`1.5px solid ${busy?t.border:ag.hex+"55"}`,
          borderRadius:16, padding:"12px 14px",
          transition:"all .25s",
          boxShadow:busy?"none":`0 0 20px ${ag.glow}` }}>
          <textarea ref={taRef} value={inp} onChange={resize}
            onKeyDown={onKey} placeholder={ag.hint}
            rows={1} disabled={busy}
            style={{ flex:1, background:"transparent",
              border:"none", outline:"none", color:t.text,
              resize:"none", fontSize:isAr(inp)?16:14.5,
              lineHeight:1.65,
              fontFamily:isAr(inp)?"'Scheherazade New',serif":"inherit",
              direction:isAr(inp)?"rtl":"ltr",
              maxHeight:160, overflowY:"auto" }}/>
          <button onClick={() => send()} disabled={!inp.trim() || busy}
            style={{ width:40, height:40, borderRadius:12, border:"none",
              flexShrink:0,
              background: (!inp.trim()||busy) ? t.border
                : `linear-gradient(135deg,${ag.hex},${ag.hex}bb)`,
              color: (!inp.trim()||busy) ? t.muted : "#fff",
              fontSize:18, display:"flex", alignItems:"center",
              justifyContent:"center",
              cursor:(!inp.trim()||busy)?"not-allowed":"pointer",
              transition:"all .2s",
              boxShadow:(!inp.trim()||busy)?"none":`0 4px 14px ${ag.glow}` }}>
            {busy
              ? <div style={{ width:15, height:15, borderRadius:"50%",
                  border:`2px solid ${t.muted}44`,
                  borderTopColor:t.muted,
                  animation:"acai-spin .65s linear infinite" }}/>
              : "↑"}
          </button>
        </div>
        <p style={{ margin:"8px 0 0", textAlign:"center",
          fontSize:10, color:t.faint }}>
          {ag.ar} · {ag.badge} · ACAI v5 — University of Bahrain | Benefit AI Lab
        </p>
      </div>
    </div>
  );
};

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [active, setActive]   = useState("auto");
  const [theme,  setTheme]    = useState("dark");
  const [sidebar,setSidebar]  = useState(true);
  const [health, setHealth]   = useState(null);
  const t  = theme === "dark" ? DARK : LIGHT;
  const ag = AGENTS.find(a => a.id === active);

  useEffect(() => {
    const check = () =>
      fetch(`${BACKEND}/api/health`)
        .then(r => r.json()).then(() => setHealth(true))
        .catch(() => setHealth(false));
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{ height:"100vh", display:"flex", flexDirection:"column",
      background:t.bg, color:t.text,
      fontFamily:"'JetBrains Mono','Fira Code',monospace",
      overflow:"hidden", transition:"background .3s,color .3s" }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Scheherazade+New:wght@400;500;600;700&family=JetBrains+Mono:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:${t.sub};border-radius:2px;}
        textarea,button{font-family:inherit;}
        @keyframes acai-spin{to{transform:rotate(360deg)}}
        @keyframes acai-up{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:translateY(0)}}
        @keyframes acai-blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes acai-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
        @keyframes acai-pulse{0%,100%{opacity:1}50%{opacity:.4}}
      `}</style>

      {/* TOP BAR */}
      <header style={{ height:54, flexShrink:0, background:t.panel,
        borderBottom:`1px solid ${t.border}`,
        display:"flex", alignItems:"center",
        padding:"0 18px", gap:12, zIndex:10 }}>

        <button onClick={() => setSidebar(o => !o)}
          style={{ background:"none", border:"none", cursor:"pointer",
            color:t.muted, fontSize:17, padding:"4px 6px" }}
          onMouseOver={e=>e.currentTarget.style.color=t.text}
          onMouseOut={e=>e.currentTarget.style.color=t.muted}>
          {sidebar ? "◀" : "▶"}
        </button>

        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <div style={{ width:32, height:32, borderRadius:9,
            background:"#c9960018", border:"1.5px solid #c9960040",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:19, fontFamily:"'Scheherazade New',serif",
            color:"#c99600", fontWeight:700,
            boxShadow:"0 0 12px #c9960020" }}>ع</div>
          <div>
            <div style={{ fontSize:12, fontWeight:700, letterSpacing:".1em",
              color:t.muted, lineHeight:1 }}>ACAI</div>
            <div style={{ fontSize:8, color:t.faint,
              fontFamily:"'Scheherazade New',serif",
              lineHeight:1.2 }}>المعرفي العربي</div>
          </div>
        </div>

        <div style={{ padding:"4px 12px", borderRadius:20,
          background:`${ag.hex}12`, border:`1px solid ${ag.hex}33`,
          display:"flex", alignItems:"center", gap:7 }}>
          <span style={{ color:ag.hex, fontSize:14, fontWeight:700,
            fontFamily:"'Scheherazade New',serif" }}>{ag.ar}</span>
          <span style={{ fontSize:8, color:ag.hex, opacity:.65 }}>{ag.badge}</span>
        </div>

        <div style={{ marginLeft:"auto", display:"flex",
          alignItems:"center", gap:12 }}>
          {/* Dark/Light toggle */}
          <button onClick={() => setTheme(th => th==="dark"?"light":"dark")}
            style={{ width:40, height:22, borderRadius:11, cursor:"pointer",
              position:"relative",
              background:theme==="dark"?"#1e3a5f":"#e2e8f0",
              border:`1px solid ${t.border}`,
              transition:"all .3s", flexShrink:0 }}>
            <div style={{ position:"absolute", top:3,
              left:theme==="dark"?3:19,
              width:14, height:14, borderRadius:"50%",
              background:theme==="dark"?"#38bdf8":"#f59e0b",
              transition:"left .25s", display:"flex",
              alignItems:"center", justifyContent:"center",
              fontSize:8 }}>
              {theme==="dark"?"🌙":"☀️"}
            </div>
          </button>

          {/* Health */}
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:7, height:7, borderRadius:"50%",
              background: health===null?"#f59e0b":health?"#22c55e":"#ef4444",
              animation:health===null?"acai-pulse 1.5s infinite":"none",
              boxShadow:`0 0 5px ${health?"#22c55e":"#ef4444"}` }}/>
            <span style={{ fontSize:9, color:t.muted }}>
              {health===null?"...":health?"Live":"Offline"}
            </span>
          </div>
        </div>
      </header>

      <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

        {/* SIDEBAR */}
        <aside style={{ width:sidebar?260:0, overflow:"hidden",
          transition:"width .22s ease",
          background:t.panel, borderRight:`1px solid ${t.border}`,
          flexShrink:0 }}>
          <div style={{ width:260, padding:"14px 12px" }}>
            <p style={{ fontSize:8, color:t.faint, letterSpacing:".18em",
              marginBottom:10, paddingLeft:4, fontWeight:700 }}>
              ◈ COGNITIVE AGENTS
            </p>
            {AGENTS.map(a => {
              const on = a.id === active;
              return (
                <button key={a.id} onClick={() => setActive(a.id)}
                  style={{ width:"100%", marginBottom:3, padding:"10px 11px",
                    background:on?`${a.hex}0f`:"transparent",
                    border:on?`1px solid ${a.hex}33`:"1px solid transparent",
                    borderLeft:`3px solid ${on?a.hex:"transparent"}`,
                    borderRadius:10, cursor:"pointer", textAlign:"left",
                    display:"flex", alignItems:"center", gap:10,
                    transition:"all .18s",
                    boxShadow:on?`inset 0 0 20px ${a.glow}`:"none" }}
                  onMouseOver={e=>{if(!on){
                    e.currentTarget.style.background=`${a.hex}07`;
                    e.currentTarget.style.borderLeftColor=`${a.hex}55`;}}}
                  onMouseOut={e=>{if(!on){
                    e.currentTarget.style.background="transparent";
                    e.currentTarget.style.borderLeftColor="transparent";}}}>

                  <div style={{ width:32, height:32, borderRadius:9, flexShrink:0,
                    background:`${a.hex}${on?"16":"0a"}`,
                    border:`1px solid ${a.hex}${on?"44":"22"}`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    color:on?a.hex:`${a.hex}88`, fontWeight:900,
                    fontSize:a.id==="lughawi"?17:14,
                    fontFamily:a.id==="lughawi"?"'Scheherazade New',serif":"inherit",
                    boxShadow:on?`0 0 9px ${a.glow}`:"none" }}>
                    {a.icon}
                  </div>

                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <span style={{ fontSize:15, fontWeight:on?700:500,
                        color:on?a.hex:t.muted,
                        fontFamily:"'Scheherazade New',serif",
                        lineHeight:1 }}>{a.ar}</span>
                      <span style={{ fontSize:8,
                        color:on?`${a.hex}99`:t.faint }}>{a.en}</span>
                    </div>
                    <div style={{ fontSize:10, color:t.faint, marginTop:2,
                      whiteSpace:"nowrap", overflow:"hidden",
                      textOverflow:"ellipsis",
                      fontFamily:"'Scheherazade New',serif" }}>
                      {a.title}
                    </div>
                  </div>

                  {on && <div style={{ width:5, height:5, borderRadius:"50%",
                    background:a.hex, boxShadow:`0 0 7px ${a.hex}`,
                    flexShrink:0 }}/>}
                </button>
              );
            })}

            <div style={{ marginTop:16, padding:"10px 8px",
              borderTop:`1px solid ${t.border}` }}>
              <p style={{ fontSize:9, color:t.faint, lineHeight:1.9 }}>
                كل عميل معزول تماماً<br/>
                <span style={{ opacity:.5 }}>No API keys in browser</span><br/>
                <span style={{ opacity:.4 }}>ACAI v5 · UOB · 2026</span>
              </p>
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <main style={{ flex:1, overflow:"hidden" }}>
          <ChatPanel key={active} ag={ag} theme={theme}/>
        </main>
      </div>
    </div>
  );
}
