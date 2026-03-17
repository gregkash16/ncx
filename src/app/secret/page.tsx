"use client";

import { useState, useEffect, useRef } from "react";

interface Conversation {
  user: string;
  assistant: string;
  timestamp: number;
}

export default function DisplayPage() {
  const [conv, setConv] = useState<Conversation | null>(null);
  const [isNew, setIsNew] = useState(false);
  const lastTimestamp = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/secret/conversation");
        const data: Conversation = await res.json();
        if (data.timestamp && data.timestamp !== lastTimestamp.current) {
          lastTimestamp.current = data.timestamp;
          setIsNew(true);
          setTimeout(() => {
            setConv(data);
            setIsNew(false);

            // Play TTS if assistant response exists
            if (data.assistant) {
              playTTS(data.assistant);
            }
          }, 150);
        }
      } catch {}
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, []);

  const playTTS = async (text: string) => {
    try {
      const response = await fetch("/api/secret/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) return;

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
      }
    } catch {}
  };

  const handleClear = async () => {
    setConv(null);
    lastTimestamp.current = 0;
    await fetch("/api/secret/conversation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: "", assistant: "", timestamp: 0 }),
    }).catch(() => {});
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#000000",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Courier New', Courier, monospace",
      color: "#00ff9f",
      overflow: "hidden",
      position: "relative",
    }}>
      {/* Scanline overlay */}
      <div style={{
        position: "fixed",
        inset: 0,
        background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.18) 2px, rgba(0,0,0,0.18) 4px)",
        pointerEvents: "none",
        zIndex: 999,
      }} />

      {/* Corner accents */}
      <div style={{ position: "absolute", top: 0, left: 0, width: 18, height: 18, borderTop: "2px solid #00cfff", borderLeft: "2px solid #00cfff" }} />
      <div style={{ position: "absolute", bottom: 0, right: 0, width: 18, height: 18, borderBottom: "2px solid #00cfff", borderRight: "2px solid #00cfff" }} />

      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        borderBottom: "1px solid rgba(0,255,159,0.2)",
        flexShrink: 0,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: conv ? "#00cfff" : "#333355",
          boxShadow: conv ? "0 0 8px #00cfff" : "none",
          animation: "blink 2s ease-in-out infinite",
        }} />
        <span style={{
          fontSize: 23,
          fontWeight: 700,
          letterSpacing: "0.25em",
          color: "#00cfff",
          textTransform: "uppercase",
          flex: 1,
        }}>
          CL-4UDE // TERMINAL
        </span>
        <button
          onClick={handleClear}
          style={{
            background: "transparent",
            border: "1px solid rgba(0,207,255,0.5)",
            color: "#00cfff",
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.15em",
            padding: "3px 16px",
            cursor: "pointer",
            textTransform: "uppercase",
            opacity: 0.5,
            transition: "all 0.15s ease",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "0.5")}
        >
          CLR
        </button>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        opacity: isNew ? 0 : 1,
        transition: "opacity 0.25s ease",
        overflowY: "auto",
      }}>
        {!conv || !conv.assistant ? (
          <div style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            letterSpacing: "0.15em",
            color: "rgba(0,255,159,0.3)",
            textTransform: "uppercase",
          }}>
            &gt; AWAITING INPUT_
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ fontSize: 15, letterSpacing: "0.2em", color: "rgba(0,255,159,0.45)", textTransform: "uppercase" }}>
                // YOU
              </div>
              <div style={{
                fontSize: 19,
                lineHeight: 1.6,
                padding: "8px 12px",
                borderLeft: "2px solid rgba(0,255,159,0.4)",
                background: "rgba(0,255,159,0.08)",
                color: "#00ff9f",
              }}>
                {conv.user}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ fontSize: 15, letterSpacing: "0.2em", color: "rgba(0,207,255,0.45)", textTransform: "uppercase" }}>
                // CL-4UDE
              </div>
              <div style={{
                fontSize: 22,
                lineHeight: 1.7,
                padding: "10px 14px",
                borderLeft: "2px solid rgba(0,207,255,0.6)",
                background: "rgba(0,207,255,0.08)",
                color: "#00cfff",
                whiteSpace: "pre-wrap",
              }}>
                {conv.assistant}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Status bar */}
      <div style={{
        padding: "4px 16px 8px",
        fontSize: 13,
        letterSpacing: "0.15em",
        color: "rgba(0,207,255,0.4)",
        textTransform: "uppercase",
        borderTop: "1px solid rgba(0,255,159,0.1)",
        flexShrink: 0,
      }}>
        READY
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,255,159,0.2); }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
      `}</style>

      <audio ref={audioRef} />
    </div>
  );
}