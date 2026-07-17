'use client';

import { useEffect, useRef, useState } from 'react';

interface ChatMessage {
  role: 'assistant' | 'user';
  text: string;
}

type Status = 'loading' | 'active' | 'completed' | 'paused' | 'error';

export default function IntervjuPage() {
  const [interviewId, setInterviewId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<Status>('loading');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    fetch('/api/interview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Något gick fel.');
        setInterviewId(data.interviewId);
        setMessages([{ role: 'assistant', text: data.assistantText }]);
        setStatus(data.status);
      })
      .catch((err) => {
        setErrorText(err instanceof Error ? err.message : 'Något gick fel.');
        setStatus('error');
      });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || !interviewId || sending || status !== 'active') return;

    setMessages((prev) => [...prev, { role: 'user', text }]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch(`/api/interview/${interviewId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Något gick fel.');

      setMessages((prev) => [...prev, { role: 'assistant', text: data.assistantText }]);
      setStatus(data.status);
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Något gick fel.');
      setStatus('error');
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <header className="border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
        <h1 className="text-lg font-semibold">Studievägledare</h1>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <p
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900'
                  : 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
              }`}
            >
              {m.text}
            </p>
          </div>
        ))}

        {status === 'loading' && (
          <p className="text-sm text-neutral-500">Kopplar upp intervjun...</p>
        )}
        {status === 'completed' && interviewId && (
          <div className="space-y-2">
            <p className="text-sm text-neutral-500">Intervjun är klar!</p>
            <a
              href={`/resultat/${interviewId}`}
              className="inline-block rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
            >
              Se dina förslag
            </a>
          </div>
        )}
        {status === 'paused' && (
          <p className="text-sm text-neutral-500">Intervjun är pausad — försök igen senare.</p>
        )}
        {errorText && <p className="text-sm text-red-600 dark:text-red-400">{errorText}</p>}

        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-0 flex gap-2 border-t border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-black">
        <input
          className="flex-1 rounded-full border border-neutral-300 px-4 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') sendMessage();
          }}
          disabled={status !== 'active' || sending}
          placeholder="Skriv ditt svar..."
        />
        <button
          className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
          onClick={sendMessage}
          disabled={status !== 'active' || sending || !input.trim()}
        >
          Skicka
        </button>
      </div>
    </main>
  );
}
