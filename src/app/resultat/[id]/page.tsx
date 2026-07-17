'use client';

import { use, useEffect, useState } from 'react';

interface RecommendationItem {
  rank: number;
  motivation: string;
  factsSnapshot: { name: string; kind: string; interestTags: string[] };
}

interface Recommendation {
  status: string;
  items: RecommendationItem[];
}

const KIND_LABEL: Record<string, string> = {
  hogskoleforberedande: 'Högskoleförberedande program',
  yrkesprogram: 'Yrkesprogram',
  introduktion: 'Introduktionsprogram',
};

export default function ResultatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/interview/${id}/recommendations`, { method: 'POST' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Något gick fel.');
        setRecommendation(data.recommendation);
      })
      .catch((err) => setErrorText(err instanceof Error ? err.message : 'Något gick fel.'))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-6">
      <h1 className="mb-4 text-lg font-semibold">Dina förslag</h1>

      {loading && <p className="text-sm text-neutral-500">Tar fram dina förslag...</p>}
      {errorText && <p className="text-sm text-red-600 dark:text-red-400">{errorText}</p>}

      <div className="space-y-4">
        {recommendation?.items.map((item) => (
          <div
            key={item.rank}
            className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <div className="mb-1 flex items-center justify-between">
              <h2 className="font-medium">{item.factsSnapshot.name}</h2>
              <span className="text-xs text-neutral-500">#{item.rank}</span>
            </div>
            <p className="mb-2 text-xs text-neutral-500">
              {KIND_LABEL[item.factsSnapshot.kind] ?? item.factsSnapshot.kind}
            </p>
            <p className="text-sm leading-relaxed">{item.motivation}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
