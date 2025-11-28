// src/app/join/JoinLobbyClient.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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

  // auto-fill host code if stored locally for this lobby
  useEffect(() => {
    if (!lobbyCode) return;
    try {
      const stored = localStorage.getItem(`hostCode:${lobbyCode}`);
      if (stored && !hostCode) {
        setHostCode(stored);
      }
    } catch {
      // ignore
    }
  }, [lobbyCode, hostCode]);

  async function handleJoin() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/join-lobby', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: defaultUsername,
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
    <div className="card">
      <h2>Join Lobby</h2>
      <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: '#9ca3af' }}>
        Player: <strong>{defaultUsername}</strong>
      </p>

      <div className="form-group">
        <label>Lobby Code</label>
        <input
          value={lobbyCode}
          onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
          placeholder="ABCDE"
        />
      </div>

      <div className="form-group">
        <label>Host Code (optional, only if you are the host)</label>
        <input
          value={hostCode}
          onChange={(e) => setHostCode(e.target.value)}
          placeholder="1234"
        />
      </div>

      {error && <div className="error">{error}</div>}

      <div className="button-row" style={{ marginTop: '0.75rem' }}>
        <button
          onClick={handleJoin}
          disabled={loading || !lobbyCode.trim()}
        >
          {loading ? 'Joining...' : 'Join'}
        </button>
        <button
          className="button-secondary"
          onClick={() => router.push('/')}
          disabled={loading}
        >
          Back
        </button>
      </div>
    </div>
  );
}
