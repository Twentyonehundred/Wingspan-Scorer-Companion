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
anyone else's games. The web config in `.env` is not a secret; Firebase web
configs are public by design and the rules are the access control.

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
  components/           ScorePad, GameSummary, charts, primitives
  screens/              Play (setup → pad → result), History, Stats, Settings
scripts/gen-icons.mjs   regenerates the icon set from inline SVG
```
