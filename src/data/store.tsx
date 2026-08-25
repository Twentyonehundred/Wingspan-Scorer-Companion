import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  GoogleAuthProvider,
  getRedirectResult,
  linkWithPopup,
  linkWithRedirect,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { auth, db, firebaseConfigured } from '../firebase'
import { groupKeyFor } from '../lib/scoring'
import type { Draft, Game, ModuleKey, Player } from '../types'
import {
  shareWith as putShare,
  stopSharing as removeShare,
  watchAccount,
  watchAllAccounts,
  watchOwnAccount,
  type Account,
} from './accounts'

export { profileFor, type Account, type Profile } from './accounts'

/**
 * The setup to open on next time. Held against the account rather than derived
 * from the last game, so it survives deleting that game and follows you to
 * another device.
 */
export interface Prefs {
  lastModules: ModuleKey[]
  lastPlayerIds: string[]
}

/* -------------------------------------------------------------------------- */
/* Backends                                                                    */
/* -------------------------------------------------------------------------- */

interface Snapshot {
  players: Player[]
  games: Game[]
  prefs: Prefs | null
}

interface Backend {
  subscribe(onData: (s: Snapshot) => void): Unsubscribe
  putPlayer(player: Player): Promise<void>
  putGame(game: Game): Promise<void>
  putPrefs(prefs: Prefs): Promise<void>
  removePlayer(id: string): Promise<void>
  removeGame(id: string): Promise<void>
}

const EMPTY: Snapshot = { players: [], games: [], prefs: null }

const LOCAL_KEY = 'ws.local'

function readLocal(): Snapshot {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<Snapshot>
    return {
      players: parsed.players ?? [],
      games: parsed.games ?? [],
      prefs: parsed.prefs ?? null,
    }
  } catch {
    return EMPTY
  }
}

function localBackend(): Backend {
  let state = readLocal()
  const listeners = new Set<(s: Snapshot) => void>()

  const commit = (next: Snapshot) => {
    state = next
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(state))
    } catch {
      // Private browsing / quota. The session still works in memory.
    }
    for (const l of listeners) l(state)
  }

  return {
    subscribe(onData) {
      listeners.add(onData)
      onData(state)
      const onStorage = (e: StorageEvent) => {
        if (e.key === LOCAL_KEY) {
          state = readLocal()
          onData(state)
        }
      }
      window.addEventListener('storage', onStorage)
      return () => {
        listeners.delete(onData)
        window.removeEventListener('storage', onStorage)
      }
    },
    async putPlayer(player) {
      const players = state.players.filter((p) => p.id !== player.id).concat(player)
      commit({ ...state, players })
    },
    async putGame(game) {
      const games = state.games.filter((g) => g.id !== game.id).concat(game)
      commit({ ...state, games })
    },
    async putPrefs(prefs) {
      commit({ ...state, prefs })
    },
    async removePlayer(id) {
      commit({ ...state, players: state.players.filter((p) => p.id !== id) })
    },
    async removeGame(id) {
      commit({ ...state, games: state.games.filter((g) => g.id !== id) })
    },
  }
}

function firestoreBackend(uid: string): Backend {
  const root = doc(db!, 'users', uid)
  const playersRef = collection(root, 'players')
  const gamesRef = collection(root, 'games')
  const prefsRef = doc(collection(root, 'prefs'), 'setup')

  return {
    subscribe(onData) {
      let players: Player[] = []
      let games: Game[] = []
      let prefs: Prefs | null = null
      const push = () => onData({ players, games, prefs })

      const offPlayers = onSnapshot(playersRef, (snap) => {
        players = snap.docs.map((d) => ({ ...(d.data() as Omit<Player, 'id'>), id: d.id }))
        push()
      })
      const offGames = onSnapshot(gamesRef, (snap) => {
        games = snap.docs.map((d) => ({ ...(d.data() as Omit<Game, 'id'>), id: d.id }))
        push()
      })
      const offPrefs = onSnapshot(prefsRef, (snap) => {
        prefs = snap.exists() ? (snap.data() as Prefs) : null
        push()
      })
      return () => {
        offPlayers()
        offGames()
        offPrefs()
      }
    },
    async putPlayer(player) {
      const { id, ...rest } = player
      await setDoc(doc(playersRef, id), rest)
    },
    async putGame(game) {
      const { id, ...rest } = game
      // Firestore rejects `undefined`; a missing tiebreak or unrecorded first
      // player is stored as null.
      await setDoc(doc(gamesRef, id), {
        ...rest,
        winnerId: rest.winnerId ?? null,
        firstPlayerId: rest.firstPlayerId ?? null,
      })
    },
    async putPrefs(prefs) {
      await setDoc(prefsRef, prefs)
    },
    async removePlayer(id) {
      await deleteDoc(doc(playersRef, id))
    },
    async removeGame(id) {
      await deleteDoc(doc(gamesRef, id))
    },
  }
}

/* -------------------------------------------------------------------------- */
/* Draft persistence                                                           */
/* -------------------------------------------------------------------------- */

