import { NextResponse } from 'next/server';
import { removePlayerFromLobby } from '@/lib/gameStore';

export async function POST(req: Request) {
  const { lobbyCode, playerId } = await req.json();

  if (!lobbyCode || !playerId) {
    return NextResponse.json(
      { error: 'lobbyCode and playerId are required' },
      { status: 400 }
    );
  }

  await removePlayerFromLobby(lobbyCode, playerId);

  return NextResponse.json({ ok: true });
}
