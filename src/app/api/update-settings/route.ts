import { NextResponse } from 'next/server';
import { updateLobbySettings } from '@/lib/gameStore';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));
  const { lobbyCode, hostId, civilians, undercovers, mrWhites } = body ?? {};

  if (!lobbyCode || !hostId) {
    return NextResponse.json(
      { error: 'lobbyCode and hostId are required' },
      { status: 400 }
    );
  }

  const lobby = await updateLobbySettings(lobbyCode, hostId, {
    civilians: Number(civilians ?? 0),
    undercovers: Number(undercovers ?? 0),
    mrWhites: Number(mrWhites ?? 0),
  });

  if (!lobby) {
    return NextResponse.json(
      { error: 'Could not update settings (are you the host? is lobby waiting?)' },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    settings: lobby.settings,
  });
}
