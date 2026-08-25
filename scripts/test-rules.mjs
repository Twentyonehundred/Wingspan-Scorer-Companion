// Exercises firestore.rules against every case that matters, especially the
// sharing ones — access control is the whole of the privacy story here and it
// is not visible from the app.
//
// Run with `npm run test:rules` after `npx firebase-tools login`.
//
// This uses the hosted Security Rules test API rather than the local emulator,
// which needs a Java runtime. It sends the rules *file on disk*, so it also
// tells you whether an unreleased edit is safe before you deploy it.
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const B = '/databases/(default)/documents'
const TIME = '2026-01-01T00:00:00Z'

const OWNER = 'owner-uid' // stands in for the address pinned in the rules
const OWNER_EMAIL = 'casukmail@gmail.com'
const GUEST = 'guest-uid'

/* -- credentials ----------------------------------------------------------- */

// The CLI's OAuth client is public (firebase-tools is open source); the refresh
// token in its config is the secret, and it never leaves this machine.
const CLI_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'
const CLI_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi'

async function accessToken() {
  const path = join(homedir(), '.config', 'configstore', 'firebase-tools.json')
  let refresh
  try {
    refresh = JSON.parse(await readFile(path, 'utf8')).tokens?.refresh_token
  } catch {
    throw new Error('No Firebase CLI credentials. Run `npx firebase-tools login` first.')
  }
  if (!refresh) throw new Error('No refresh token in the Firebase CLI config. Log in again.')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLI_ID,
      client_secret: CLI_SECRET,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`)
  return (await res.json()).access_token
}

/* -- fixtures -------------------------------------------------------------- */

const auth = (uid, email, verified = true) => ({
  uid,
  token: email ? { email, email_verified: verified } : {},
})

const ownerAuth = auth(OWNER, OWNER_EMAIL)
const guestAuth = auth(GUEST, 'guest@gmail.com')

/** An account row as the registry stores it. */
const account = (uid, { sharedWith = [], workspaceId = uid, name = 'A Person' } = {}) => ({
  __name__: `${B}/users/${uid}`,
  uid,
  name,
  email: 'a@person.test',
  photoURL: null,
  lastSeenAt: 1,
  sharedWith,
  workspaceId,
})

/** Stand in for the `get()` the subtree rule makes on the host's account row. */
const hostRow = (uid, { sharedWith, missing = false } = {}) => [
  {
    function: 'get',
    args: [{ exactValue: `${B}/users/${uid}` }],
    result: missing ? { undefined: {} } : { value: { data: account(uid, { sharedWith }) } },
  },
]

const cases = []

/**
 * `resource` is the document as it already exists; `to` is the one being
 * written. A `list` is expressed against a document path, the same way the
 * rules engine evaluates it.
 */
function check(label, expectation, { method, path, as, resource, to, mocks }) {
  const request = { auth: as, method, path, time: TIME }
  if (to !== undefined) request.resource = { data: to }
  const testCase = { expectation, pathEncoding: 'PLAIN', request }
  if (resource !== undefined) testCase.resource = { data: resource }
  if (mocks) testCase.functionMocks = mocks
  cases.push({ label, testCase })
}

const allow = (label, req) => check(label, 'ALLOW', req)
const deny = (label, req) => check(label, 'DENY', req)

/* Who can see the registry. Reading it is the app owner's privilege, and the
   app uses being refused as its test for who the owner is. */
allow('owner lists accounts', { method: 'list', path: `${B}/users/x`, as: ownerAuth })
deny('another signed-in account lists accounts', {
  method: 'list',
  path: `${B}/users/x`,
  as: auth('someone', 'someone@gmail.com'),
})
deny('the owner address, unverified, lists accounts', {
  method: 'list',
  path: `${B}/users/x`,
  as: auth('impostor', OWNER_EMAIL, false),
})
deny('an anonymous visitor lists accounts', {
  method: 'list',
  path: `${B}/users/x`,
  as: auth('anon'),
})
allow('owner reads one account row', {
  method: 'get',
  path: `${B}/users/${GUEST}`,
  as: ownerAuth,
  resource: account(GUEST),
})
deny('a stranger reads an unrelated account row', {
  method: 'get',
  path: `${B}/users/${GUEST}`,
  as: auth('nosy', 'nosy@gmail.com'),
  resource: account(GUEST),
})
allow('a guest reads the row of whoever shared with them', {
  method: 'get',
  path: `${B}/users/${OWNER}`,
  as: guestAuth,
  resource: account(OWNER, { sharedWith: [GUEST] }),
})

/* Pointing an account at a workspace. The owner may move that one field and
   nothing else — not a name, not who someone else shares with. */
allow('owner points a guest at a workspace', {
  method: 'update',
  path: `${B}/users/${GUEST}`,
  as: ownerAuth,
  resource: account(GUEST),
  to: account(GUEST, { workspaceId: OWNER }),
})
deny('owner also rewrites the guest sharing list', {
  method: 'update',
  path: `${B}/users/${GUEST}`,
  as: ownerAuth,
  resource: account(GUEST),
  to: account(GUEST, { workspaceId: OWNER, sharedWith: ['someone'] }),
})
deny('owner also renames the guest', {
  method: 'update',
  path: `${B}/users/${GUEST}`,
  as: ownerAuth,
  resource: account(GUEST),
  to: account(GUEST, { workspaceId: OWNER, name: 'Renamed' }),
})
deny('a non-owner points a guest at their own workspace', {
  method: 'update',
  path: `${B}/users/${GUEST}`,
  as: auth('someone', 'someone@gmail.com'),
  resource: account(GUEST),
  to: account(GUEST, { workspaceId: 'someone' }),
})
allow('a guest takes themselves back out of a shared workspace', {
  method: 'update',
  path: `${B}/users/${GUEST}`,
  as: guestAuth,
  resource: account(GUEST, { workspaceId: OWNER }),
  to: account(GUEST),
})

/* The games themselves. */
allow('owner reads their own games', {
  method: 'get',
  path: `${B}/users/${OWNER}/games/g1`,
  as: ownerAuth,
})
deny('owner reads games nobody shared with them', {
  method: 'get',
  path: `${B}/users/${GUEST}/games/g1`,
  as: ownerAuth,
  mocks: hostRow(GUEST),
})
allow('a guest reads shared games', {
  method: 'get',
  path: `${B}/users/${OWNER}/games/g1`,
  as: guestAuth,
  mocks: hostRow(OWNER, { sharedWith: [GUEST] }),
})
allow('a guest scores into the shared pile', {
  method: 'create',
  path: `${B}/users/${OWNER}/games/g9`,
  as: guestAuth,
  to: { playedAt: 1 },
  mocks: hostRow(OWNER, { sharedWith: [GUEST] }),
})
allow('a guest deletes from the shared pile', {
  method: 'delete',
  path: `${B}/users/${OWNER}/games/g9`,
  as: guestAuth,
  mocks: hostRow(OWNER, { sharedWith: [GUEST] }),
})
allow('a guest reads the shared setup prefs', {
  method: 'get',
  path: `${B}/users/${OWNER}/prefs/setup`,
  as: guestAuth,
  mocks: hostRow(OWNER, { sharedWith: [GUEST] }),
})
deny('a guest reads shared games after being removed', {
  method: 'get',
  path: `${B}/users/${OWNER}/games/g1`,
  as: guestAuth,
  mocks: hostRow(OWNER, { sharedWith: ['someone-else'] }),
})
deny('a guest reads games whose host row has gone', {
  method: 'get',
  path: `${B}/users/${OWNER}/games/g1`,
  as: guestAuth,
  mocks: hostRow(OWNER, { missing: true }),
})
deny('an anonymous visitor reads the owner games', {
  method: 'get',
  path: `${B}/users/${OWNER}/games/g1`,
  as: auth('anon'),
  mocks: hostRow(OWNER),
})
allow('an anonymous visitor uses their own sandbox', {
  method: 'get',
  path: `${B}/users/anon/games/g1`,
  as: auth('anon'),
})

/* -- run ------------------------------------------------------------------- */

const project = JSON.parse(await readFile(join(ROOT, '.firebaserc'), 'utf8')).projects.default
const source = await readFile(join(ROOT, 'firestore.rules'), 'utf8')
const token = await accessToken()

const res = await fetch(`https://firebaserules.googleapis.com/v1/projects/${project}:test`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    source: { files: [{ name: 'firestore.rules', content: source }] },
    testSuite: { testCases: cases.map((c) => c.testCase) },
  }),
})
if (!res.ok) {
  console.error(`Test API failed: ${res.status}\n${await res.text()}`)
  process.exit(1)
}
const body = await res.json()

if (body.issues?.length) {
  console.error('firestore.rules did not compile:')
  for (const issue of body.issues) {
    console.error(`  ${issue.sourcePosition?.line}: ${issue.description}`)
  }
  process.exit(1)
}

let failed = 0
for (const [i, { label, testCase }] of cases.entries()) {
  const ok = body.testResults?.[i]?.state === 'SUCCESS'
  if (!ok) failed += 1
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${testCase.expectation.padEnd(5)} ${label}`)
}
console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed ? 1 : 0)
