'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import type { CSSProperties, MouseEvent } from 'react';

type FunButtonProps = {
  label: string;
  onClick: () => void;
};

function FunButton({ label, onClick }: FunButtonProps) {
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  // Random eye movement while hovered
useEffect(() => {
  if (!hovered) {
    setPupilOffset({ x: 0, y: 0 });
    return;
  }

  const id = setInterval(() => {
    const max = 3; // smaller movement, more subtle
    const x = (Math.random() * 2 - 1) * max;
    const y = (Math.random() * 2 - 1) * max;
    setPupilOffset({ x, y });
  }, 650); // slower: ~0.65s per move

  return () => clearInterval(id);
}, [hovered]);


  const pupilStyle: CSSProperties = {
    transform: `translate(${pupilOffset.x}px, ${pupilOffset.y}px)`,
  };

  function handleMouseEnter(_e: MouseEvent<HTMLDivElement>) {
    setHovered(true);
  }

  function handleMouseLeave(_e: MouseEvent<HTMLDivElement>) {
    setHovered(false);
  }

  return (
    <div
      className="fun-button-wrapper mt-4"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* bottom black button */}
      <div className="fun-button-under" aria-hidden="true" />

      {/* eyes layer */}
      <div className="fun-button-eyes" aria-hidden="true">
        <span className="fun-eye">
          <span className="fun-eye-inner">
            <span className="fun-eye-pupil" style={pupilStyle} />
          </span>
        </span>
        <span className="fun-eye">
          <span className="fun-eye-inner">
            <span className="fun-eye-pupil" style={pupilStyle} />
          </span>
        </span>
      </div>

      {/* real clickable button on top */}
      <button
        onClick={onClick}
        className="button-primary fun-button-top"
      >
        {label}
      </button>
    </div>
  );
}

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
            <h1>
              <span className="text-gradient-brand">
                LazyDonut Undercover
              </span>
            </h1>
            <p className="text-sm text-slate-400">
              Want your friend group to fall apart? Let the drama begin
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
          {/* CREATE CARD */}
          <div className="rounded-xl bg-slate-900/70 border border-slate-800/80 p-4 flex flex-col gap-2">
            <h3>Create lobby</h3>
            <p className="text-xs text-slate-400">
              You&apos;ll be the host. Set roles and share the lobby code with
              your friends.
            </p>

            <FunButton label="Create lobby" onClick={goCreate} />
          </div>

          {/* JOIN CARD */}
          <div className="rounded-xl bg-slate-900/70 border border-slate-800/80 p-4 flex flex-col gap-2">
            <h3>Join lobby</h3>
            <p className="text-xs text-slate-400">
              Got a code from a friend? Join their lobby and start bluffing.
            </p>

            <FunButton label="Join with code" onClick={goJoin} />
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
