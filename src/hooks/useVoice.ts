import { useState, useRef, useCallback, useEffect } from "react";
import type {
  VoicePhase,
  VoicePermission,
  UseVoiceOptions,
  UseVoiceReturn,
} from "../types.js";

// ---- TTS Chunking Config ----

const INITIAL_MIN_CHARS = 30;
const GROWTH_FACTOR = 1.5;
const MAX_CHUNK_CHARS = 300;
const FORCE_SPLIT_MULTIPLIER = 2.5;

/**
 * Find the best break point in the buffer for TTS chunking.
 * Returns the index to split AT (exclusive), or -1 if no suitable break found.
 *
 * Break points (priority order):
 * 1. Paragraph break (\n\n)
 * 2. Sentence end (. ! ? followed by space or end)
 * 3. Clause break (, ; : -- followed by space)
 * 4. Line break (\n)
 * 5. Any space (last resort at 2.5x minimum)
 */
function findBreakPoint(buffer: string, minChars: number): number {
  if (buffer.length < minChars) return -1;

  const searchRegion = buffer.slice(minChars);

  // 1. Paragraph break
  const paraIdx = searchRegion.indexOf("\n\n");
  if (paraIdx !== -1) return minChars + paraIdx + 2;

  // 2. Sentence end
  for (let i = 0; i < searchRegion.length; i++) {
    const ch = searchRegion[i];
    if (ch === "." || ch === "!" || ch === "?") {
      const next = searchRegion[i + 1];
      if (
        next === undefined ||
        next === " " ||
        next === "\n" ||
        next === '"' ||
        next === "'"
      ) {
        // Skip decimals like "3.5"
        if (
          ch === "." &&
          i > 0 &&
          /\d/.test(searchRegion[i - 1]) &&
          next &&
          /\d/.test(next)
        ) {
          continue;
        }
        return minChars + i + 1;
      }
    }
  }

  // 3. Clause break
  for (let i = 0; i < searchRegion.length; i++) {
    const ch = searchRegion[i];
    if (
      (ch === "," || ch === ";" || ch === ":" || ch === "\u2014") &&
      searchRegion[i + 1] === " "
    ) {
      return minChars + i + 2;
    }
  }

  // 4. Line break
  const newlineIdx = searchRegion.indexOf("\n");
  if (newlineIdx !== -1) return minChars + newlineIdx + 1;

  // 5. Force split at any space if buffer is very long
  const forceThreshold = minChars * FORCE_SPLIT_MULTIPLIER;
  if (buffer.length >= forceThreshold) {
    const lastSpace = buffer.lastIndexOf(" ", buffer.length - 1);
    if (lastSpace >= minChars) return lastSpace + 1;
  }

  return -1;
}

// ---- Hook ----

