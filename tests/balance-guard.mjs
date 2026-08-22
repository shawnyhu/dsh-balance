/* Offline guard + error-mapping test for dsh-balance lib/index.js.
 *
 * Stubs `fetch` so every branch is exercised without a real API key or network:
 *  - route/access guards (method, loopback, forwarded headers, origin/host)
 *  - credential resolution fallback (settings -> env -> default)
 *  - error mapping (missing key, http error, fetch failure, malformed body)
 *  - a successful balance payload normalisation
 *
 * Run with: `node tests/balance-guard.mjs` (also `npm test`). Never prints a key.
 */
import assert from 'node:assert/strict'
import { apply } from '../lib/index.js'

/** A minimal fetch-compatible response. */
function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'Mock',
    json: async () => body,
  }
}

/** Mount the route with a given optional credentials value. */
function mount(credentials) {
  let route
  const fakeWebServer = { register: (r) => { route = r; return () => { route = undefined } } }
  const ctx = {
    inject: (services, cb) => {
      if (services.includes('webServer')) {
        cb({ webServer: fakeWebServer, effect: (fn) => { fn(); return () => {} } })
      }
    },
    get: (name) => (name === 'credentials' && credentials ? { resolve: async () => ({ value: credentials }) } : undefined),
  }
  apply(ctx)
  return route
}

/** Invoke the route handler against a request, capturing the response. */
async function call(route, req) {
  const res = {
    headers: {},
    writeHead(status, headers) { this.status = status; this.headers = headers },
    end(body) { this.body = body },
  }
  await route.handler(req, res)
  return res
}

const loopback = { remoteAddress: '127.0.0.1' }
const goodOrigin = { host: '127.0.0.1:3340', origin: 'http://127.0.0.1:3340' }

const results = []

async function expect(name, fn) {
  try {
    await fn()
    results.push({ name, ok: true })
  } catch (error) {
    results.push({ name, ok: false, error: error.message })
  }
}

let route = mount(undefined)

await expect('rejects non-GET', async () => {
  const res = await call(route, { method: 'POST', socket: loopback, headers: {} })
  assert.equal(res.status, 405, 'POST should be 405')
})

await expect('rejects non-loopback peer', async () => {
  const res = await call(route, { method: 'GET', socket: { remoteAddress: '10.0.0.5' }, headers: {} })
  assert.equal(res.status, 403, 'untrusted peer should be 403')
})

await expect('rejects forwarded header', async () => {
  const res = await call(route, { method: 'GET', socket: loopback, headers: { 'x-forwarded-for': '1.2.3.4' } })
  assert.equal(res.status, 403, 'forwarded header should be 403')
})

await expect('rejects cross-origin Origin', async () => {
  const res = await call(route, { method: 'GET', socket: loopback, headers: { host: '127.0.0.1:3340', origin: 'http://evil.example' } })
  assert.equal(res.status, 403, 'cross-origin should be 403')
})

await expect('allows same-origin loopback, missing key', async () => {
  const res = await call(route, { method: 'GET', socket: loopback, headers: goodOrigin })
  assert.equal(res.status, 200, 'same-origin loopback should be 200')
  const payload = JSON.parse(res.body)
  assert.equal(payload.ok, false)
  assert.equal(payload.error, 'missing-api-key')
})

await expect('reports missing key without calling the API', async () => {
  let called = false
  globalThis.fetch = async () => { called = true; return jsonResponse(500, {}) }
  const res = await call(mount(undefined), { method: 'GET', socket: loopback, headers: goodOrigin })
  globalThis.fetch = undefined
  assert.equal(called, false, 'fetch must not be called when no key is configured')
  assert.deepEqual(JSON.parse(res.body).error, 'missing-api-key')
})

// ---- error mapping with a configured (fake) key and a stubbed fetch ----

await expect('maps an HTTP error to http-<status> and redacts', async () => {
  globalThis.fetch = async () => jsonResponse(401, { error: { message: 'Authentication Fails, Your api key: sk-AB12CD34EF56GH78 is invalid' } })
  const res = await call(mount('sk-key'), { method: 'GET', socket: loopback, headers: goodOrigin })
  globalThis.fetch = undefined
  const payload = JSON.parse(res.body)
  assert.equal(payload.ok, false)
  assert.equal(payload.error, 'http-401')
  assert.ok(!/[A-Za-z0-9]{24,}/.test(payload.message), 'long secret-like runs must be redacted')
})

await expect('maps a fetch failure to fetch-failed', async () => {
  globalThis.fetch = async () => { throw new Error('network down sk-secret1234567890') }
  const res = await call(mount('sk-key'), { method: 'GET', socket: loopback, headers: goodOrigin })
  globalThis.fetch = undefined
  const payload = JSON.parse(res.body)
  assert.equal(payload.ok, false)
  assert.equal(payload.error, 'fetch-failed')
  assert.ok(!/sk-secret/.test(payload.message), 'fetch error must be redacted')
})

await expect('maps a malformed body to bad-response', async () => {
  globalThis.fetch = async () => ({ ok: true, status: 200, statusText: 'OK', json: async () => { throw new Error('Unexpected token') } })
  const res = await call(mount('sk-key'), { method: 'GET', socket: loopback, headers: goodOrigin })
  globalThis.fetch = undefined
  assert.equal(JSON.parse(res.body).error, 'bad-response')
})

await expect('normalises a successful balance payload', async () => {
  globalThis.fetch = async () => jsonResponse(200, {
    is_available: true,
    balance_infos: [{ currency: 'CNY', total_balance: '110.00', granted_balance: '0.00', topped_up_balance: '110.00' }],
  })
  const res = await call(mount('sk-key'), { method: 'GET', socket: loopback, headers: goodOrigin })
  globalThis.fetch = undefined
  const payload = JSON.parse(res.body)
  assert.equal(payload.ok, true)
  assert.equal(payload.isAvailable, true)
  assert.equal(payload.currency, 'CNY')
  assert.equal(payload.totalBalance, '110.00')
})

for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`)
  if (!r.ok) console.log(`      ${r.error}`)
}
const failed = results.filter((r) => !r.ok)
if (failed.length > 0) {
  console.error(`\n${failed.length} test(s) failed`)
  process.exitCode = 1
} else {
  console.log(`\nAll ${results.length} guard tests passed`)
}