const DRAFT_KEY = 'ws.draft'

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as Draft) : null
  } catch {
    return null
  }
}

/* -------------------------------------------------------------------------- */
/* Store                                                                       */
/* -------------------------------------------------------------------------- */

export type AuthStatus = 'loading' | 'anonymous' | 'signed-in' | 'local'

interface Store {
  ready: boolean
  authStatus: AuthStatus
  user: User | null
  cloudEnabled: boolean
  authError: string | null
  signIn: () => Promise<void>
  signOutToSandbox: () => Promise<void>

  /**
   * Every account, or `null` when the rules refused the query — which is the
   * app owner check. There is no server to mint a claim on this plan, so
   * "am I the owner?" is answered by asking Firestore and seeing what it says.
   */
  accounts: Account[] | null
  /** Set when these games belong to someone who shared them with you. */
  sharedFrom: Account | null
  shareWith: (guestId: string) => Promise<void>
  stopSharing: (guestId: string) => Promise<void>

  players: Player[]
  games: Game[]
  prefs: Prefs | null

  addPlayer: (name: string) => Promise<Player>
  renamePlayer: (id: string, name: string) => Promise<void>
  /** Also removes that player's games — see the note on the implementation. */
  deletePlayer: (id: string) => Promise<void>
  gamesForPlayer: (id: string) => Game[]
  saveGame: (game: Game) => Promise<void>
  deleteGame: (id: string) => Promise<void>
  saveSetup: (prefs: Prefs) => Promise<void>

  draft: Draft | null
  setDraft: (draft: Draft | null) => void
}

const StoreContext = createContext<Store | null>(null)

