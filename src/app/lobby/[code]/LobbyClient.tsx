'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type LobbyStatus = 'waiting' | 'started' | 'blind_guess' | 'finished';
type Winner = 'legits' | 'clones' | 'blind' | null;

type LobbyPlayer = {
  id: string;
  name: string;
  isHost: boolean;
  isEliminated: boolean;
  // API might send either `order` or `talkOrder`, support both:
  order?: number | null;
  talkOrder?: number | null;
};

type LobbySummary = {
  code: string;
  status: LobbyStatus;
  winner: Winner;
  pendingBlindId: string | null;
  settings: {
    legits: number;
    clones: number;
    blinds: number;
  };
  players: LobbyPlayer[];
  // voterId -> targetPlayerId
  votes?: Record<string, string>;
};


type MyState = {
  lobbyStatus: LobbyStatus;
  winner: Winner;
  hostSecret?: string; 
  player: {
    id: string;
    name: string;
    role?: 'legit' | 'clone' | 'blind';
    word: string | null;
    isHost: boolean;
    isEliminated: boolean;
  };
};

export default function LobbyClient({
  lobbyCode,
  playerId,
}: {
  lobbyCode: string;
  playerId: string;
}) {
  const router = useRouter();

  const [lobby, setLobby] = useState<LobbySummary | null>(null);
  const [myState, setMyState] = useState<MyState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [kickLoading, setKickLoading] = useState<string | null>(null);
  const [kickFromLobbyLoading, setKickFromLobbyLoading] = useState<string | null>(null);

  const [blindGuess, setBlindGuess] = useState('');
  const [blindSubmitting, setBlindSubmitting] = useState(false);

  const [resetLoading, setResetLoading] = useState(false);
  const [startLoading, setStartLoading] = useState(false);

  const [legits, setLegits] = useState<number | null>(null);
  const [clones, setClones] = useState<number | null>(null);
  const [blinds, setBlinds] = useState<number | null>(null);
  const [saveSettingsLoading, setSaveSettingsLoading] = useState(false);

  const [copied, setCopied] = useState(false);

  const isHost = !!myState?.player.isHost;
  const status = lobby?.status ?? 'waiting';

  useEffect(() => {
    if (!lobby) return;
    setLegits(lobby.settings.legits);
    setClones(lobby.settings.clones);
    setBlinds(lobby.settings.blinds);
  }, [lobby?.code]);

  async function fetchLobby() {
    try {
      const [lobbyRes, myRes] = await Promise.all([
        fetch(`/api/lobby/${lobbyCode}`),
        fetch('/api/my-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lobbyCode, playerId }),
        }),
      ]);

      if (lobbyRes.ok) {
        setLobby(await lobbyRes.json());
      } else {
        const e = await lobbyRes.json().catch(() => ({}));
        setError(e.error ?? 'Failed to load lobby');
      }

      if (myRes.ok) {
        setMyState(await myRes.json());
      } else {
        const e = await myRes.json().catch(() => ({}));

        // If the server says this player is not in the lobby anymore,
        // send them back to the home page.
        if (myRes.status === 404) {
          router.replace('/');
          return;
        }

        setError(e.error ?? 'Failed to load your state');
      }
    } catch (err) {
      console.error(err);
      setError('Network error while loading lobby');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLobby();
    const id = setInterval(fetchLobby, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbyCode, playerId]);

  // Tell server when we leave / refresh
  useEffect(() => {
    if (!lobbyCode || !playerId) return;

    const url = '/api/leave-lobby';
    const payload = JSON.stringify({ lobbyCode, playerId });

    const handleUnload = () => {
      try {
        if ('sendBeacon' in navigator) {
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon(url, blob);
        } else {
          // Fallback for older browsers
          fetch(url, {
            method: 'POST',
            keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: payload,
          });
        }
      } catch {
        // ignore errors; page is closing anyway
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, [lobbyCode, playerId]);

  async function handleStartGame() {
    setError(null);
    setStartLoading(true);
    try {
      const res = await fetch('/api/start-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lobbyCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not start game');
      } else {
        await fetchLobby();
      }
    } catch (err) {
      console.error(err);
      setError('Network error while starting game');
    } finally {
      setStartLoading(false);
    }
  }

  async function handleSaveSettings() {
    if (!isHost || !lobby || !myState) return;

    const leg = Math.max(0, Number(legits ?? 0));
    const clo = Math.max(0, Number(clones ?? 0));
    const bli = Math.max(0, Number(blinds ?? 0));

    setError(null);
    setSaveSettingsLoading(true);
    try {
      const res = await fetch('/api/update-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lobbyCode,
          hostId: myState.player.id,
          legits: leg,
          clones: clo,
          blinds: bli,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not update settings');
      } else {
        await fetchLobby();
      }
    } catch (err) {
      console.error(err);
      setError('Network error while updating settings');
    } finally {
      setSaveSettingsLoading(false);
    }
  }

  async function handleKickPlayer(targetId: string) {
    setError(null);
    setKickLoading(targetId);
    try {
      const res = await fetch('/api/kick-player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lobbyCode,
          hostId: myState?.player.id,
          targetId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not execute player');
      } else {
        await fetchLobby();
      }
    } catch (err) {
      console.error(err);
      setError('Network error while executing player');
    } finally {
      setKickLoading(null);
    }
  }

  async function handleKickFromLobby(targetId: string) {
    setError(null);
    setKickFromLobbyLoading(targetId);
    try {
      const res = await fetch('/api/kick-from-lobby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lobbyCode,
          hostId: myState?.player.id,
          targetId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not kick from lobby');
      } else {
        await fetchLobby();
      }
    } catch (err) {
      console.error(err);
      setError('Network error while kicking from lobby');
    } finally {
      setKickFromLobbyLoading(null);
    }
  }

  async function handleBlindGuess() {
    if (!blindGuess.trim()) return;
    setError(null);
    setBlindSubmitting(true);
    try {
      const res = await fetch('/api/blind-guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lobbyCode,
          playerId: myState?.player.id,
          guess: blindGuess,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not submit guess');
      } else {
        await fetchLobby();
      }
    } catch (err) {
      console.error(err);
      setError('Network error while submitting guess');
    } finally {
      setBlindSubmitting(false);
    }
  }

  async function handleReset() {
    setError(null);
    setResetLoading(true);
    try {
      const res = await fetch('/api/reset-lobby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lobbyCode,
          hostId: myState?.player.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not reset lobby');
      } else {
        await fetchLobby();
      }
    } catch (err) {
      console.error(err);
      setError('Network error while resetting lobby');
    } finally {
      setResetLoading(false);
    }
  }

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(lobbyCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      console.error(err);
    }
  }

   // NEW: voting handler
    // voting handler
  async function handleVote(targetId: string) {
    if (!lobby || !myState) return;

    // Only during an active round
    if (status === 'waiting' || status === 'finished') return;

    // Dead players can't vote
    if (myState.player.isEliminated) return;

    // Don't let someone vote themselves
    if (myState.player.id === targetId) return;

    setError(null);
    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lobbyCode,
          targetId,
          voterId: myState.player.id,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as any).error ?? 'Could not register vote');
      } else {
        // refresh to get updated per-player votes
        await fetchLobby();
      }
    } catch (err) {
      console.error(err);
      setError('Network error while voting');
    }
  }



  if (loading || !lobby || !myState) {
    return (
      <div className="card">
        <p className="text-sm text-slate-300">Loading lobby...</p>
      </div>
    );
  }

  const my = myState.player;
  const isPendingBlind =
    lobby.pendingBlindId && lobby.pendingBlindId === my.id;

  // Unified display order: prefer talkOrder if present, else order
  const getDisplayOrder = (p: LobbyPlayer): number | null => {
    const t = p.talkOrder ?? null;
    const o = p.order ?? null;
    return t ?? o;
  };

  // sort players by speaking order
  const sortedPlayers = [...lobby.players].sort((a, b) => {
    const ao = getDisplayOrder(a) ?? 9999;
    const bo = getDisplayOrder(b) ?? 9999;
    return ao - bo;
  });

  const visibleRoleText =
    my.role === 'blind'
      ? 'Blind'
      : my.role
      ? '-'
      : 'Unknown';

  const roleColorClass =
    my.role === 'blind' ? 'text-slate-50' : 'text-slate-100';

  const wordColorClass =
    my.role === 'blind' ? 'text-slate-50' : 'text-indigo-300';

  let winnerLabel = '';
  let winnerEmoji = '';
  let winnerColor = '';

  if (lobby.winner === 'legits') {
    winnerLabel = 'Legits';
    winnerEmoji = '🍩';
    winnerColor = 'text-emerald-300';
  } else if (lobby.winner === 'clones') {
    winnerLabel = 'Clones';
    winnerEmoji = '🕵️‍♂️';
    winnerColor = 'text-red-400';
  } else if (lobby.winner === 'blind') {
    winnerLabel = 'Blind';
    winnerEmoji = '🥷';
    winnerColor = 'text-slate-50';
  }

  return (
     <main className="card">
      {/* Hidden host secret for DevTools inspection */}
      {myState?.hostSecret && (
        <div
          data-host-secret={myState.hostSecret}
          style={{ display: 'none' }}
        />
      )}

      <div className="flex flex-col gap-6 sm:gap-7">
        {/* HEADER + LOBBY CODE */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <p className="text-[0.7rem] uppercase tracking-wide text-slate-400">
              Lobby Code
            </p>
            <button
              type="button"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-400/70 
                         bg-slate-950/70 px-3.5 py-2 hover:bg-slate-900/80 transition"
            >
              <span className="text-sm text-slate-200">Code:</span>
              <span className="font-mono text-lg sm:text-xl text-amber-300">
                {lobby.code}
              </span>
            </button>
            {copied && (
              <p className="text-[0.7rem] text-emerald-300">Copied!</p>
            )}
          </div>

          <div className="flex flex-col items-start gap-1 sm:items-end">
            <p className="text-sm text-slate-300">
              You are{' '}
              <span className="font-semibold text-slate-100 text-base">
                {my.name}
              </span>{' '}
              {my.isHost && <span className="text-indigo-400">(Host)</span>}
            </p>
            <span className="badge">
              {lobby.players.length} player
              {lobby.players.length !== 1 && 's'}
            </span>
            {status === 'waiting' && (
              <span className="text-[0.7rem] text-slate-500">
                Waiting for host to start…
              </span>
            )}
          </div>
        </header>

        {error && <div className="error">{error}</div>}

        {/* PLAYERS */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3>Players</h3>
            <span className="text-[0.7rem] text-slate-500">
              Turn order is random each game
            </span>
          </div>

                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
            {(() => {
              // Build targetId -> count map from voterId -> targetId
              const voteCounts: Record<string, number> = {};
              if (lobby.votes) {
                Object.values(lobby.votes).forEach((targetId) => {
                  if (!targetId) return;
                  voteCounts[targetId] = (voteCounts[targetId] ?? 0) + 1;
                });
              }

              return sortedPlayers.map((p) => {
                const order = getDisplayOrder(p);
                const voteCount = voteCounts[p.id] ?? 0;

                const canVoteThisPlayer =
                  status !== 'waiting' &&
                  status !== 'finished' &&
                  !p.isEliminated &&
                  p.id !== my.id && // don't vote yourself
                  !my.isEliminated; // dead players can't vote

                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-xl 
                               bg-slate-900/80 border border-slate-800/80 
                               px-3 py-2.5 md:px-4 md:py-3"
                  >
                    <div className="flex items-center gap-2">
                      {order != null && (
                        <span className="badge">#{order}</span>
                      )}
                      <span className="text-base md:text-lg font-medium">
                        {p.name}
                      </span>
                      {p.id === my.id && <span className="badge">You</span>}
                      {p.isHost && <span className="badge">Host</span>}
                      {p.isEliminated && <span className="badge">Out</span>}
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Vote button is ALWAYS visible, but only clickable when allowed */}
                 <button
  onClick={() => canVoteThisPlayer && handleVote(p.id)}
  disabled={!canVoteThisPlayer}
  className="button-secondary vote-button px-2 py-1 text-xs disabled:opacity-60 disabled:cursor-not-allowed"
>
  Vote: {voteCount}
</button>


                      {isHost &&
                        status === 'waiting' &&
                        p.id !== my.id && (
                          <button
      onClick={() => handleKickFromLobby(p.id)}
      disabled={kickFromLobbyLoading === p.id}
      className="button-secondary kick-button"
    >
      {kickFromLobbyLoading === p.id ? 'Removing…' : 'Kick'}
    </button>
                        )}
                      {isHost &&
                        status !== 'waiting' &&
                        status !== 'finished' &&
                        !p.isEliminated && (
                          <button
                            onClick={() => handleKickPlayer(p.id)}
                            disabled={kickLoading === p.id}
className="button-secondary execute-button"
                          >
                            {kickLoading === p.id ? 'Executing…' : 'Execute'}
                          </button>
                        )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>


        </section>

        {/* HOST SETTINGS */}
        {isHost && status === 'waiting' && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3>Lobby settings</h3>
              <span className="text-[0.7rem] text-slate-500">
                Adjust roles before starting
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label>Legits</label>
                <input
                  type="number"
                  min={0}
                  value={legits ?? 0}
                  onChange={(e) => setLegits(Number(e.target.value))}
                />
              </div>
              <div>
                <label>Clones</label>
                <input
                  type="number"
                  min={0}
                  value={clones ?? 0}
                  onChange={(e) => setClones(Number(e.target.value))}
                />
              </div>
              <div>
                <label>Blinds</label>
                <input
                  type="number"
                  min={0}
                  value={blinds ?? 0}
                  onChange={(e) => setBlinds(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="button-row">
              <button
                onClick={handleSaveSettings}
                disabled={saveSettingsLoading}
                className="button-secondary"
              >
                {saveSettingsLoading ? 'Saving…' : 'Save settings'}
              </button>
              <p className="text-[0.7rem] text-slate-500">
                Player count must match total roles when you press Start Game.
              </p>
            </div>
          </section>
        )}

        {/* STATUS + YOUR INFO */}
        <section className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)]">
          <div className="space-y-1">
            <h3>Game status</h3>
            <p className="text-sm">
              Status:{' '}
              <span className="font-semibold text-slate-100">
                {status}
              </span>
            </p>
            {lobby.winner && (
              <p
                className={`mt-1 text-base sm:text-lg font-semibold flex items-center gap-2 ${winnerColor}`}
              >
                <span>Winner:</span>
                <span>
                  {winnerLabel} {winnerEmoji}
                </span>
              </p>
            )}
          </div>

          <div className="rounded-xl bg-slate-900/70 border border-slate-800/70 px-4 py-3 space-y-1.5">
            <p className="text-[0.7rem] uppercase text-slate-400 tracking-wide">
              Your info
            </p>
            <p className="text-sm">
              Role:{' '}
              <span
                className={`font-semibold text-base sm:text-lg tracking-wide ${roleColorClass}`}
              >
                {visibleRoleText}
              </span>
            </p>
            <p className="text-sm">
              Word:{' '}
              <span
                className={`font-semibold text-base sm:text-xl tracking-wide ${wordColorClass}`}
              >
                {my.word ?? (my.role === 'blind' ? 'None' : '-')}
              </span>
            </p>
          </div>
        </section>

        {/* CONTROLS / GUESS / RESET */}
        <section className="flex flex-col gap-3">
          {/* This section handles when the host is waiting for the game to start */}
          {isHost && status === 'waiting' && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleStartGame}
                disabled={startLoading}
                className="button-primary"
              >
                {startLoading ? 'Starting…' : 'Start game'}
              </button>
              <Link
                href="/"
                className="button-secondary inline-flex items-center gap-1"
              >
                Back to home <span>🏠</span>
              </Link>
            </div>
          )}

          {/* This section handles when the "blind_guess" phase is active for the blind player */}
          {status === 'blind_guess' && my.role === 'blind' && isPendingBlind && (
            <div className="rounded-xl bg-slate-900/80 border border-slate-800/80 px-4 py-3 space-y-2">
              <p className="text-[0.7rem] uppercase text-slate-400 tracking-wide">
                Blind guess
              </p>
              <p className="text-sm text-slate-200">
                Try to guess the legits&apos; word. If you&apos;re correct, you win immediately.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={blindGuess}
                  onChange={(e) => setBlindGuess(e.target.value)}
                  placeholder="Type your guess…"
                />
                <button
                  onClick={handleBlindGuess}
                  disabled={blindSubmitting}
                  className="button-primary sm:self-stretch"
                >
                  {blindSubmitting ? 'Submitting…' : 'Submit guess'}
                </button>
              </div>
            </div>
          )}

          {/* This section makes the "Play again" button always visible once the game starts */}
          {isHost && status === 'started' && (
            <button
              onClick={handleReset}
              disabled={resetLoading}
              className="button-secondary self-start"
            >
              {resetLoading ? 'Resetting…' : 'Play again'}
            </button>
          )}

          {/* This section handles the "Play again" button when the game finishes */}
          {isHost && status === 'finished' && (
            <button
              onClick={handleReset}
              disabled={resetLoading}
              className="button-secondary self-start"
            >
              {resetLoading ? 'Resetting…' : 'Play again (same lobby)'}
            </button>
          )}
        </section>
      </div>
    </main>
  );
}
