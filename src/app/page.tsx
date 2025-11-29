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
  const [isModalOpen, setIsModalOpen] = useState(false); // Modal state

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

  function closeModal() {
    setIsModalOpen(false);
  }

  function openModal() {
    setIsModalOpen(true);
  }

  return (
    <main className="card">
      <div className="flex flex-col gap-4 sm:gap-5">
        <header className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h1>
              <span className="text-gradient-brand">LazyDonut Clone</span>
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
            placeholder="e.g. Pepegkas"
          />
          {error && <div className="error">{error}</div>}
        </section>

        <section className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-900/70 border border-slate-800/80 p-4 flex flex-col gap-2">
            <h3>Create lobby</h3>
            <p className="text-xs text-slate-400">
              You&apos;ll be the host. Set roles and share the lobby code with your friends.
            </p>

            <FunButton label="Create lobby" onClick={goCreate} />
          </div>

          <div className="rounded-xl bg-slate-900/70 border border-slate-800/80 p-4 flex flex-col gap-2">
            <h3>Join lobby</h3>
            <p className="text-xs text-slate-400">
              Got a code from a friend? Join their lobby and start bluffing.
            </p>

            <FunButton label="Join with code" onClick={goJoin} />
          </div>
        </section>

        {/* New footer with How to Play button */}
        <footer className="mt-2 pr-2 text-slate-500 flex flex-wrap gap-2 justify-between">
          <button
            className="ml-auto cursor-pointer text-sm text-indigo-500 hover:text-indigo-400"
            onClick={openModal}
          >
            How to Play
          </button>
        </footer>
      </div>

      {/* Modal - How to play */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
          <div className="bg-slate-900 p-6 rounded-lg shadow-lg text-white w-140">
             <h3 className="text-lg font-semibold">Game Roles</h3>
             <p className="mt-3 text-sm text-slate-400">
              <ul className="mt-2">
                <li>Each round, players will take random turns explaining their word to the group.</li>
                <li>Legits must explain their word clearly to help the group identify the Clones.</li>
                <li>Clones must try to explain their word similarly to the Legits without being caught.</li>
                <li>Blinds will try to make sense of the explanation, but they do not know the actual word.</li>
                <li>At the end of each round, players vote to execute someone they believe is a Clone. If the vote is successful, the Clone is out.</li>
                <li>If blind is executed he gets a try to guess the word to win.</li>
                <li>Legits win if all Clones are executed. Clones win if they avoid detection until the end of the game and they are the only alive.</li>
              </ul>
            </p>
             <h3 className="text-lg font-semibold mt-2">How Roles Works</h3>
             <p className="mt-3 text-sm text-slate-400">
              <ul className="mt-2">
                <li><strong>Legits:</strong> Their goal is to identify the Clones and Blinds and execute them.</li>
                <li><strong>Clones:</strong> Their goal is to understand that they have not the correct word. They can assume that when each player explains their word. If a lot of players explain something that is not 100% at their word they can assume if their word is legit or the similar one. The Clones must avoid execution by the Legits.</li>
                <li><strong>Blinds:</strong> These players do not know any of the words and must rely on others to make accusations. When they get executed they get a try to guess the word. If they do they win.</li>
              </ul>
            </p>
           
            <div className="mt-4 flex justify-end gap-2">
              <button className="button-secondary" onClick={closeModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
