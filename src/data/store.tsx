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
import type { Draft, Game, Player } from '../types'

/* -------------------------------------------------------------------------- */
/* Backends                                                                    */
/* -------------------------------------------------------------------------- */

interface Snapshot {
  players: Player[]
  games: Game[]
}

interface Backend {
  subscribe(onData: (s: Snapshot) => void): Unsubscribe
  putPlayer(player: Player): Promise<void>
  putGame(game: Game): Promise<void>
  removePlayer(id: string): Promise<void>
  removeGame(id: string): Promise<void>
}

const LOCAL_KEY = 'ws.local'

function readLocal(): Snapshot {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return { players: [], games: [] }
    const parsed = JSON.parse(raw) as Partial<Snapshot>
    return { players: parsed.players ?? [], games: parsed.games ?? [] }
  } catch {
    return { players: [], games: [] }
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

  return {
    subscribe(onData) {
      let players: Player[] = []
      let games: Game[] = []
      const push = () => onData({ players, games })

      const offPlayers = onSnapshot(playersRef, (snap) => {
        players = snap.docs.map((d) => ({ ...(d.data() as Omit<Player, 'id'>), id: d.id }))
        push()
      })
      const offGames = onSnapshot(gamesRef, (snap) => {
        games = snap.docs.map((d) => ({ ...(d.data() as Omit<Game, 'id'>), id: d.id }))
        push()
      })
      return () => {
        offPlayers()
        offGames()
      }
    },
    async putPlayer(player) {
      const { id, ...rest } = player
      await setDoc(doc(playersRef, id), rest)
    },
    async putGame(game) {
      const { id, ...rest } = game
      // Firestore rejects `undefined`; a missing tiebreak is stored as null.
      await setDoc(doc(gamesRef, id), { ...rest, winnerId: rest.winnerId ?? null })
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

  players: Player[]
  games: Game[]

  addPlayer: (name: string) => Promise<Player>
  renamePlayer: (id: string, name: string) => Promise<void>
  deletePlayer: (id: string) => Promise<void>
  saveGame: (game: Game) => Promise<void>
  deleteGame: (id: string) => Promise<void>

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
  const [snapshot, setSnapshot] = useState<Snapshot>({ players: [], games: [] })
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

  /* Data: rebuild the backend whenever the signed-in user changes. */
  useEffect(() => {
    const backend =
      auth && user ? firestoreBackend(user.uid) : firebaseConfigured ? null : localBackend()
    backendRef.current = backend
    if (!backend) return

    const off = backend.subscribe((s) => {
      setSnapshot(s)
      setReady(true)
    })
    return off
  }, [user])

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
    setSnapshot({ players: [], games: [] })
    await fbSignOut(auth)
    await signInAnonymously(auth)
  }, [])

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

  const deletePlayer = useCallback(async (id: string) => {
    await backendRef.current?.removePlayer(id)
  }, [])

  const saveGame = useCallback(async (game: Game) => {
    await backendRef.current?.putGame({ ...game, groupKey: groupKeyFor(game.playerIds) })
  }, [])

  const deleteGame = useCallback(async (id: string) => {
    await backendRef.current?.removeGame(id)
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
    players,
    games,
    addPlayer,
    renamePlayer,
    deletePlayer,
    saveGame,
    deleteGame,
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
