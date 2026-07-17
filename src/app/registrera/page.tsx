'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function RegistreraForm() {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrorText(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, birthYear: Number(birthYear) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Något gick fel.');

      window.location.href = returnTo;
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Något gick fel.');
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-6">
      <h1 className="mb-1 text-lg font-semibold">Skapa konto</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Se hela din rapport och spara den till nästa gång.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="email"
          required
          placeholder="E-post"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Lösenord (minst 8 tecken)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
        />
        <input
          type="number"
          required
          placeholder="Födelseår"
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-4 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
        />

        {errorText && <p className="text-sm text-red-600 dark:text-red-400">{errorText}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {submitting ? 'Skapar konto...' : 'Skapa konto'}
        </button>
      </form>
    </main>
  );
}

export default function RegistreraPage() {
  return (
    <Suspense>
      <RegistreraForm />
    </Suspense>
  );
}
