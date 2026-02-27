"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type GoalPayload = {
  gameId?: number;
  goalId?: number | string;
  period?: number;
  timeInPeriod?: string;
  scorer?: string;
  strength?: string;
};

export default function GoalClient() {
  const [connected, setConnected] = useState(false);
  const [lastGoal, setLastGoal] = useState<GoalPayload | null>(null);
  const [firing, setFiring] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopTimerRef = useRef<number | null>(null);

  const sseUrl = useMemo(() => `/api/nhl/goal/stream`, []);

  const stop = () => {
    setFiring(false);

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    if (stopTimerRef.current) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  };

  const fire = async (payload: GoalPayload, reason: "goal" | "test") => {
    setLastGoal(payload);
    setFiring(true);

    const audio = audioRef.current;

    try {
      if (audio) {
        audio.currentTime = 0;
        audio.loop = true;
        audio.muted = false;
        audio.volume = 0.1; // 50% volume (0.0 – 1.0)
        await audio.play();
    }
    } catch (e) {
      console.warn("Playback failed:", e);
    }

    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = window.setTimeout(() => {
      stop();
    }, 10_000);
  };

  useEffect(() => {
    const es = new EventSource(sseUrl);

    es.addEventListener("open", () => setConnected(true));
    es.addEventListener("error", () => setConnected(false));

    es.addEventListener("goal", (evt) => {
      try {
        const data = JSON.parse((evt as MessageEvent).data) as GoalPayload;
        fire(data, "goal");
      } catch {}
    });

    return () => {
      es.close();
      stop();
    };
  }, [sseUrl]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">

      {/* Audio */}
      <audio ref={audioRef} src="/goal/horn.mp3" preload="auto" />

      {/* Red Strobe Overlay */}
      <div
        className={[
          "absolute inset-0 pointer-events-none transition-opacity duration-200",
          firing ? "opacity-100" : "opacity-0"
        ].join(" ")}
      >
        <div className="absolute inset-0 red-strobe" />
      </div>

      {/* Status + Controls */}
      <div className="absolute left-4 top-4 z-20 flex items-start gap-3 rounded-md bg-black/50 px-3 py-2 text-xs text-white backdrop-blur">
        <div>
          <div className="font-semibold">BUF Goal Light</div>
          <div className="opacity-80">
            {connected ? "Connected" : "Disconnected"}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            className="rounded-md bg-white/15 px-3 py-1 text-white hover:bg-white/25"
            onClick={() =>
              fire(
                {
                  scorer: "TEST",
                  strength: "N/A",
                  period: 0,
                  timeInPeriod: "00:00",
                },
                "test"
              )
            }
          >
            Test horn
          </button>

          <button
            className="rounded-md bg-white/10 px-3 py-1 text-white/90 hover:bg-white/20"
            onClick={stop}
          >
            Stop
          </button>
        </div>
      </div>

      {/* Goal Text */}
      {firing && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="rounded-3xl border border-white/30 bg-black/70 px-16 py-12 text-center text-white backdrop-blur-lg shadow-2xl">
            <div className="text-6xl md:text-7xl font-extrabold tracking-widest">
                GOAL
            </div>

            <div className="mt-6 text-2xl md:text-3xl font-semibold">
                {lastGoal?.scorer ? lastGoal.scorer : "Buffalo Sabres"}
            </div>

            <div className="mt-3 text-lg opacity-80">
                {lastGoal?.strength ? `${lastGoal.strength}` : ""}
                {lastGoal?.period !== undefined ? ` • P${lastGoal.period}` : ""}
                {lastGoal?.timeInPeriod ? ` • ${lastGoal.timeInPeriod}` : ""}
            </div>
            </div>
        </div>
      )}

      <style jsx>{`
        .red-strobe {
          background: radial-gradient(
            circle at center,
            rgba(255, 0, 0, 0.85),
            rgba(120, 0, 0, 0.7),
            rgba(0, 0, 0, 0.95)
          );
          animation: strobe 0.15s infinite alternate;
        }

        @keyframes strobe {
          from { opacity: 0.25; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}