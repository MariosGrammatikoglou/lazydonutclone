// src/lib/gameStore.ts
import { pool, initDb } from '@/lib/db';

export type Role = 'civilian' | 'undercover' | 'mrwhite';

export type Player = {
  id: string;
  name: string;
  role?: Role;
  word?: string | null;
  isHost: boolean;
  isEliminated: boolean;
  lastSeen?: number;
  talkOrder?: number; // speaking order
};

export type GameStatus = 'waiting' | 'started' | 'mrwhite_guess' | 'finished';

export type Winner = 'civilians' | 'undercovers' | 'mrwhite' | null;

export type LobbySettings = {
  civilians: number;
  undercovers: number;
  mrWhites: number;
};

export type Lobby = {
  code: string;
  hostId: string;
  hostSecret: string;
  players: Player[];
  settings: LobbySettings;
  status: GameStatus;
  civilianWord?: string;
  undercoverWord?: string;
  winner: Winner;
  pendingMrWhiteId?: string | null;
  usedWordIndices: number[];
};

const LOBBY_TABLE = 'lobbies';

// ---------- helpers ----------

function pruneInactivePlayers(lobby: Lobby): Lobby {
  // Only auto-clean while waiting in lobby
  if (lobby.status !== 'waiting') return lobby;

  const now = Date.now();
  const TIMEOUT_MS = 60_000; // 1 minute without heartbeat = gone

  const before = lobby.players.length;
  lobby.players = lobby.players.filter((p) => {
    if (!p.lastSeen) return true; // old data with no heartbeat yet -> keep
    return now - p.lastSeen < TIMEOUT_MS;
  });

  if (lobby.players.length !== before) {
    console.log(
      '[LOBBY] Pruned inactive players in',
      lobby.code,
      'before=',
      before,
      'after=',
      lobby.players.length
    );
  }

  return lobby;
}

// Decide if the game should automatically end after eliminations
// or if Mr White should get a guess when only 2 players remain.
function applyAutoWin(lobby: Lobby) {
  // Don't touch if already finished or in guess phase
  if (lobby.status === 'finished' || lobby.status === 'mrwhite_guess') return;

  const alive = lobby.players.filter((p) => !p.isEliminated);
  if (alive.length === 0) return;

  const aliveCivilians = alive.filter((p) => p.role === 'civilian').length;
  const aliveUndercovers = alive.filter((p) => p.role === 'undercover').length;
  const aliveMrWhites = alive.filter((p) => p.role === 'mrwhite').length;

  // Special rule: if Mr White is alive and there's only 1 other player alive,
  // he gets a guess popup automatically.
  if (
    lobby.status === 'started' &&
    alive.length === 2 &&
    aliveMrWhites === 1
  ) {
    const mr = alive.find((p) => p.role === 'mrwhite');
    if (mr) {
      lobby.status = 'mrwhite_guess';
      lobby.pendingMrWhiteId = mr.id;
      console.log(
        '[GAME] Mr White guess triggered automatically (2 players left) in lobby',
        lobby.code
      );
    }
    return;
  }

  // Normal auto-win conditions
  const aliveFactionCount =
    (aliveCivilians > 0 ? 1 : 0) +
    (aliveUndercovers > 0 ? 1 : 0) +
    (aliveMrWhites > 0 ? 1 : 0);

  // Only one faction left -> game ends
  if (aliveFactionCount === 1) {
    if (aliveCivilians > 0) {
      lobby.status = 'finished';
      lobby.winner = 'civilians';
      lobby.pendingMrWhiteId = null;
      console.log('[GAME] Auto-win: civilians in lobby', lobby.code);
    } else if (aliveUndercovers > 0) {
      lobby.status = 'finished';
      lobby.winner = 'undercovers';
      lobby.pendingMrWhiteId = null;
      console.log('[GAME] Auto-win: undercovers in lobby', lobby.code);
    } else if (aliveMrWhites > 0) {
      lobby.status = 'finished';
      lobby.winner = 'mrwhite';
      lobby.pendingMrWhiteId = null;
      console.log('[GAME] Auto-win: mrwhite in lobby', lobby.code);
    }
  }
}