const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [authStatus, setAuthStatus] = useState<AuthStatus>(
    firebaseConfigured ? 'loading' : 'local',
  )
  const [authError, setAuthError] = useState<string | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  // `false` until the account document has been read once, so the data backend
  // can wait rather than guess at the workspace.
  const [accountKnown, setAccountKnown] = useState(false)
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [sharedFrom, setSharedFrom] = useState<Account | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY)
  const [ready, setReady] = useState(!firebaseConfigured)
  const [draft, setDraftState] = useState<Draft | null>(() => readDraft())

  const backendRef = useRef<Backend | null>(null)

  /* Auth: everyone gets an anonymous session immediately so the app is usable
     with no login; signing in with Google upgrades that same session. */
  useEffect(() => {
    const client = auth
    if (!client) {
      backendRef.current = localBackend()
      return
    }
    // Resolves a redirect-based sign-in from a previous page load.
    getRedirectResult(client).catch(() => {})

    return onAuthStateChanged(client, (u) => {
      if (!u) {
        signInAnonymously(client).catch((err: unknown) => {
          setAuthError(errorMessage(err))
          setAuthStatus('local')
          setReady(true)
        })
        return
      }
      setUser(u)
      setAuthStatus(u.isAnonymous ? 'anonymous' : 'signed-in')
    })
  }, [])

  /* The account row: who you are to the other accounts, and which workspace
     you are pointed at. Anonymous sessions never get one — they are sandboxes,
     not people — so they are known immediately and use their own uid. */
  useEffect(() => {
    setAccount(null)
    setAccountKnown(false)
    if (!db || !user) return
    if (user.isAnonymous) {
      setAccountKnown(true)
      return
    }
    return watchOwnAccount(user, (a) => {
      setAccount(a)
      setAccountKnown(true)
    })
  }, [user])

  /* The registry. Only the app owner may read it, so a refusal is the answer to
     "should the admin section be here?" and the rules stay the only place the
     owner is named. */
  useEffect(() => {
    setAccounts(null)
    if (!db || !user || user.isAnonymous) return
    return watchAllAccounts(setAccounts)
  }, [user])

  const workspaceId = !user ? null : accountKnown ? (account?.workspaceId ?? user.uid) : null
  const hostId = workspaceId && user && workspaceId !== user.uid ? workspaceId : null

  /* Whose games these are, when they aren't yours. */
  useEffect(() => {
    setSharedFrom(null)
    if (!db || !hostId) return
    return watchAccount(hostId, setSharedFrom)
  }, [hostId])

  /* Data: the backend follows the workspace. Held back until it is known, so a
     guest never flashes their own empty history before switching over. */
  useEffect(() => {
    if (!firebaseConfigured) {
      const backend = localBackend()
      backendRef.current = backend
      return backend.subscribe((s) => {
        setSnapshot(s)
        setReady(true)
      })
    }

    // A change of workspace is a change of everything. Clear rather than let
    // the old pile sit there looking current until the first snapshot lands.
    backendRef.current = null
    setSnapshot(EMPTY)
    setReady(false)
    if (!auth || !workspaceId) return

    const backend = firestoreBackend(workspaceId)
    backendRef.current = backend
    return backend.subscribe((s) => {
      setSnapshot(s)
      setReady(true)
    })
  }, [workspaceId])

  const setDraft = useCallback((next: Draft | null) => {
    setDraftState(next)
    try {
      if (next) localStorage.setItem(DRAFT_KEY, JSON.stringify(next))
      else localStorage.removeItem(DRAFT_KEY)
    } catch {
      // Ignore — the draft is a convenience, not the source of truth.
    }
  }, [])

  const signIn = useCallback(async () => {
    if (!auth) return
    setAuthError(null)
    const provider = new GoogleAuthProvider()
    const current = auth.currentUser
    try {
      if (current?.isAnonymous) {
        // Link so the sandbox games entered before signing in are kept.
        await linkWithPopup(current, provider)
      } else {
        await signInWithPopup(auth, provider)
      }
    } catch (err) {
      const code = (err as { code?: string }).code ?? ''
      if (code === 'auth/credential-already-in-use') {
        // This Google account already has data. That account wins; the
        // anonymous sandbox is dropped.
        const credential = GoogleAuthProvider.credentialFromError(err as never)
        if (credential) {
          await signInWithCredential(auth, credential)
          return
        }
      }
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        // Standalone PWAs on iOS often cannot open a popup.
        if (current?.isAnonymous) await linkWithRedirect(current, provider)
        return
      }
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return
      setAuthError(errorMessage(err))
    }
  }, [])

  const signOutToSandbox = useCallback(async () => {
    if (!auth) return
    setSnapshot(EMPTY)
    await fbSignOut(auth)
    await signInAnonymously(auth)
  }, [])

  /**
   * Hand another account your games. From then on you are both reading and
   * writing the same pile: whatever either of you scores, both of you see.
   */
  const shareWith = useCallback(
    async (guestId: string) => {
      if (!user || guestId === user.uid) return
      await putShare(user.uid, guestId)
    },
    [user],
  )

  const stopSharing = useCallback(
    async (guestId: string) => {
      if (!user) return
      await removeShare(user.uid, guestId)
    },
    [user],
  )

  const addPlayer = useCallback(
    async (name: string) => {
      // Take the lowest categorical slot nobody is using yet.
      const taken = new Set(snapshot.players.map((p) => p.colorIndex).filter((i) => i != null))
      let colorIndex = 0
      while (taken.has(colorIndex) && colorIndex < 7) colorIndex += 1

      const player: Player = { id: newId(), name: name.trim(), createdAt: Date.now(), colorIndex }
      await backendRef.current?.putPlayer(player)
      return player
    },
    [snapshot.players],
  )

  const renamePlayer = useCallback(
    async (id: string, name: string) => {
      const existing = snapshot.players.find((p) => p.id === id)
      if (!existing) return
      await backendRef.current?.putPlayer({ ...existing, name: name.trim() })
    },
    [snapshot.players],
  )

  const gamesForPlayer = useCallback(
    (id: string) => snapshot.games.filter((g) => g.playerIds.includes(id)),
    [snapshot.games],
  )

  /**
   * A game is the exact set of people who sat down, and every total, group and
   * average is keyed on that set — so a game missing one of its players is not
   * a game any more. Deleting a player takes their games with them rather than
   * leaving "Unknown" rows behind. The UI names the count before this runs.
   */
  const deletePlayer = useCallback(
    async (id: string) => {
      const affected = snapshot.games.filter((g) => g.playerIds.includes(id))
      await Promise.all(affected.map((g) => backendRef.current?.removeGame(g.id) ?? Promise.resolve()))
      await backendRef.current?.removePlayer(id)

      // Drop them from the remembered setup so it can't seed a dead id.
      const remembered = snapshot.prefs
      if (remembered?.lastPlayerIds.includes(id)) {
        await backendRef.current?.putPrefs({
          ...remembered,
          lastPlayerIds: remembered.lastPlayerIds.filter((p) => p !== id),
        })
      }
    },
    [snapshot.games, snapshot.prefs],
  )

  const saveGame = useCallback(async (game: Game) => {
    await backendRef.current?.putGame({ ...game, groupKey: groupKeyFor(game.playerIds) })
  }, [])

  const deleteGame = useCallback(async (id: string) => {
    await backendRef.current?.removeGame(id)
  }, [])

  const saveSetup = useCallback(async (next: Prefs) => {
    await backendRef.current?.putPrefs(next)
  }, [])

  const players = useMemo(
    () => [...snapshot.players].sort((a, b) => a.name.localeCompare(b.name)),
    [snapshot.players],
  )
  const games = useMemo(
    () => [...snapshot.games].sort((a, b) => b.playedAt - a.playedAt),
    [snapshot.games],
  )

  const value: Store = {
    ready,
    authStatus,
    user,
    cloudEnabled: firebaseConfigured,
    authError,
    signIn,
    signOutToSandbox,
    accounts,
    sharedFrom,
    shareWith,
    stopSharing,
    players,
    games,
    prefs: snapshot.prefs,
    addPlayer,
    renamePlayer,
    deletePlayer,
    gamesForPlayer,
    saveGame,
    deleteGame,
    saveSetup,
    draft,
    setDraft,
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>')
  return ctx
}

export { newId }
