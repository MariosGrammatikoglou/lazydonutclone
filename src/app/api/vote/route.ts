import { NextResponse } from 'next/server';
import { addVote } from '@/lib/gameStore';

export async function POST(req: Request) {
  const { lobbyCode, targetId, voterId } = await req.json();

  if (!lobbyCode || !targetId || !voterId) {
    return NextResponse.json(
      { error: 'lobbyCode, targetId and voterId are required' },
      { status: 400 }
    );
  }

  const lobby = await addVote(lobbyCode, voterId, targetId);
  if (!lobby) {
    return NextResponse.json(
      { error: 'Lobby not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
