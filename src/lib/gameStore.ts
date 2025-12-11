// src/lib/gameStore.ts
import { pool, initDb } from '@/lib/db';

export type Role = 'legit' | 'clone' | 'blind';

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

export type GameStatus = 'waiting' | 'started' | 'blind_guess' | 'finished';

export type Winner = 'legits' | 'clones' | 'blind' | null;

export type LobbySettings = {
  legits: number;
  clones: number;
  blinds: number;
};

export type Lobby = {
  code: string;
  hostId: string;
  hostSecret: string;
  players: Player[];
  settings: LobbySettings;
  status: GameStatus;
  legitWord?: string;
  cloneWord?: string;
  winner: Winner;
  pendingBlindId?: string | null;
  usedWordIndices: number[];
  // voting during a round: voterId -> targetPlayerId
  votes?: Record<string, string>;
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
function applyAutoWin(lobby: Lobby) {
  // Don't touch if already finished or in guess phase
  if (lobby.status === 'finished' || lobby.status === 'blind_guess') return;

  const alive = lobby.players.filter((p) => !p.isEliminated);
  if (alive.length === 0) return;

  const aliveLegits = alive.filter((p) => p.role === 'legit').length;
  const aliveClones = alive.filter((p) => p.role === 'clone').length;
  const aliveBlinds = alive.filter((p) => p.role === 'blind').length;

  if (
    lobby.status === 'started' &&
    alive.length === 2 &&
    aliveBlinds === 1
  ) {
    const bl = alive.find((p) => p.role === 'blind');
    if (bl) {
      lobby.status = 'blind_guess';
      lobby.pendingBlindId = bl.id;
      console.log(
        '[GAME] Blind guess triggered automatically (2 players left) in lobby',
        lobby.code
      );
    }
    return;
  }

  // Normal auto-win conditions
  const aliveFactionCount =
    (aliveLegits > 0 ? 1 : 0) +
    (aliveClones > 0 ? 1 : 0) +
    (aliveBlinds > 0 ? 1 : 0);

  // Only one faction left -> game ends
  if (aliveFactionCount === 1) {
    if (aliveLegits > 0) {
      lobby.status = 'finished';
      lobby.winner = 'legits';
      lobby.pendingBlindId = null;
      console.log('[GAME] Auto-win: legits in lobby', lobby.code);
    } else if (aliveClones > 0) {
      lobby.status = 'finished';
      lobby.winner = 'clones';
      lobby.pendingBlindId = null;
      console.log('[GAME] Auto-win: clones in lobby', lobby.code);
    } else if (aliveBlinds > 0) {
      lobby.status = 'finished';
      lobby.winner = 'blind';
      lobby.pendingBlindId = null;
      console.log('[GAME] Auto-win: blind in lobby', lobby.code);
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

const WORD_PAIRS: Array<{ legit: string; clone: string }> = [

  { legit: 'Γάτα', clone: 'Σκύλος' },
  { legit: 'Καφές', clone: 'Τσάι' },
  { legit: 'Παράλια', clone: 'Πισίνα' },
  { legit: 'Πίτσα', clone: 'Σουβλάκι' },
  { legit: 'Βενζίνη', clone: 'Πετρέλαιο' },
  { legit: 'Μήλο', clone: 'Αχλάδι' },
  { legit: 'Καρέκλα', clone: 'Σκαμπό' },
  { legit: 'Βιβλίο', clone: 'Τετράδιο' },
  { legit: 'Ποδήλατο', clone: 'Μηχανάκι' },
    { legit: 'Βροχή', clone: 'Χιόνι' },
  { legit: 'Σαπούνι', clone: 'Αφρόλουτρο' },
  { legit: 'Κινητό', clone: 'Τάμπλετ' },
  { legit: 'Τηλεόραση', clone: 'Ραδιόφωνο' },
  { legit: 'Κοτόπουλο', clone: 'Ψάρι' },
  { legit: 'Ζάχαρη', clone: 'Αλάτι' },
  { legit: 'Λεωφορείο', clone: 'Νταλίκα' },
  { legit: 'Φωτογραφία', clone: 'Βίντεο' },
  { legit: 'Αυτοκίνητο', clone: 'Τρένο' },
  { legit: 'Μαγιό', clone: 'Σορτσάκι' },
   { legit: 'Τραπέζι', clone: 'Γραφείο' },
  { legit: 'Ποτήρι', clone: 'Καλαμάκι' },
  { legit: 'Καπέλο', clone: 'Σκουφί' },
  { legit: 'Μπύρα', clone: 'Κρασί' },
  { legit: 'Ψυγείο', clone: 'Καταψύκτης' },
  { legit: 'Στεγνωτήρας', clone: 'Πλυντήριο' },
   { legit: 'Λάμπα', clone: 'Κερί' },
  { legit: 'Κιθάρα', clone: 'Μπουζούκι' },
  { legit: 'Ομπρέλα', clone: 'Αδιάβροχο' },
  { legit: 'Πορτοκάλι', clone: 'Μανταρίνι' },
  { legit: 'Παπούτσια', clone: 'Παντόφλες' },
  { legit: 'Βρύση', clone: 'Ντουζιέρα' },
  { legit: 'Σεντόνι', clone: 'Κουβέρτα' },
  { legit: 'Κήπος', clone: 'Πάρκο' },
  { legit: 'Ταινία', clone: 'Σειρά' },
  { legit: 'Κασετίνα', clone: 'Τσαντάκι' },
  { legit: 'Πιρούνι', clone: 'Κουτάλι' },
  { legit: 'Μολύβι', clone: 'Στυλό' },
  { legit: 'Σανίδα', clone: 'Ράφι' },
  { legit: 'Παγωτό', clone: 'Γρανίτα' },
  { legit: 'Μπλούζα', clone: 'Πουκάμισο' },
   { legit: 'Δέντρο', clone: 'Θάμνος' },
  { legit: 'Καραμέλα', clone: 'Σοκολάτα' },
  { legit: 'Φούρνος', clone: 'Μάτι Κουζίνας' },
  { legit: 'Δρόμος', clone: 'Πεζοδρόμιο' },
  { legit: 'Καφενείο', clone: 'Μπαρ' },
  { legit: 'Πίνακας', clone: 'Καθρέφτης' },
  { legit: 'Φάντα Αναψυκτικό', clone: 'Κόκα κόλα' },
  { legit: 'Γιαούρτι', clone: 'Γάλα' },
  { legit: 'Στυλό', clone: 'Μαρκαδόρος' },
  { legit: 'Παντελόνι', clone: 'Σορτς' },
  { legit: 'Κουτάβι', clone: 'Γατάκι' },
  { legit: 'Τσουρέκι', clone: 'Κέικ' },
   { legit: 'Μπανάνα', clone: 'Ανανάς' }, 
  { legit: 'Μπουφάν', clone: 'Ζακέτα' },
  { legit: 'Λεμόνι', clone: 'Λάιμ' },
  { legit: 'Θάλασσα', clone: 'Λίμνη' },
  { legit: 'Λιοντάρι', clone: 'Τίγρης' },
  { legit: 'Καρχαρίας', clone: 'Κροκόδειλος' },
{ legit: 'Κουκουβάγια', clone: 'Γεράκι' },
  

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

  const anyCloneOrBlind = alive.some(
    (p) => p.role === 'clone' || p.role === 'blind'
  );
  const anyLegits = alive.some((p) => p.role === 'legit');

  if (!anyCloneOrBlind && anyLegits) {
    lobby.status = 'finished';
    lobby.winner = 'legits';
  } else if (!anyLegits && anyCloneOrBlind) {
    lobby.status = 'finished';
    lobby.winner = 'clones';
  } else if (!anyLegits && !anyCloneOrBlind) {
    lobby.status = 'finished';
    lobby.winner = null;
  }

  return lobby;
}

// ---------- exported functions used by API routes ----------

export async function removePlayerFromLobby(
  code: string,
  playerId: string
): Promise<Lobby | null> {
  const lobby = await loadLobby(code);
  if (!lobby) return null;

  const before = lobby.players.length;
  lobby.players = lobby.players.filter((p) => p.id !== playerId);

  if (lobby.players.length === before) {
    // player was not in this lobby
    return lobby;
  }

  console.log(
    '[LOBBY] Player left / removed from lobby',
    lobby.code,
    'player=',
    playerId
  );

  if (lobby.players.length === 0) {
    // Lobby is now empty → reset it to a clean waiting state
    lobby.status = 'waiting';
    lobby.winner = null;
    lobby.pendingBlindId = null;
    lobby.legitWord = undefined;
    lobby.cloneWord = undefined;
    console.log(
      '[LOBBY] Lobby empty after player leave, reset to waiting',
      lobby.code
    );
  } else if (lobby.status === 'started' || lobby.status === 'blind_guess') {
    // Game was running and someone left:
    recomputeTalkOrder(lobby);
    applyAutoWin(lobby);
  }

  await saveLobby(lobby);
  return lobby;
}




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
    pendingBlindId: null,
    usedWordIndices: [],
    votes: {},
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
    lobby.settings.legits +
    lobby.settings.clones +
    lobby.settings.blinds;

  if (totalRoles !== lobby.players.length) {
    throw new Error('Lobby is not full');
  }

  const availableIndices = WORD_PAIRS.map((_, i) => i).filter(
    (i) => !lobby.usedWordIndices.includes(i)
  );

  if (availableIndices.length === 0) {
    throw new Error(
      'This lobby has used all available word pairs.'
    );
  }

  const chosenIndex =
    availableIndices[Math.floor(Math.random() * availableIndices.length)];
  const basePair = WORD_PAIRS[chosenIndex];

  // 👇 NEW: randomly decide which word is legit and which is clone
  const flip = Math.random() < 0.5;
  const legitWord = flip ? basePair.clone : basePair.legit;
  const cloneWord = flip ? basePair.legit : basePair.clone;

  console.log(
    '[GAME] Starting new round in lobby',
    code,
    'chosenIndex=',
    chosenIndex,
    'basePair=',
    basePair,
    'assigned={ legit:', legitWord, ', clone:', cloneWord, '}',
    'previous usedWordIndices=',
    lobby.usedWordIndices
  );

  lobby.usedWordIndices.push(chosenIndex);

  const roles: Role[] = [
    ...Array(lobby.settings.legits).fill('legit' as Role),
    ...Array(lobby.settings.clones).fill('clone' as Role),
    ...Array(lobby.settings.blinds).fill('blind' as Role),
  ];

  // Shuffle roles
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }

  lobby.players = lobby.players.map((p, idx) => {
    const role = roles[idx];
    let word: string | null = null;
    if (role === 'legit') word = legitWord;
    if (role === 'clone') word = cloneWord;
    if (role === 'blind') word = null;

    return {
      ...p,
      role,
      word,
      isEliminated: false,
    };
  });

  lobby.status = 'started';
  lobby.legitWord = legitWord;
  lobby.cloneWord = cloneWord;
  lobby.winner = null;
  lobby.pendingBlindId = null;
  lobby.votes = {};

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
): Promise<{ lobby: Lobby; blindNeedsGuess: boolean } | null> {
  const lobby = await loadLobby(code);
  if (!lobby) return null;

  if (lobby.hostId !== hostId) return null;
  if (lobby.status !== 'started' && lobby.status !== 'blind_guess') {
    return null;
  }

  const target = lobby.players.find((p) => p.id === targetPlayerId);
  if (!target) return null;

  if (target.isEliminated) {
    await saveLobby(lobby);
    return { lobby, blindNeedsGuess: false };
  }

  // Mark eliminated
  target.isEliminated = true;

  // Re-compute speaking order for alive players
  recomputeTalkOrder(lobby);

  let blindNeedsGuess = false;

  if (target.role === 'blind') {
    lobby.status = 'blind_guess';
    lobby.pendingBlindId = target.id;
    blindNeedsGuess = true;
  } else {
    lobby.pendingBlindId = null;
    applyAutoWin(lobby);
  }

    // After an execution, clear all visible votes
  lobby.votes = {};


  await saveLobby(lobby);
  return { lobby, blindNeedsGuess };
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

  if (lobby.votes) {
    delete lobby.votes[targetPlayerId];
  }


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

export async function submitBlindGuess(
  code: string,
  playerId: string,
  guess: string
): Promise<Lobby | null> {
  const lobby = await loadLobby(code);
  if (!lobby) return null;

  if (lobby.status !== 'blind_guess') return null;
  if (lobby.pendingBlindId !== playerId) return null;

  const player = lobby.players.find((p) => p.id === playerId);
  if (!player) return null;

  const legitWord = lobby.legitWord ?? '';
  const normalizedGuess = guess.trim().toLowerCase();
  const normalizedWord = legitWord.trim().toLowerCase();

  if (!normalizedWord) return null;

  if (!normalizedGuess) {
    return null;
  }

  if (normalizedGuess === normalizedWord) {
    lobby.status = 'finished';
    lobby.winner = 'blind';
    lobby.pendingBlindId = null;
    console.log('[GAME] Blind guessed correctly:', guess);
  } else {
    console.log(
      '[GAME] Blind guess wrong',
      guess,
      'target=',
      legitWord
    );

    player.isEliminated = true;
    lobby.pendingBlindId = null;
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
  lobby.pendingBlindId = null;
  lobby.legitWord = undefined;
  lobby.cloneWord = undefined;
  lobby.votes = {};


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
  const leg = Math.max(0, Number(settings.legits || 0));
  const clo = Math.max(0, Number(settings.clones || 0));
  const bli = Math.max(0, Number(settings.blinds || 0));

  lobby.settings = {
    legits: leg,
    clones: clo,
    blinds: bli,
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

export async function addVote(
  code: string,
  voterId: string,
  targetPlayerId: string
): Promise<Lobby | null> {
  const lobby = await loadLobby(code);
  if (!lobby) return null;

  // Only allow votes during an active game
  if (lobby.status !== 'started' && lobby.status !== 'blind_guess') {
    return lobby;
  }

  // Voter must exist and be alive
  const voter = lobby.players.find(
    (p) => p.id === voterId && !p.isEliminated
  );
  if (!voter) return lobby;

  // Target must exist and be alive
  const target = lobby.players.find(
    (p) => p.id === targetPlayerId && !p.isEliminated
  );
  if (!target) return lobby;

  if (!lobby.votes) lobby.votes = {};

  // Move / set this voter's vote to the new target.
  // This automatically "removes" their vote from any previous target.
  lobby.votes[voterId] = targetPlayerId;

  await saveLobby(lobby);
  return lobby;
}
