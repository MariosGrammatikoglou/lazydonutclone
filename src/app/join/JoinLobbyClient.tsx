'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function JoinLobbyClient({
  defaultUsername,
}: {
  defaultUsername: string;
}) {
  const router = useRouter();
  const [lobbyCode, setLobbyCode] = useState('');
  const [hostCode, setHostCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    setError(null);

    if (!lobbyCode.trim()) {
      setError('Enter a lobby code');
      return;
    }

    const username = defaultUsername.trim();
    if (!username) {
      setError('Enter a nickname on the home page');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/join-lobby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          lobbyCode,
          hostCode: hostCode || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to join lobby');
      } else {
        router.push(
          `/lobby/${data.lobbyCode}?playerId=${encodeURIComponent(
            data.playerId
          )}`
        );
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="card">
      <div className="flex flex-col gap-4 sm:gap-5">
        <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2>Join lobby</h2>
            <p className="text-sm text-slate-400">
              Playing as{' '}
              <span className="font-medium text-slate-100">
                {defaultUsername || 'Guest'}
              </span>
            </p>
          </div>
          <span className="badge mt-1 sm:mt-0">Step 1 · Enter codes</span>
        </header>

        <section className="grid gap-3 sm:grid-cols-2">
          <div>
            <label>Lobby code</label>
            <input
              value={lobbyCode}
              onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
              placeholder="e.g. ABCDE"
              maxLength={5}
            />
            <p className="mt-1 text-[0.7rem] text-slate-500">
              The 5-letter code your host shared.
            </p>
          </div>

          <div>
            <label>Host code (optional)</label>
            <input
              value={hostCode}
              onChange={(e) => setHostCode(e.target.value)}
              placeholder="Only if you are the host"
              maxLength={10}
            />
            <p className="mt-1 text-[0.7rem] text-slate-500">
              Enter this if you&apos;re re-joining as the lobby host.
            </p>
          </div>
        </section>

        {error && <div className="error">{error}</div>}

        <div className="button-row">
          <button
            onClick={handleJoin}
            disabled={loading}
            className="button-primary"
          >
            {loading ? 'Joining...' : 'Join lobby'}
          </button>
          <button
            className="button-secondary"
            onClick={() => router.push('/')}
            disabled={loading}
          >
            Back to home
          </button>
        </div>
      </div>
    </main>
  );
}
