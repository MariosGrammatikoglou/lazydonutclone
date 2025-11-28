'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type HostInfo = {
  hostCode: string;
  lobbyCode: string;
  playerId: string;
};

export default function CreateLobbyClient({
  defaultUsername,
}: {
  defaultUsername: string;
}) {
  const router = useRouter();
  const [civilians, setCivilians] = useState(3);
  const [undercovers, setUndercovers] = useState(1);
  const [mrWhites, setMrWhites] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [hostInfo, setHostInfo] = useState<HostInfo | null>(null);
  const [copying, setCopying] = useState(false);

  const total = civilians + undercovers + mrWhites;

  async function handleCreate() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/create-lobby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: defaultUsername,
          civilians,
          undercovers,
          mrWhites,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to create lobby');
      } else {
        // Save host code locally for convenience
        try {
          localStorage.setItem(
            `hostCode:${data.lobbyCode}`,
            String(data.hostCode)
          );
        } catch {
          // ignore storage errors
        }

        // Show our own in-app popup instead of window.alert
        setHostInfo({
          hostCode: String(data.hostCode),
          lobbyCode: data.lobbyCode,
          playerId: data.playerId,
        });
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyHostCode() {
    if (!hostInfo) return;
    try {
      await navigator.clipboard.writeText(hostInfo.hostCode);
      setCopying(true);
      setTimeout(() => setCopying(false), 1200);
    } catch (err) {
      console.error(err);
    }
  }

  function handleEnterLobby() {
    if (!hostInfo) return;
    router.push(
      `/lobby/${hostInfo.lobbyCode}?playerId=${encodeURIComponent(
        hostInfo.playerId
      )}`
    );
  }

  return (
    <>
      {/* MAIN CONTENT */}
      <main className="card">
        <div className="flex flex-col gap-4 sm:gap-5">
          <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2>Create lobby</h2>
              <p className="text-sm text-slate-400">
                Host:{' '}
                <span className="font-medium text-slate-100">
                  {defaultUsername || 'Host'}
                </span>
              </p>
            </div>
            <span className="badge mt-1 sm:mt-0">Step 1 · Configure roles</span>
          </header>

          <section className="grid gap-3 sm:grid-cols-3">
            <div>
              <label>Civilians</label>
              <input
                type="number"
                min={0}
                value={civilians}
                onChange={(e) => setCivilians(Number(e.target.value))}
              />
              <p className="mt-1 text-[0.7rem] text-slate-500">
                They know the real word.
              </p>
            </div>
            <div>
              <label>Undercovers</label>
              <input
                type="number"
                min={0}
                value={undercovers}
                onChange={(e) => setUndercovers(Number(e.target.value))}
              />
              <p className="mt-1 text-[0.7rem] text-slate-500">
                Similar word, trying to blend in.
              </p>
            </div>
            <div>
              <label>Mr Whites</label>
              <input
                type="number"
                min={0}
                value={mrWhites}
                onChange={(e) => setMrWhites(Number(e.target.value))}
              />
              <p className="mt-1 text-[0.7rem] text-slate-500">
                No word, wins by guessing.
              </p>
            </div>
          </section>

          <p className="text-xs text-slate-400">
            Total players expected:{' '}
            <span className="font-semibold text-slate-100">{total}</span>. You
            need this many players in the lobby before starting.
          </p>

          {error && <div className="error">{error}</div>}

          <div className="button-row">
            <button
              onClick={handleCreate}
              disabled={loading || total <= 0}
              className="button-primary"
            >
              {loading ? 'Creating...' : 'Create lobby'}
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

      {/* HOST CODE POPUP / MODAL */}
      {hostInfo && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 sm:p-6 shadow-2xl space-y-4">
            <header className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-50">
                Your host code
              </h3>
              <span className="badge text-[0.6rem]">Private</span>
            </header>

            <p className="text-sm text-slate-400">
              This code lets you{' '}
              <span className="font-semibold text-slate-200">
                reclaim host powers
              </span>{' '}
              if you reconnect to this lobby later. Don&apos;t share it with
              other players.
            </p>

            <div className="rounded-xl bg-slate-950/80 border border-indigo-500/60 px-4 py-3 flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-[0.7rem] uppercase tracking-wide text-slate-400">
                  Host code
                </span>
                <span className="font-mono text-2xl text-indigo-300 tracking-widest">
                  {hostInfo.hostCode}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyHostCode}
                className="button-secondary inline-flex items-center gap-2"
              >
                <span>{copying ? 'Copied!' : 'Copy code'}</span>
         
              </button>

              <button
                type="button"
                onClick={handleEnterLobby}
                className="button-primary inline-flex items-center gap-2"
              >
                <span>Enter lobby</span>
            
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
