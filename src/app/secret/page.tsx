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

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/secret/conversation");
        const data: Conversation = await res.json();
        if (data.timestamp && data.timestamp !== lastTimestamp.current) {
          lastTimestamp.current = data.timestamp;
          setConv(data);
          setIsNew(true);
          setTimeout(() => setIsNew(false), 600);
        }
      } catch {}
    };

    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080810",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Courier New', monospace",
      color: "#c8c8e0",
      padding: "20px",
    }}>
      {/* Header dot */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: 16,
        borderBottom: "1px solid #1e1e2e",
        paddingBottom: 12,
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: "50%",
          background: conv ? "#00ffaa" : "#333355",
          boxShadow: conv ? "0 0 10px #00ffaa88" : "none",
        }} />
        <span style={{ fontSize: 10, letterSpacing: "0.2em", color: "#555580", textTransform: "uppercase" }}>
          claude
        </span>
      </div>

      {!conv || !conv.assistant ? (
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          color: "#333355", fontSize: 12, letterSpacing: "0.1em",
        }}>
          hold alt+` to speak
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          opacity: isNew ? 0 : 1,
          transition: "opacity 0.4s ease",
        }}>
          {/* User query */}
          <div style={{
            fontSize: 11,
            color: "#00ffaa66",
            letterSpacing: "0.05em",
            fontStyle: "italic",
          }}>
            {conv.user}
          </div>

          {/* Claude response */}
          <div style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: "#d0d0f0",
            whiteSpace: "pre-wrap",
          }}>
            {conv.assistant}
          </div>
        </div>
      )}

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