function recomputeTalkOrder(lobby: Lobby) {
  const alive = lobby.players.filter((p) => !p.isEliminated);

  // sort by existing talkOrder to keep relative order
  alive.sort((a, b) => (a.talkOrder ?? 0) - (b.talkOrder ?? 0));

  alive.forEach((p, index) => {
    p.talkOrder = index + 1;
  });

  // clear for eliminated players
  lobby.players
    .filter((p) => p.isEliminated)
    .forEach((p) => {
      p.talkOrder = undefined;
    });
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generateId(): string {
  return crypto.randomUUID();
}

function generateHostSecret(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// word pairs for civilian vs undercover
const WORD_PAIRS: Array<{ civilian: string; undercover: string }> = [
   { civilian: 'Test1', undercover: 'Test2' },
  { civilian: 'Test3', undercover: 'Test4' },
  { civilian: 'Test5', undercover: 'Test6' },
  /*
  { civilian: 'Γάτα', undercover: 'Σκύλος' },
  { civilian: 'Καφές', undercover: 'Τσάι' },
  { civilian: 'Παράλια', undercover: 'Πισίνα' },
  { civilian: 'Πίτσα', undercover: 'Σουβλάκι' },
  { civilian: 'Βενζίνη', undercover: 'Πετρέλαιο' },
  { civilian: 'Μήλο', undercover: 'Αχλάδι' },
  { civilian: 'Καρέκλα', undercover: 'Σκαμπό' },
  { civilian: 'Βιβλίο', undercover: 'Τετράδιο' },
  { civilian: 'Ποδήλατο', undercover: 'Μηχανάκι' },
    { civilian: 'Βροχή', undercover: 'Χιόνι' },
  { civilian: 'Σαπούνι', undercover: 'Αφρόλουτρο' },
  { civilian: 'Κινητό', undercover: 'Τάμπλετ' },
  { civilian: 'Τηλεόραση', undercover: 'Ραδιόφωνο' },
  { civilian: 'Κοτόπουλο', undercover: 'Ψάρι' },
  { civilian: 'Ζάχαρη', undercover: 'Αλάτι' },
  { civilian: 'Λεωφορείο', undercover: 'Νταλίκα' },
  { civilian: 'Φωτογραφία', undercover: 'Βίντεο' },
  { civilian: 'Αυτοκίνητο', undercover: 'Τρένο' },
  { civilian: 'Μαγιό', undercover: 'Σορτσάκι' },
   { civilian: 'Τραπέζι', undercover: 'Γραφείο' },
  { civilian: 'Ποτήρι', undercover: 'Καλαμάκι' },
  { civilian: 'Καπέλο', undercover: 'Σκουφί' },
  { civilian: 'Μπύρα', undercover: 'Κρασί' },
  { civilian: 'Ψυγείο', undercover: 'Καταψύκτης' },
  { civilian: 'Στεγνωτήρας', undercover: 'Πλυντήριο' },
   { civilian: 'Λάμπα', undercover: 'Κερί' },
  { civilian: 'Κιθάρα', undercover: 'Μπουζούκι' },
  { civilian: 'Ομπρέλα', undercover: 'Αδιάβροχο' },
  { civilian: 'Πορτοκάλι', undercover: 'Μανταρίνι' },
  { civilian: 'Παπούτσια', undercover: 'Παντόφλες' },
  { civilian: 'Βρύση', undercover: 'Ντουζιέρα' },
  { civilian: 'Σεντόνι', undercover: 'Κουβέρτα' },
  { civilian: 'Κήπος', undercover: 'Πάρκο' },
  { civilian: 'Ταινία', undercover: 'Σειρά' },
  { civilian: 'Κασετίνα', undercover: 'Τσαντάκι' },
  { civilian: 'Πιρούνι', undercover: 'Κουτάλι' },
  { civilian: 'Μολύβι', undercover: 'Στυλό' },
  { civilian: 'Σανίδα', undercover: 'Ράφι' },
  { civilian: 'Παγωτό', undercover: 'Γρανίτα' },
  { civilian: 'Μπλούζα', undercover: 'Πουκάμισο' },
   { civilian: 'Δέντρο', undercover: 'Θάμνος' },
  { civilian: 'Καραμέλα', undercover: 'Σοκολάτα' },
  { civilian: 'Φούρνος', undercover: 'Μάτι Κουζίνας' },
  { civilian: 'Δρόμος', undercover: 'Πεζοδρόμιο' },
  { civilian: 'Καφενείο', undercover: 'Μπαρ' },
  { civilian: 'Πίνακας', undercover: 'Καθρέφτης' },
  { civilian: 'Φάντα Αναψυκτικό', undercover: 'Κόκα κόλα' },
  { civilian: 'Γιαούρτι', undercover: 'Γάλα' },
  { civilian: 'Στυλό', undercover: 'Μαρκαδόρος' },
  { civilian: 'Παντελόνι', undercover: 'Σορτς' },
  { civilian: 'Κουτάβι', undercover: 'Γατάκι' },
  { civilian: 'Τσουρέκι', undercover: 'Κέικ' },
   { civilian: 'Μπανάνα', undercover: 'Ανανάς' }, 
  { civilian: 'Μπουφάν', undercover: 'Ζακέτα' },
  { civilian: 'Λεμόνι', undercover: 'Λάιμ' },
  { civilian: 'Θάλασσα', undercover: 'Λίμνη' },
  { civilian: 'Λιοντάρι', undercover: 'Τίγρης' },
  { civilian: 'Καρχαρίας', undercover: 'Κροκόδειλος' },
{ civilian: 'Κουκουβάγια', undercover: 'Γεράκι' },
  */

];

async function loadLobby(code: string): Promise<Lobby | null> {
  await initDb();

  const res = await pool.query(
    `SELECT data FROM ${LOBBY_TABLE} WHERE code = $1`,
    [code.toUpperCase()]
  );

  if (res.rowCount === 0) {
    console.log('[DB] No lobby found for code', code);
    return null;
  }

  const lobby = res.rows[0].data as Lobby;
  pruneInactivePlayers(lobby);
  console.log(
    '[DB] Loaded lobby',
    lobby.code,
    'usedWordIndices=',
    lobby.usedWordIndices
  );
  return lobby;
}

async function saveLobby(lobby: Lobby): Promise<void> {
  await initDb();

  console.log(
    '[DB] Saving lobby',
    lobby.code,
    'status=',
    lobby.status,
    'usedWordIndices=',
    lobby.usedWordIndices
  );

  await pool.query(
    `INSERT INTO ${LOBBY_TABLE} (code, data)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (code) DO UPDATE SET data = EXCLUDED.data`,
    [lobby.code.toUpperCase(), JSON.stringify(lobby)]
  );
}

async function generateUniqueLobbyCode(): Promise<string> {
  await initDb();

  for (let i = 0; i < 50; i++) {
    const code = generateCode();
    const res = await pool.query(
      `SELECT 1 FROM ${LOBBY_TABLE} WHERE code = $1`,
      [code.toUpperCase()]
    );
    if (res.rowCount === 0) return code;
  }
  return generateCode();
}

// (kept for reference; not used now)
function checkWinCondition(lobby: Lobby): Lobby {
  if (lobby.status === 'waiting' || lobby.status === 'finished') {
    return lobby;
  }

  const alive = lobby.players.filter((p) => !p.isEliminated);

  const anyUnderOrMr = alive.some(
    (p) => p.role === 'undercover' || p.role === 'mrwhite'
  );
  const anyCivilians = alive.some((p) => p.role === 'civilian');

  if (!anyUnderOrMr && anyCivilians) {
    lobby.status = 'finished';
    lobby.winner = 'civilians';
  } else if (!anyCivilians && anyUnderOrMr) {
    lobby.status = 'finished';
    lobby.winner = 'undercovers';
  } else if (!anyCivilians && !anyUnderOrMr) {
    lobby.status = 'finished';
    lobby.winner = null;
  }

  return lobby;
}

// ---------- exported functions used by API routes ----------

export async function getLobby(code: string): Promise<Lobby | null> {
  if (!code) return null;
  return loadLobby(code);
}

export async function createLobby(
  hostName: string,
  settings: LobbySettings
): Promise<{ lobby: Lobby; player: Player; hostSecret: string }> {
  const code = await generateUniqueLobbyCode();
  const hostSecret = generateHostSecret();

  const host: Player = {
    id: generateId(),
    name: hostName,
    isHost: true,
    isEliminated: false,
    lastSeen: Date.now(),
  };

  const lobby: Lobby = {
    code,
    hostId: host.id,
    hostSecret,
    players: [host],
    settings,
    status: 'waiting',
    winner: null,
    pendingMrWhiteId: null,
    usedWordIndices: [],
  };

  await saveLobby(lobby);

  return { lobby, player: host, hostSecret };
}

export async function joinLobby(
  code: string,
  playerName: string,
  hostCode?: string
): Promise<{ lobby: Lobby; player: Player } | null> {
  const lobby = await loadLobby(code);
  if (!lobby) return null;
  if (lobby.status !== 'waiting') return null;

  const isHost = !!hostCode && hostCode === lobby.hostSecret;

  const player: Player = {
    id: generateId(),
    name: playerName,
    isHost,
    isEliminated: false,
    lastSeen: Date.now(),
  };

  lobby.players.push(player);

  if (isHost) {
    lobby.hostId = player.id;
  }

  await saveLobby(lobby);
  return { lobby, player };
}

export async function startGame(code: string): Promise<Lobby | null> {
  const lobby = await loadLobby(code);
  if (!lobby) return null;
  if (lobby.status !== 'waiting') return lobby;

  const totalRoles =
    lobby.settings.civilians +
    lobby.settings.undercovers +
    lobby.settings.mrWhites;

  if (totalRoles !== lobby.players.length) {
    throw new Error('Lobby is not full');
  }

  const availableIndices = WORD_PAIRS.map((_, i) => i).filter(
    (i) => !lobby.usedWordIndices.includes(i)
  );

  if (availableIndices.length === 0) {
    throw new Error(
      'This lobby has used all available word pairs. Please add more pairs in the code.'
    );
  }

  const chosenIndex =
    availableIndices[Math.floor(Math.random() * availableIndices.length)];
  const pair = WORD_PAIRS[chosenIndex];

  console.log(
    '[GAME] Starting new round in lobby',
    code,
    'chosenIndex=',
    chosenIndex,
    'pair=',
    pair,
    'previous usedWordIndices=',
    lobby.usedWordIndices
  );

  lobby.usedWordIndices.push(chosenIndex);

  const roles: Role[] = [
    ...Array(lobby.settings.civilians).fill('civilian' as Role),
    ...Array(lobby.settings.undercovers).fill('undercover' as Role),
    ...Array(lobby.settings.mrWhites).fill('mrwhite' as Role),
  ];

  // Shuffle roles
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }

  lobby.players = lobby.players.map((p, idx) => {
    const role = roles[idx];
    let word: string | null = null;
    if (role === 'civilian') word = pair.civilian;
    if (role === 'undercover') word = pair.undercover;
    if (role === 'mrwhite') word = null;

    return {
      ...p,
      role,
      word,
      isEliminated: false,
    };
  });

  lobby.status = 'started';
  lobby.civilianWord = pair.civilian;
  lobby.undercoverWord = pair.undercover;
  lobby.winner = null;
  lobby.pendingMrWhiteId = null;

  // Random speaking order for this game
  const shuffled = [...lobby.players];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  shuffled.forEach((p, index) => {
    p.talkOrder = index + 1;
  });

  await saveLobby(lobby);
  return lobby;
}

// This is used by /api/kick-player (Execute in-game)
export async function eliminatePlayer(
  code: string,
  hostId: string,
  targetPlayerId: string
): Promise<{ lobby: Lobby; mrWhiteNeedsGuess: boolean } | null> {
  const lobby = await loadLobby(code);
  if (!lobby) return null;

  if (lobby.hostId !== hostId) return null;
  if (lobby.status !== 'started' && lobby.status !== 'mrwhite_guess') {
    return null;
  }

  const target = lobby.players.find((p) => p.id === targetPlayerId);
  if (!target) return null;

  if (target.isEliminated) {
    await saveLobby(lobby);
    return { lobby, mrWhiteNeedsGuess: false };
  }

  // Mark eliminated
  target.isEliminated = true;

  // Re-compute speaking order for alive players
  recomputeTalkOrder(lobby);

  let mrWhiteNeedsGuess = false;

  if (target.role === 'mrwhite') {
    // Mr White gets a guess when he is executed
    lobby.status = 'mrwhite_guess';
    lobby.pendingMrWhiteId = target.id;
    mrWhiteNeedsGuess = true;
  } else {
    lobby.pendingMrWhiteId = null;
    // Check for auto-win or Mr White special rule (2 alive -> guess)
    applyAutoWin(lobby);
  }

  await saveLobby(lobby);
  return { lobby, mrWhiteNeedsGuess };
}

export async function kickFromLobby(
  code: string,
  hostId: string,
  targetPlayerId: string
): Promise<Lobby | null> {
  const lobby = await loadLobby(code);
  if (!lobby) return null;

  // Only host can do this
  if (lobby.hostId !== hostId) return null;
  // Only in waiting stage (lobby state)
  if (lobby.status !== 'waiting') return null;

  const before = lobby.players.length;
  lobby.players = lobby.players.filter((p) => p.id !== targetPlayerId);

  if (lobby.players.length === before) {
    return null; // nothing removed
  }

  console.log(
    '[LOBBY] Host kicked player from lobby',
    lobby.code,
    'target=',
    targetPlayerId
  );

  await saveLobby(lobby);
  return lobby;
}

// Mr White guess (used by /api/mrwhite-guess)
export async function submitMrWhiteGuess(
  code: string,
  playerId: string,
  guess: string
): Promise<Lobby | null> {
  const lobby = await loadLobby(code);
  if (!lobby) return null;

  if (lobby.status !== 'mrwhite_guess') return null;
  if (lobby.pendingMrWhiteId !== playerId) return null;

  const player = lobby.players.find((p) => p.id === playerId);
  if (!player) return null;

  const civilianWord = lobby.civilianWord ?? '';
  const normalizedGuess = guess.trim().toLowerCase();
  const normalizedWord = civilianWord.trim().toLowerCase();

  if (!normalizedWord) return null;

  if (!normalizedGuess) {
    return null;
  }

  if (normalizedGuess === normalizedWord) {
    // ✅ Correct: Mr White wins instantly
    lobby.status = 'finished';
    lobby.winner = 'mrwhite';
    lobby.pendingMrWhiteId = null;
    console.log('[GAME] Mr White guessed correctly:', guess);
  } else {
    // ❌ Wrong: Mr White is out, game continues / auto-win check
    console.log(
      '[GAME] Mr White guess wrong',
      guess,
      'target=',
      civilianWord
    );

    player.isEliminated = true;
    lobby.pendingMrWhiteId = null;
    lobby.status = 'started';

    // He's definitely out now; recompute talk order and apply auto win
    recomputeTalkOrder(lobby);
    applyAutoWin(lobby);
  }

  await saveLobby(lobby);
  return lobby;
}

export async function resetLobby(
  code: string,
  hostId: string
): Promise<Lobby | null> {
  const lobby = await loadLobby(code);
  if (!lobby) return null;
  if (lobby.hostId !== hostId) return null;

  // Go back to pre-game state but keep all players in the lobby
  lobby.status = 'waiting';
  lobby.winner = null;
  lobby.pendingMrWhiteId = null;
  lobby.civilianWord = undefined;
  lobby.undercoverWord = undefined;

  // Keep usedWordIndices so this lobby never repeats word pairs
  // Keep all players, just clear their game state
  lobby.players = lobby.players.map((p) => ({
    ...p,
    role: undefined,
    word: undefined,
    isEliminated: false,
  }));

  await saveLobby(lobby);
  return lobby;
}

export async function updateLobbySettings(
  code: string,
  hostId: string,
  settings: LobbySettings
): Promise<Lobby | null> {
  const lobby = await loadLobby(code);
  if (!lobby) return null;

  // Only host can change settings
  if (lobby.hostId !== hostId) return null;

  // Only allow changing settings while waiting in lobby
  if (lobby.status !== 'waiting') return null;

  // Basic safety: ensure non-negative integers
  const civ = Math.max(0, Number(settings.civilians || 0));
  const und = Math.max(0, Number(settings.undercovers || 0));
  const mrw = Math.max(0, Number(settings.mrWhites || 0));

  lobby.settings = {
    civilians: civ,
    undercovers: und,
    mrWhites: mrw,
  };

  console.log(
    '[LOBBY] Updated settings for',
    lobby.code,
    '->',
    lobby.settings
  );

  await saveLobby(lobby);
  return lobby;
}

export async function getPlayerState(
  code: string,
  playerId: string
): Promise<{ lobby: Lobby; player: Player } | null> {
  const lobby = await loadLobby(code);
  if (!lobby) return null;
  const player = lobby.players.find((p) => p.id === playerId);
  if (!player) return null;

  // heartbeat: they’re clearly still online
  player.lastSeen = Date.now();
  await saveLobby(lobby);

  return { lobby, player };
}