export function useVoice(options: UseVoiceOptions = {}): UseVoiceReturn {
  const {
    apiUrl = "",
    token,
    transcribeUrl = "/api/v1/voice/transcribe",
    synthesizeUrl = "/api/v1/voice/synthesize",
    onTranscription,
    onPhaseChange,
    onError,
  } = options;

  const [phase, setPhaseState] = useState<VoicePhase>("idle");
  const [amplitude, setAmplitude] = useState(0);
  const [permission, setPermission] = useState<VoicePermission>("prompt");
  const [error, setError] = useState<string | null>(null);

  // Keep stable references to callbacks
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // ---- Audio recording refs ----
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animFrameRef = useRef<number>(0);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  // ---- TTS playback refs ----
  const ttsBufferRef = useRef("");
  const ttsChunkIndexRef = useRef(0);
  const ttsMinCharsRef = useRef(INITIAL_MIN_CHARS);
  const ttsQueueRef = useRef<
    Array<{ index: number; promise: Promise<Blob | null> }>
  >([]);
  const ttsPlayingRef = useRef(false);
  const ttsStoppedRef = useRef(false);
  const ttsHasPlayedRef = useRef(false);
  const ttsAudioCtxRef = useRef<AudioContext | null>(null);
  const ttsSourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const ttsCurrentAudioRef = useRef<HTMLAudioElement | null>(null);

  // ---- Phase management ----

  const setPhase = useCallback(
    (newPhase: VoicePhase) => {
      setPhaseState(newPhase);
      onPhaseChange?.(newPhase);
    },
    [onPhaseChange]
  );

  // ---- URL helpers ----

  const makeUrl = useCallback(
    (path: string): string => {
      const base = apiUrl.replace(/\/$/, "");
      return `${base}${path}`;
    },
    [apiUrl]
  );

  const makeHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = {};
    if (token) {
      h["Authorization"] = `Bearer ${token}`;
    }
    return h;
  }, [token]);

  // ---- TTS AudioContext ----

  const getTtsAudioContext = useCallback((): AudioContext => {
    if (!ttsAudioCtxRef.current || ttsAudioCtxRef.current.state === "closed") {
      ttsAudioCtxRef.current = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext)();
    }
    return ttsAudioCtxRef.current;
  }, []);

  const unlockTtsAudioContext = useCallback(() => {
    const ctx = getTtsAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    // Play a silent buffer to fully unlock on iOS
    try {
      const silentBuffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = silentBuffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      // Best effort
    }
  }, [getTtsAudioContext]);

  // ---- TTS synthesis ----

  const synthesize = useCallback(
    async (text: string): Promise<Blob | null> => {
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...makeHeaders(),
        };
        const res = await fetch(makeUrl(synthesizeUrl), {
          method: "POST",
          headers,
          credentials: token ? "omit" : "include",
          body: JSON.stringify({ text }),
        });
        if (!res.ok) return null;
        return await res.blob();
      } catch {
        return null;
      }
    },
    [makeUrl, makeHeaders, synthesizeUrl, token]
  );

  // ---- TTS playback ----

  const playBlob = useCallback(
    async (blob: Blob): Promise<void> => {
      const ctx = getTtsAudioContext();
      if (ctx.state === "suspended") {
        await ctx.resume().catch(() => {});
      }

      try {
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

        return new Promise<void>((resolve) => {
          if (ttsStoppedRef.current) {
            resolve();
            return;
          }
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          ttsSourceNodeRef.current = source;
          source.onended = () => {
            ttsSourceNodeRef.current = null;
            resolve();
          };
          source.start(0);
        });
      } catch {
        // Fallback to HTML Audio
        const url = URL.createObjectURL(blob);
        try {
          await new Promise<void>((resolve, reject) => {
            if (ttsStoppedRef.current) {
              resolve();
              return;
            }
            const audio = new Audio(url);
            ttsCurrentAudioRef.current = audio;
            audio.onended = () => {
              ttsCurrentAudioRef.current = null;
              resolve();
            };
            audio.onerror = () => {
              ttsCurrentAudioRef.current = null;
              reject(new Error("Audio playback failed"));
            };
            audio.play().catch(reject);
          });
        } finally {
          URL.revokeObjectURL(url);
        }
      }
    },
    [getTtsAudioContext]
  );

  const playNext = useCallback(async () => {
    if (ttsPlayingRef.current || ttsStoppedRef.current) return;
    if (ttsQueueRef.current.length === 0) return;

    ttsPlayingRef.current = true;

    while (ttsQueueRef.current.length > 0 && !ttsStoppedRef.current) {
      const item = ttsQueueRef.current[0];
      const blob = await item.promise;

      if (ttsStoppedRef.current) break;

      if (blob) {
        if (!ttsHasPlayedRef.current) {
          ttsHasPlayedRef.current = true;
          setPhase("speaking");
        }

        try {
          await playBlob(blob);
        } catch {
          // Skip failed chunks
        }
      }

      ttsQueueRef.current.shift();
    }

    ttsPlayingRef.current = false;

    // Signal completion when queue drains
    if (ttsQueueRef.current.length === 0 && !ttsStoppedRef.current) {
      if (ttsHasPlayedRef.current) {
        setPhase("idle");
      }
    }
  }, [playBlob, setPhase]);

  const enqueueChunk = useCallback(
    (text: string) => {
      const index = ttsChunkIndexRef.current++;
      const promise = synthesize(text);
      ttsQueueRef.current.push({ index, promise });

      // Grow minimum for next chunk
      ttsMinCharsRef.current = Math.min(
        ttsMinCharsRef.current * GROWTH_FACTOR,
        MAX_CHUNK_CHARS
      );

      playNext();
    },
    [synthesize, playNext]
  );

  // ---- TTS public API ----

  const pushTtsText = useCallback(
    (text: string) => {
      if (ttsStoppedRef.current) return;
      ttsBufferRef.current += text;

      const breakIdx = findBreakPoint(
        ttsBufferRef.current,
        ttsMinCharsRef.current
      );
      if (breakIdx > 0) {
        const chunk = ttsBufferRef.current.slice(0, breakIdx).trim();
        ttsBufferRef.current = ttsBufferRef.current.slice(breakIdx);
        if (chunk) enqueueChunk(chunk);
      }
    },
    [enqueueChunk]
  );

  const pushTtsAudio = useCallback(
    (blob: Blob) => {
      if (ttsStoppedRef.current) return;
      const index = ttsChunkIndexRef.current++;
      ttsQueueRef.current.push({ index, promise: Promise.resolve(blob) });
      playNext();
    },
    [playNext]
  );

  const flushTts = useCallback(() => {
    if (ttsStoppedRef.current) return;
    const remaining = ttsBufferRef.current.trim();
    ttsBufferRef.current = "";
    if (remaining) {
      enqueueChunk(remaining);
    } else if (ttsQueueRef.current.length === 0 && !ttsPlayingRef.current) {
      setPhase("idle");
    }
  }, [enqueueChunk, setPhase]);

  const stopTts = useCallback(() => {
    ttsStoppedRef.current = true;
    ttsBufferRef.current = "";
    ttsQueueRef.current = [];
    if (ttsSourceNodeRef.current) {
      try {
        ttsSourceNodeRef.current.stop();
      } catch {
        // ignore
      }
      ttsSourceNodeRef.current = null;
    }
    if (ttsCurrentAudioRef.current) {
      ttsCurrentAudioRef.current.pause();
      ttsCurrentAudioRef.current = null;
    }
    ttsPlayingRef.current = false;
  }, []);

  const resetTts = useCallback(() => {
    stopTts();
    ttsStoppedRef.current = false;
    ttsChunkIndexRef.current = 0;
    ttsMinCharsRef.current = INITIAL_MIN_CHARS;
    ttsHasPlayedRef.current = false;
  }, [stopTts]);

  // ---- Recording: amplitude loop ----

  const stopAmplitudeLoop = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
  }, []);

  const startAmplitudeLoop = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current) return;

    const tick = () => {
      if (!analyserRef.current || !dataArrayRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);

      // Average of first half of bins (voice frequencies)
      const half = Math.floor(dataArrayRef.current.length / 2);
      let sum = 0;
      for (let i = 0; i < half; i++) sum += dataArrayRef.current[i];
      const avg = sum / half / 255;
      setAmplitude(avg);

      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
  }, []);

  // ---- Recording: resource cleanup ----

  const releaseAudioResources = useCallback(() => {
    stopAmplitudeLoop();

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    if (
      audioContextRef.current &&
      audioContextRef.current.state !== "closed"
    ) {
      audioContextRef.current.close();
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    dataArrayRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    chunksRef.current = [];
    setAmplitude(0);
  }, [stopAmplitudeLoop]);

  // ---- Recording: init audio graph ----

  const initAudio = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermission("unavailable");
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      setPermission("granted");
      return true;
    } catch (err) {
      const domErr = err as DOMException;
      if (
        domErr.name === "NotAllowedError" ||
        domErr.name === "PermissionDeniedError"
      ) {
        setPermission("denied");
      } else {
        setPermission("unavailable");
      }
      return false;
    }
  }, []);

  // ---- Recording: transcribe ----

  const transcribe = useCallback(
    async (blob: Blob) => {
      setPhase("transcribing");
      setError(null);

      try {
        const formData = new FormData();
        formData.append("audio", blob, "recording.webm");

        const headers = makeHeaders();
        const res = await fetch(makeUrl(transcribeUrl), {
          method: "POST",
          headers,
          credentials: token ? "omit" : "include",
          body: formData,
        });

        if (!res.ok) {
          throw new Error(`Transcription failed: ${res.status}`);
        }

        const { text } = (await res.json()) as { text: string };

        if (!text || !text.trim()) {
          setError("No speech detected. Try again.");
          setPhase("idle");
          return;
        }

        onTranscription?.(text.trim());
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Transcription failed";
        setError(msg);
        setPhase("idle");
        onError?.(err instanceof Error ? err : new Error(msg));
      }
    },
    [makeUrl, makeHeaders, transcribeUrl, token, onTranscription, onError, setPhase]
  );

  // ---- Recording: start/stop ----

  const startRecording = useCallback(async () => {
    setError(null);

    // Unlock TTS AudioContext on user gesture
    unlockTtsAudioContext();

    // Init audio if not ready
    if (!streamRef.current) {
      const ok = await initAudio();
      if (!ok) return;
    }

    if (!streamRef.current) return;

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";

    const recorder = new MediaRecorder(
      streamRef.current,
      mimeType ? { mimeType } : undefined
    );
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      stopAmplitudeLoop();
      setAmplitude(0);

      const blob = new Blob(chunksRef.current, {
        type: mimeType || "audio/webm",
      });
      chunksRef.current = [];

      if (blob.size > 0) {
        transcribe(blob);
      } else {
        setPhase("idle");
      }
    };

    recorder.start(100);
    setPhase("recording");
    startAmplitudeLoop();
  }, [
    initAudio,
    unlockTtsAudioContext,
    stopAmplitudeLoop,
    startAmplitudeLoop,
    transcribe,
    setPhase,
  ]);

  const stopRecording = useCallback(() => {
    if (
      !mediaRecorderRef.current ||
      mediaRecorderRef.current.state === "inactive"
    ) {
      return;
    }
    mediaRecorderRef.current.stop();
  }, []);

  // ---- Full reset ----

  const reset = useCallback(() => {
    releaseAudioResources();
    resetTts();
    setPhaseState("idle");
    setError(null);
    setAmplitude(0);
  }, [releaseAudioResources, resetTts]);

  // ---- Cleanup on unmount ----

  useEffect(() => {
    return () => {
      releaseAudioResources();
      stopTts();
    };
  }, [releaseAudioResources, stopTts]);

  return {
    phase,
    isActive: phase !== "idle",
    startRecording,
    stopRecording,
    pushTtsText,
    pushTtsAudio,
    flushTts,
    setPhase,
    reset,
    amplitude,
    permission,
    error,
  };
}
