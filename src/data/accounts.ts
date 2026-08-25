import type { User } from 'firebase/auth'
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore'
import { db } from '../firebase'

/**
 * The registry of real accounts — one document per person who has signed in
 * with Google, at `users/{uid}`, sitting directly above that person's players
 * and games.
 *
 * It exists for two reasons. It gives the app owner a list of who has signed
 * up, with enough of a profile to tell them apart, and it records who has been
 * let into whose games. Anonymous visitors never get one: every visitor is
 * handed an anonymous session on arrival, so including them would bury the
 * handful of real people under a pile of one-time sandboxes.
 */
export interface Account {
  uid: string
  name: string | null
  email: string | null
  photoURL: string | null
  /** Last sign-in, so a stale row is recognisable as one. */
  lastSeenAt: number
  /** Accounts allowed to read and write this account's games. */
  sharedWith: string[]
  /**
   * Whose games this account actually uses — its own uid unless it has been
   * pointed at someone else's. Sharing is a redirection rather than a copy, so
   * both people read and write one pile of games and there is nothing to merge.
   */
  workspaceId: string
}

const DAY = 24 * 60 * 60 * 1000

function toAccount(uid: string, data: Record<string, unknown>): Account {
  return {
    uid,
    name: (data.name as string) ?? null,
    email: (data.email as string) ?? null,
    photoURL: (data.photoURL as string) ?? null,
    lastSeenAt: (data.lastSeenAt as number) ?? 0,
    sharedWith: (data.sharedWith as string[]) ?? [],
    workspaceId: (data.workspaceId as string) ?? uid,
  }
}

/**
 * Watch this account's own row, creating it on first sign-in. `null` means "no
 * row yet"; the caller treats the first call, whatever its value, as the signal
 * that the workspace is settled and the data can load.
 */
export function watchOwnAccount(user: User, onAccount: (a: Account | null) => void): Unsubscribe {
  const ref = doc(db!, 'users', user.uid)
  const profile = profileFor(user)

  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onAccount(null)
        // Offline, "missing" only means the cache hasn't seen it. Creating the
        // row on that would reset `sharedWith` and `workspaceId` and quietly
        // unshare a household, so first-sign-in setup waits for the server.
        if (snap.metadata.fromCache) return
        void setDoc(ref, {
          uid: user.uid,
          ...profile,
          lastSeenAt: Date.now(),
          sharedWith: [],
          workspaceId: user.uid,
        }).catch(() => {})
        return
      }
      const account = toAccount(snap.id, snap.data())
      onAccount(account)
      // Keep the profile current — a changed picture or display name should
      // show up in the owner's list — but only when it has actually changed, so
      // this isn't a write on every page load.
      if (
        !snap.metadata.fromCache &&
        (account.name !== profile.name ||
          account.email !== profile.email ||
          account.photoURL !== profile.photoURL ||
          Date.now() - account.lastSeenAt > DAY)
      ) {
        void setDoc(ref, { ...profile, lastSeenAt: Date.now() }, { merge: true }).catch(() => {})
      }
    },
    () => onAccount(null),
  )
}

/**
 * Watch every account. Only the app owner is allowed to, so this doubles as the
 * check for whether to show the admin section: `onAccounts(null)` means the
 * rules said no. Keeping the answer server-side means the owner's identity
 * lives in `firestore.rules` and nowhere else.
 */
export function watchAllAccounts(onAccounts: (a: Account[] | null) => void): Unsubscribe {
  return onSnapshot(
    collection(db!, 'users'),
    (snap) => onAccounts(snap.docs.map((d) => toAccount(d.id, d.data()))),
    () => onAccounts(null),
  )
}

/** Watch one other account, to name whoever's games you have been let into. */
export function watchAccount(uid: string, onAccount: (a: Account | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db!, 'users', uid),
    (snap) => onAccount(snap.exists() ? toAccount(snap.id, snap.data()) : null),
    () => onAccount(null),
  )
}

/**
 * Let `guestId` into `hostId`'s games, and point them at it so they see those
 * games rather than their own. Two writes, because the invitation and the
 * redirection live on different documents — if the second fails the guest keeps
 * their own history and simply doesn't see the shared one.
 */
export async function shareWith(hostId: string, guestId: string): Promise<void> {
  await updateDoc(doc(db!, 'users', hostId), { sharedWith: arrayUnion(guestId) })
  await updateDoc(doc(db!, 'users', guestId), { workspaceId: hostId })
}

/**
 * Undo that. Nothing is deleted: games entered while shared stay in the host's
 * pile, and the guest goes back to whatever was under their own uid.
 */
export async function stopSharing(hostId: string, guestId: string): Promise<void> {
  await updateDoc(doc(db!, 'users', guestId), { workspaceId: guestId })
  await updateDoc(doc(db!, 'users', hostId), { sharedWith: arrayRemove(guestId) })
}

export interface Profile {
  name: string | null
  photoURL: string | null
  email: string | null
}

/**
 * Linking Google to an anonymous session leaves the user's own displayName and
 * photoURL null — the provider keeps them. Read through to providerData so the
 * account shows a real name and picture either way.
 */
export function profileFor(user: User | null): Profile {
  if (!user) return { name: null, photoURL: null, email: null }
  const google = user.providerData.find((p) => p.providerId === 'google.com')
  const provider = google ?? user.providerData[0]
  return {
    name: user.displayName ?? provider?.displayName ?? null,
    photoURL: user.photoURL ?? provider?.photoURL ?? null,
    email: user.email ?? provider?.email ?? null,
  }
}
