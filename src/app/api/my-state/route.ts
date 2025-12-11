import { NextResponse } from 'next/server';
import { getPlayerState } from '@/lib/gameStore';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { lobbyCode, playerId } = body as {
    lobbyCode?: string;
    playerId?: string;
  };

  if (!lobbyCode || !playerId) {
    return NextResponse.json(
      { error: 'lobbyCode and playerId are required' },
      { status: 400 }
    );
  }

  const result = await getPlayerState(lobbyCode, playerId);

  if (!result) {
    return NextResponse.json(
      {
        error: 'Player not found in lobby',
        code: 'PLAYER_NOT_IN_LOBBY',
      },
      { status: 404 }
    );
  }

  const { lobby, player } = result;

  return NextResponse.json({
    lobbyStatus: lobby.status,
    winner: lobby.winner,
    hostSecret: lobby.hostSecret, // 👈 always include
    player: {
      id: player.id,
      name: player.name,
      role: player.role,
      word: player.word ?? null,
      isHost: player.isHost,
      isEliminated: player.isEliminated,
    },
  });
}
