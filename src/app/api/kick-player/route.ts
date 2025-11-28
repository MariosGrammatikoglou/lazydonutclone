// src/app/api/kick-player/route.ts
import { NextResponse } from 'next/server';
import { eliminatePlayer } from '@/lib/gameStore';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const { lobbyCode, hostId, targetId } = body ?? {};

  if (!lobbyCode || !hostId || !targetId) {
    return NextResponse.json(
      { error: 'lobbyCode, hostId and targetId are required' },
      { status: 400 }
    );
  }

  const result = await eliminatePlayer(lobbyCode, hostId, targetId);
  if (!result) {
    return NextResponse.json(
      { error: 'Could not execute player' },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    mrWhiteNeedsGuess: result.mrWhiteNeedsGuess,
  });
}
