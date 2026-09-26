"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { buttonClass } from "@/components/ui";

export type TranslatorLanguage = {
  code: string;
  name: string;
  cities: string[];
};

export function TripTranslator({
  tripId,
  languages,
}: {
  tripId: string;
  languages: TranslatorLanguage[];
}) {
  const firstDestination = languages.find((language) => language.code !== "en");
  const [source, setSource] = useState("en");
  const [target, setTarget] = useState(firstDestination?.code ?? "en");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<
    "idle" | "translating" | "speaking" | "playing" | "error"
  >("idle");
  const player = useRef<HTMLAudioElement | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const microphone = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discardRecording = useRef(false);
  const [voiceState, setVoiceState] = useState<
    "idle" | "recording" | "transcribing" | "error"
  >("idle");

  useEffect(() => {
    return () => {
      player.current?.pause();
      if (player.current?.src) URL.revokeObjectURL(player.current.src);
      discardRecording.current = true;
      if (recordingTimer.current) clearTimeout(recordingTimer.current);
      if (recorder.current?.state !== "inactive") recorder.current?.stop();
      microphone.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function stopRecording() {
    if (recorder.current?.state === "recording") {
      setVoiceState("transcribing");
      recorder.current.stop();
    }
  }

  async function toggleRecording() {
    if (voiceState === "recording") {
      stopRecording();
      return;
    }
    if (voiceState === "transcribing") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoiceState("error");
      return;
    }

    try {
      discardRecording.current = false;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphone.current = stream;
      chunks.current = [];
      const preferred = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/webm",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const next = new MediaRecorder(
        stream,
        preferred ? { mimeType: preferred } : undefined,
      );
      recorder.current = next;
      next.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      next.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        setVoiceState("error");
      };
      next.onstop = async () => {
        if (recordingTimer.current) clearTimeout(recordingTimer.current);
        stream.getTracks().forEach((track) => track.stop());
        microphone.current = null;
        if (discardRecording.current) return;

        const type = next.mimeType || "audio/webm";
        const extension = type.includes("mp4") ? "m4a" : "webm";
        const audio = new Blob(chunks.current, { type });
        if (audio.size === 0) {
          setVoiceState("error");
          return;
        }

        const form = new FormData();
        form.append("audio", audio, `recording.${extension}`);
        try {
          const response = await fetch("/api/transcribe", {
            method: "POST",
            body: form,
            signal: AbortSignal.timeout(55_000),
          });
          const result = (await response.json()) as {
            text?: unknown;
            language?: unknown;
          };
          if (!response.ok || typeof result.text !== "string" || !result.text.trim()) {
            setVoiceState("error");
            return;
          }
          setInput((current) =>
            current.trim() ? `${current.trim()} ${result.text}` : result.text as string,
          );
          setOutput("");
          if (
            typeof result.language === "string" &&
            languages.some((language) => language.code === result.language)
          ) {
            setSource(result.language);
          }
          setVoiceState("idle");
        } catch {
          setVoiceState("error");
        }
      };
      next.start();
      setVoiceState("recording");
      recordingTimer.current = setTimeout(stopRecording, 60_000);
    } catch {
      setVoiceState("error");
    }
  }

  async function translate(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    stopAudio();
    setStatus("translating");
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, text, source, target }),
        signal: AbortSignal.timeout(40_000),
      });
      const result = (await response.json()) as { text?: unknown };
      if (!response.ok || typeof result.text !== "string" || !result.text.trim()) {
        setStatus("error");
        return;
      }
      setOutput(result.text.trim());
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  function stopAudio() {
    player.current?.pause();
    if (player.current?.src) URL.revokeObjectURL(player.current.src);
    player.current = null;
    if (status === "playing") setStatus("idle");
  }

  async function speak() {
    if (status === "playing") {
      stopAudio();
      return;
    }
    if (!output) return;
    setStatus("speaking");
    try {
      const response = await fetch("/api/translate/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tripId, text: output, language: target }),
        signal: AbortSignal.timeout(65_000),
      });
      if (!response.ok || !response.headers.get("content-type")?.startsWith("audio/")) {
        setStatus("error");
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const audio = new Audio(url);
      player.current = audio;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        player.current = null;
        setStatus("idle");
      };
      setStatus("playing");
      await audio.play();
    } catch {
      setStatus("error");
    }
  }

  function swap() {
    stopAudio();
    const oldInput = input;
    setSource(target);
    setTarget(source);
    if (output) {
      setInput(output);
      setOutput(oldInput);
    }
  }

  return (
    <section className="panel translator">
      <div className="panel-head">
        <span className="icon-tile">
          <Icon name="globe" size={22} />
        </span>
        <div>
          <h2>Translator</h2>
          <p className="hint">
            Translate between English and the languages used on this trip, then hear the result.
          </p>
        </div>
      </div>

      <form onSubmit={translate} className="translator-form">
        <div className="translator-languages">
          <LanguageSelect
            label="From"
            value={source}
            languages={languages}
            onChange={(value) => {
              setSource(value);
              setOutput("");
            }}
          />
          <button type="button" className="translator-swap" onClick={swap} aria-label="Swap languages">
            ⇄
          </button>
          <LanguageSelect
            label="To"
            value={target}
            languages={languages}
            onChange={(value) => {
              stopAudio();
              setTarget(value);
              setOutput("");
            }}
          />
        </div>

        <div className="translator-grid">
          <div className="translator-box">
            <div className="translator-box-head">
              <label htmlFor="translator-input">Original</label>
              <button
                type="button"
                className={
                  voiceState === "recording"
                    ? "voice-input voice-input-on translator-mic"
                    : "voice-input translator-mic"
                }
                disabled={voiceState === "transcribing"}
                aria-label={
                  voiceState === "recording"
                    ? "Stop recording"
                    : "Speak text to translate"
                }
                aria-pressed={voiceState === "recording"}
                onClick={toggleRecording}
              >
                <Icon name="mic" size={17} />
              </button>
            </div>
            <textarea
              id="translator-input"
              value={input}
              onChange={(event) => {
                setInput(event.target.value.slice(0, 3000));
                setOutput("");
              }}
              maxLength={3000}
              rows={8}
              placeholder="Type or paste text"
              required
            />
            {voiceState === "recording" ? (
              <span className="translator-voice-status" role="status">
                Recording… tap the microphone to stop.
              </span>
            ) : null}
            {voiceState === "transcribing" ? (
              <span className="translator-voice-status" role="status">
                Transcribing with ElevenLabs…
              </span>
            ) : null}
            {voiceState === "error" ? (
              <span className="translator-voice-status voice-error" role="alert">
                Could not transcribe. Check microphone access and try again.
              </span>
            ) : null}
            <small>{input.length} / 3000</small>
          </div>
          <div className="translator-box translator-output" aria-live="polite">
            <span>Translation</span>
            <p>{output || "Your translation will appear here."}</p>
            {output ? (
              <button
                type="button"
                className="translator-listen"
                onClick={speak}
                disabled={status === "speaking"}
              >
                <Icon name="volume" size={17} />
                {status === "speaking"
                  ? "Preparing…"
                  : status === "playing"
                    ? "Stop"
                    : "Listen"}
              </button>
            ) : null}
          </div>
        </div>

        <div className="translator-actions">
          <button
            type="submit"
            className={buttonClass}
            disabled={
              !input.trim() ||
              status === "translating" ||
              voiceState === "recording" ||
              voiceState === "transcribing"
            }
          >
            <Icon name="globe" size={16} />
            {status === "translating" ? "Translating…" : "Translate"}
          </button>
          {status === "error" ? (
            <p className="voice-status voice-error" role="alert">
              Could not finish that. Try again.
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

function LanguageSelect({
  label,
  value,
  languages,
  onChange,
}: {
  label: string;
  value: string;
  languages: TranslatorLanguage[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="translator-language">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {languages.map((language) => (
          <option key={language.code} value={language.code}>
            {language.name}
            {language.cities.length > 0 ? ` — ${language.cities.join(", ")}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
