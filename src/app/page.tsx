'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function HomePage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);

  function goCreate() {
    const u = username.trim();
    if (!u) {
      setError('Enter a nickname to continue');
      return;
    }
    router.push(`/create?username=${encodeURIComponent(u)}`);
  }

  function goJoin() {
    const u = username.trim();
    if (!u) {
      setError('Enter a nickname to continue');
      return;
    }
    router.push(`/join?username=${encodeURIComponent(u)}`);
  }

  return (
    <main className="card">
      <div className="flex flex-col gap-4 sm:gap-5">
        <header className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h2>Start a game</h2>
            <p className="text-sm text-slate-400">
              Pick a nickname, then create a lobby or join your friends.
            </p>
          </div>
          <span className="badge mt-2 sm:mt-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1" />
            Online party game
          </span>
        </header>

        <section className="mt-2">
          <label>Nickname</label>
          <input
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. Terlegkas"
          />
          {error && <div className="error">{error}</div>}
        </section>

        <section className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-900/70 border border-slate-800/80 p-4 flex flex-col gap-2">
            <h3>Create lobby</h3>
            <p className="text-xs text-slate-400">
              You&apos;ll be the host. Set roles and share the lobby code with
              your friends.
            </p>
            <button onClick={goCreate} className="button-primary mt-1">
              Create lobby
            </button>
          </div>

          <div className="rounded-xl bg-slate-900/70 border border-slate-800/80 p-4 flex flex-col gap-2">
            <h3>Join lobby</h3>
            <p className="text-xs text-slate-400">
              Got a code from a friend? Join their lobby and start bluffing.
            </p>
            <button onClick={goJoin} className="button-primary mt-1">
              Join with code
            </button>
          </div>
        </section>

        <footer className="mt-2 text-[0.7rem] text-slate-500 flex flex-wrap gap-2 justify-between">
          <span>Words are unique per lobby. No repeats in future rounds.</span>
          <span>Built for mobile and desktop.</span>
        </footer>
      </div>
    </main>
  );
}
