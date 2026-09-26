"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { askTrip, startChat } from "@/app/actions";
import { Icon } from "@/components/icons";
import { buttonClass, fieldClass } from "@/components/ui";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type TripConversation = {
  id: string;
  title: string;
};

export type TripLanguageOption = {
  code: string;
  name: string;
  cities: string[];
};

export function TripChat({
  tripId,
  chatId,
  chats,
  messages,
  languages,
}: {
  tripId: string;
  chatId: string | null;
  chats: TripConversation[];
  messages: ChatMessage[];
  languages: TripLanguageOption[];
}) {
  const end = useRef<HTMLDivElement>(null);
  const player = useRef<HTMLAudioElement | null>(null);
  const request = useRef(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [choosingId, setChoosingId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "playing" | "error" | null>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  useEffect(() => {
    return () => {
      player.current?.pause();
      if (player.current?.src) URL.revokeObjectURL(player.current.src);
    };
  }, []);

  function chooseOrStop(messageId: string) {
    if (activeId === messageId && phase === "playing") {
      request.current += 1;
      player.current?.pause();
      if (player.current?.src) URL.revokeObjectURL(player.current.src);
      player.current = null;
      setActiveId(null);
      setPhase(null);
      return;
    }
    setChoosingId((current) => (current === messageId ? null : messageId));
  }

  async function listen(messageId: string, language: string) {
    if (player.current) {
      player.current.pause();
      if (player.current.src) URL.revokeObjectURL(player.current.src);
      player.current = null;
    }

    const token = ++request.current;
    setChoosingId(null);
    setActiveId(messageId);
    setPhase("loading");
    let response: Response;
    try {
      response = await fetch(`/api/trips/${tripId}/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, language }),
        signal: AbortSignal.timeout(65_000),
      });
    } catch {
      if (token === request.current) setPhase("error");
      return;
    }
    if (token !== request.current) return;
    if (!response.ok || !response.headers.get("content-type")?.startsWith("audio/")) {
      setPhase("error");
      return;
    }

    const url = URL.createObjectURL(await response.blob());
    const audio = new Audio(url);
    player.current = audio;
    audio.onended = () => {
      URL.revokeObjectURL(url);
      if (player.current === audio) player.current = null;
      setActiveId((current) => (current === messageId ? null : current));
      setPhase((current) => (current === "playing" ? null : current));
    };
    try {
      setPhase("playing");
      await audio.play();
    } catch {
      URL.revokeObjectURL(url);
      setPhase("error");
    }
  }

  return (
    <section className="panel chat">
      <div className="panel-head">
        <span className="icon-tile chat-brand-icon">
          <Icon name="whatsapp" size={22} />
        </span>
        <div>
          <h2>Ask about this trip</h2>
          <p className="hint">
            Each answer uses the flights, stays, bookings, medicines, and briefings saved on this trip,
            plus this conversation. If the trip does not cover the question, it searches the web.
          </p>
        </div>
      </div>
      <div className="chat-switch">
        <form action={startChat.bind(null, tripId)}>
          <button type="submit" className="chat-pill">
            New chat
          </button>
        </form>
        {chats.map((chat) => (
          <Link
            key={chat.id}
            href={`/trips/${tripId}?tab=chat&chat=${chat.id}`}
            className={chat.id === chatId ? "chat-pill chat-pill-on" : "chat-pill"}
            aria-current={chat.id === chatId ? "page" : undefined}
          >
            {chat.title}
          </Link>
        ))}
      </div>
      <div className="chat-log" role="log" aria-label="Conversation" aria-live="polite">
        {messages.length === 0 ? (
          <div className="chat-empty">
            <Icon name="chat" size={28} />
            <p className="hint">Ask what is next, what to pack, or when a medicine is due.</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={message.role === "user" ? "chat-line chat-user" : "chat-line chat-assistant"}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={{
                  a: ({ href, children }) => {
                    const safe = href && /^https?:\/\//i.test(href) ? href : undefined;
                    if (!safe) return <span>{children}</span>;
                    return (
                      <a href={safe} target="_blank" rel="noreferrer">
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
              {message.role === "assistant" ? (
                <div className="chat-speak-wrap">
                  <button
                    type="button"
                    className="chat-speak"
                    disabled={activeId === message.id && phase === "loading"}
                    onClick={() => chooseOrStop(message.id)}
                    aria-expanded={choosingId === message.id}
                  >
                    {activeId === message.id && phase === "loading"
                      ? "Preparing…"
                      : activeId === message.id && phase === "playing"
                        ? "Stop"
                        : activeId === message.id && phase === "error"
                          ? "Try again"
                          : "Listen"}
                  </button>
                  {choosingId === message.id ? (
                    <select
                      autoFocus
                      className="chat-language-select"
                      defaultValue=""
                      aria-label="Choose audio language"
                      onChange={(event) => {
                        if (event.target.value) listen(message.id, event.target.value);
                      }}
                    >
                      <option value="" disabled>
                        Choose language
                      </option>
                      {languages.map((language) => (
                        <option key={language.code} value={language.code}>
                          {language.name}
                          {language.cities.length > 0 ? ` — ${language.cities.join(", ")}` : ""}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))
        )}
        <div ref={end} />
      </div>
      <form action={askTrip} className="chat-form">
        <input type="hidden" name="tripId" value={tripId} />
        {chatId ? <input type="hidden" name="chatId" value={chatId} /> : null}
        <ChatComposer />
      </form>
    </section>
  );
}

function ChatComposer() {
  const { pending } = useFormStatus();
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [message, setMessage] = useState("");
  const [voiceState, setVoiceState] = useState<
    "idle" | "recording" | "transcribing" | "error"
  >("idle");

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current?.state !== "inactive") recorder.current?.stop();
      stream.current?.getTracks().forEach((track) => track.stop());
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
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = microphone;
      chunks.current = [];
      const preferred = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/webm",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const next = new MediaRecorder(
        microphone,
        preferred ? { mimeType: preferred } : undefined,
      );
      recorder.current = next;
      next.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      next.onerror = () => {
        microphone.getTracks().forEach((track) => track.stop());
        setVoiceState("error");
      };
      next.onstop = async () => {
        if (timer.current) clearTimeout(timer.current);
        microphone.getTracks().forEach((track) => track.stop());
        stream.current = null;
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
          const result = (await response.json()) as { text?: unknown };
          if (!response.ok || typeof result.text !== "string" || !result.text.trim()) {
            setVoiceState("error");
            return;
          }
          setMessage((current) =>
            current.trim() ? `${current.trim()} ${result.text}` : result.text as string,
          );
          setVoiceState("idle");
        } catch {
          setVoiceState("error");
        }
      };
      next.start();
      setVoiceState("recording");
      timer.current = setTimeout(stopRecording, 60_000);
    } catch {
      setVoiceState("error");
    }
  }

  return (
    <>
      <div className="composer">
        <textarea
          id="trip-message"
          name="message"
          required
          maxLength={2000}
          rows={2}
          disabled={pending}
          aria-label="Message"
          className={fieldClass}
          placeholder="What's next on this trip?"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        <button
          type="button"
          className={voiceState === "recording" ? "voice-input voice-input-on" : "voice-input"}
          disabled={pending || voiceState === "transcribing"}
          aria-label={voiceState === "recording" ? "Stop recording" : "Record a voice message"}
          aria-pressed={voiceState === "recording"}
          onClick={toggleRecording}
        >
          <Icon name="mic" size={18} />
        </button>
        <button
          type="submit"
          className={buttonClass}
          disabled={
            pending || voiceState === "recording" || voiceState === "transcribing"
          }
        >
          <Icon name="send" size={16} />
          {pending ? "Sending" : "Send"}
        </button>
      </div>
      {pending ? <p className="hint">Looking at the trip…</p> : null}
      {voiceState === "recording" ? (
        <p className="voice-status" role="status">
          Recording… tap the microphone to stop.
        </p>
      ) : null}
      {voiceState === "transcribing" ? (
        <p className="voice-status" role="status">
          Transcribing with ElevenLabs…
        </p>
      ) : null}
      {voiceState === "error" ? (
        <p className="voice-status voice-error" role="alert">
          Could not transcribe that. Check microphone access and try again.
        </p>
      ) : null}
    </>
  );
}
