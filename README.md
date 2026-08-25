# Wingspan Scores

A replacement for the paper score pad, plus the history and stats the pad can't
give you. Mobile-first, installable, works offline at the table.

```
npm install
npm run dev
```

It runs with no configuration — without a Firebase project it just keeps
everything in the browser. Add the config below to sync across devices.

## How it models the game

Expansions in Wingspan are additive: European, Oceania and Asia birds all
shuffle into one deck, and only two of them change the score pad. So rather
than picking one printed pad, a new game starts on the base six categories and
you switch on whatever applies:

| | Categories |
|---|---|
| Base (always on) | Birds · Bonus cards · Round goals · Eggs · Food · Tucked |
| Nectar — Oceania | + Nectar (habitat majorities) |
| Duet map — Asia | + Duet map, 2 players only |

That way a game using two expansions at once is still one score pad. The duet
map is a single number you type in; the app doesn't model the map itself.

**Entering scores.** Every cell is − / box / +: type a number, or tap, since
most categories are counted in ones and tapping beats the keyboard for those.
Arrow keys do the same thing for anyone on a laptop. The steppers cost width,
so a phone scrolls the pad sideways from three players up, with the category
column pinned.

**Who went first.** Turn order matters and the printed pad has nowhere to put
it, so the pad carries a first-player token: tap the dashed ① under a name and
that player takes it, swapping into the leftmost column so the pad reads left to
right in turn order. It's a swap rather than a rotation — everyone else is
sitting where they were sitting. History shows the token in the game listing and
on the game itself, which is the point: you can check who started last time
before setting up the next one. Games saved before this existed show no token
rather than a guess.

**Sharing a history.** Two people in the same house are keeping one set of
records, not two, so sharing points the second account at the first one's games
rather than copying them. Both then read and write the same pile: whoever scores
the evening, it's there for both of them, with nothing to sync up afterwards and
no chance of the two copies disagreeing. Turning it off leaves the shared games
where they are and hands the guest back their own, untouched — see
[Sharing and admin](#sharing-and-admin).

**Version.** The footer shows the version and when that copy was built (`dev`
under the dev server). An installed PWA serving a service-worker-cached build
is otherwise indistinguishable from a fresh one.

**Ties.** Wingspan breaks a tie on most unused food tokens, which never reaches
the pad — so a tie stays a tie until you tap the winner, on the results screen
or later from History.

**Groups.** A group is just the exact set of players who sat down together.
Two-player history stays clean when someone joins for a night, with no groups
to create or manage. Groups are listed most-played first, so your usual pairing
is selected by default.

**Colours** are Wingspan's own — parchment and warm charcoal for the surfaces,
and eight habitat and food-token hues for the series. They're assigned per
player and stored, so the same person is the same colour in every chart, and
the same slot in light and dark. The categorical palette is validated for
colour-vision deficiency and contrast in both modes: worst adjacent pair ΔE
15.9 (light) and 16.5 (dark) against a target of 8, and every step clears 3:1
against the darkest surface it can land on. Every bar still carries a visible
value, so identity is never colour alone.

## Firebase setup

Sync is optional but it's the reason phone and laptop show the same history.

1. Create a project at <https://console.firebase.google.com>.
2. **Build → Authentication → Sign-in method**: enable **Anonymous** and
   **Google**. Anonymous is what lets the app open straight into a usable state
   with no login; Google is what makes the data yours and portable.
3. **Build → Firestore Database**: create a database (production mode).
4. **Project settings → Your apps → Web**: register an app, copy the config
   values into `.env` (see `.env.example`).
5. Publish the rules: `npx firebase-tools deploy --only firestore:rules`.

Signing in with Google from an anonymous session *links* the two, so games
entered before signing in are kept. The exception is signing into a Google
account that already has data — that account wins and the local sandbox is
dropped.

`firestore.rules` scopes every document to `users/{uid}`, so nobody can read
anyone else's games unless they've been shared with. The web config in `.env` is
not a secret; Firebase web configs are public by design and the rules are the
access control.

## Sharing and admin

Signing in with Google adds a row at `users/{uid}` holding just a name, email,
picture and last-seen date. Anonymous visitors don't get one — every visitor
gets an anonymous session on arrival, so including them would bury the handful
of real accounts under a pile of one-time sandboxes.

That row also carries **`workspaceId`**, the uid whose games this account
actually uses. It's your own until someone shares theirs with you, at which
point it points at them and their subtree becomes the one you read and write.
Sharing is a redirection, not a copy, which is why there is nothing to merge:

```
users/{host}/games   ← both people read and write here while shared
users/{host}         sharedWith: [guest]
users/{guest}        workspaceId: host      ← the redirection
users/{guest}/games  kept, just not shown until sharing stops
```

**Settings → People** lists the accounts and toggles sharing. It only appears
for the app owner, and that is enforced by the rules rather than the UI: the
client subscribes to the `users` collection and shows the section only if
Firestore allows the query. The owner is pinned in `firestore.rules` by verified
email, because minting a custom claim needs Cloud Functions and a billing plan
this project isn't on. **Change that address before deploying your own copy.**

Listing accounts does not grant access to their games — the owner sees who has
signed up and nothing more until a share is switched on.

```
npm run test:rules
```

exercises all of that — sharing, revoking, the owner-only paths and the
sandbox isolation — against the hosted rules test API, so it needs no Java
runtime and no emulator. It tests `firestore.rules` as it is on disk, so run it
before deploying an edit.

One consequence worth knowing: the remembered setup (last players, last
expansions) lives in the workspace too, so while sharing is on it follows the
shared games rather than each device.

## Deploying

```
npm run build      # → dist/, all paths relative
npm run deploy     # build + Firebase Hosting
```

The build uses relative paths, so `dist/` can be dropped at any sub-path of
another site (`/projects/wingspan/`) with no rebuild. Two things to know when
embedding it in the portfolio:

- It needs to be a real page, not an `<iframe>` — installing to the home screen
  and the service worker both need a top-level document.
- Visitors get an anonymous sandbox of their own, so the demo works without a
  login wall and without touching your data.

## Installing on your phone

Open the deployed URL in Chrome → ⋮ → **Add to Home screen**. Firestore's
offline persistence is on, so scoring works with no signal and syncs when it
comes back.

## Layout

```
src/
  types.ts              categories, modules, Player, Game
  firebase.ts           config; null when unconfigured
  lib/scoring.ts        which categories are in play, totals, standings, ties
  lib/stats.ts          groups, per-player averages, category edges
  data/store.tsx        auth + Firestore, with a localStorage fallback
  data/accounts.ts      the account registry and sharing
  components/           ScorePad, GameSummary, charts, primitives
  screens/              Play (setup → pad → result), History, Stats, Settings
scripts/gen-icons.mjs   regenerates the icon set from inline SVG
scripts/test-rules.mjs  security-rules tests (npm run test:rules)
```
