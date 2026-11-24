import { useCallback, useRef, useState } from "react";
import { BotOutputType, RTVIEvent, type BotOutputData, type TranscriptData } from "@pipecat-ai/client-js";
import { usePipecatClient, useRTVIClientEvent } from "@pipecat-ai/client-react";
import { api } from "../lib/api";
import { playConnect, playEnd, startRing, stopRing } from "../lib/sounds";
import type { CallStatus, TranscriptLine } from "../types";

const MIN_RING_MS = 1600; // let it ring a little even if the bot is ready instantly
const NO_ANSWER_MS = 20000; // give up if the agent never becomes ready

/** Owns the call lifecycle (idle → ringing → connected → ended) and the live transcript. */
export function useCall() {
  const client = usePipecatClient();
  const [status, setStatusState] = useState<CallStatus>("idle");
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [endedAfter, setEndedAfter] = useState(0);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const statusRef = useRef<CallStatus>("idle"); // event callbacks read the latest status from here
  const ringStartedAt = useRef(0);
  const connectedAtRef = useRef<number | null>(null);
  const nextId = useRef(1);
  const nextSegment = useRef(100000);

  const setStatus = (s: CallStatus) => {
    statusRef.current = s;
    setStatusState(s);
  };

  const finish = useCallback(() => {
    if (statusRef.current === "idle" || statusRef.current === "ended") return;
    stopRing();
    playEnd();
    setEndedAfter(connectedAtRef.current ? Math.round((Date.now() - connectedAtRef.current) / 1000) : 0);
    setStatus("ended");
    window.setTimeout(() => {
      if (statusRef.current === "ended") setStatus("idle");
    }, 2200);
  }, []);

  useRTVIClientEvent(
    RTVIEvent.BotReady,
    useCallback(() => {
      const wait = Math.max(0, MIN_RING_MS - (Date.now() - ringStartedAt.current));
      window.setTimeout(() => {
        if (statusRef.current !== "ringing") return;
        stopRing();
        playConnect();
        connectedAtRef.current = Date.now();
        setConnectedAt(connectedAtRef.current);
        setStatus("connected");
      }, wait);
    }, []),
  );

  useRTVIClientEvent(
    RTVIEvent.UserTranscript,
    useCallback((data: TranscriptData) => {
      setLines((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === "user") {
          const updated = data.final
            ? { ...last, text: `${last.text} ${data.text}`.trim(), interim: "" }
            : { ...last, interim: data.text };
          return [...prev.slice(0, -1), updated];
        }
        return [
          ...prev,
          data.final
            ? { id: nextId.current++, role: "user", text: data.text, interim: "" }
            : { id: nextId.current++, role: "user", text: "", interim: data.text },
        ];
      });
    }, []),
  );

  useRTVIClientEvent(
    RTVIEvent.BotOutput,
    useCallback((data: BotOutputData) => {
      const type = data.output_type ?? data.aggregated_by ?? BotOutputType.SENTENCE;
      if (type !== BotOutputType.SENTENCE || !data.text.trim()) return; // skip word/token echoes
      const key = data.segment_id ?? nextSegment.current++;
      setLines((prev) => {
        const last = prev[prev.length - 1];
        const base =
          last && last.role === "agent"
            ? last
            : ({ id: nextId.current++, role: "agent", text: "", interim: "", segments: {} } as TranscriptLine);
        const segments = { ...base.segments, [key]: data.text.trim() };
        const text = Object.keys(segments)
          .map(Number)
          .sort((a, b) => a - b)
          .map((k) => segments[k])
          .join(" ");
        const line = { ...base, segments, text };
        return base === last ? [...prev.slice(0, -1), line] : [...prev, line];
      });
    }, []),
  );

  useRTVIClientEvent(RTVIEvent.Disconnected, useCallback(() => finish(), [finish]));

  const start = useCallback(async () => {
    if (!client || (statusRef.current !== "idle" && statusRef.current !== "error")) return;
    setLines([]);
    setError(null);
    setMuted(false);
    connectedAtRef.current = null;
    setConnectedAt(null);
    ringStartedAt.current = Date.now();
    setStartedAt(ringStartedAt.current);
    setStatus("ringing");
    startRing(); // the click is a user gesture, so audio is allowed to start
    window.setTimeout(() => {
      if (statusRef.current !== "ringing") return;
      stopRing();
      setError("The agent didn't answer. Check the server logs.");
      setStatus("error");
      void client.disconnect().catch(() => undefined);
    }, NO_ANSWER_MS);
    try {
      // Fail fast with a clear message if the server isn't configured, instead of ringing forever.
      const health = await api.health().catch(() => null);
      if (!health) throw new Error("server-down");
      if (health.missingKeys.length) throw new Error(`keys:${health.missingKeys.join(", ")}`);
      await client.initDevices();
      await client.connect({ webrtcRequestParams: { endpoint: "/api/offer" } });
    } catch (e) {
      stopRing();
      const message = e instanceof Error ? e.message : String(e);
      setError(
        message.startsWith("keys:")
          ? `Server is missing ${message.slice(5)} in server/.env.`
          : message === "server-down"
            ? "The server isn't running on port 7860."
            : /permission|denied|notallowed/i.test(message)
              ? "Microphone access is blocked. Allow it in the address bar."
              : "Could not reach the agent. Check the server terminal.",
      );
      setStatus("error");
      try {
        await client.disconnect();
      } catch {
        /* nothing to close */
      }
    }
  }, [client]);

  const end = useCallback(async () => {
    finish();
    try {
      await client?.disconnect();
    } catch {
      /* already closed */
    }
  }, [client, finish]);

  const close = useCallback(() => setStatus("idle"), []);

  const toggleMute = useCallback(() => {
    const next = !muted;
    client?.enableMic(!next);
    setMuted(next);
  }, [client, muted]);

  return { status, lines, connectedAt, startedAt, endedAfter, muted, error, start, end, close, toggleMute };
}

export type CallController = ReturnType<typeof useCall>;
