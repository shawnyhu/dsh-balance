/* Standalone smoke test for dsh-balance lib/index.js:
 * - mounts apply() with a mock cordis ctx + mock webServer
 * - captures the registered route
 * - resolves the REAL key from the profile .credentials.yaml
 * - invokes the handler against the REAL DeepSeek /user/balance endpoint
 * Never prints the key.
 */
import { readFileSync } from 'node:fs'
import { apply } from '../lib/index.js'

function readCredentialsYaml(file) {
  const text = readFileSync(file, 'utf8')
  const out = {}
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/)
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
  return out
}

const creds = readCredentialsYaml(process.env.DSH_HOME + '/.credentials.yaml')
const fakeCredentials = {
  resolve: async (ref) => (ref in creds ? { value: creds[ref] } : undefined),
}

let route
const fakeWebServer = {
  register: (r) => { route = r; return () => { route = undefined } },
}
const ctx = {
  inject: (services, cb) => { if (services.includes('webServer')) cb({ webServer: fakeWebServer, effect: (fn, label) => { const d = fn(); return typeof d === 'function' ? d : () => {} } }) },
  get: (name) => (name === 'credentials' ? fakeCredentials : undefined),
}

apply(ctx)
if (!route) { console.error('FAIL: no route registered'); process.exit(1) }
console.log('route registered:', route.kind, route.path)

const res = {
  headers: {},
  writeHead(status, headers) { this.status = status; this.headers = headers },
  end(body) { this.body = body },
}

await route.handler({
  method: 'GET',
  socket: { remoteAddress: '127.0.0.1' },
  headers: { host: '127.0.0.1:3340', origin: 'http://127.0.0.1:3340' },
}, res)

console.log('status:', res.status)
console.log('content-type:', res.headers['content-type'])
const payload = JSON.parse(res.body)
if (payload.ok) {
  console.log('ok: isAvailable=%s currency=%s total=%s granted=%s toppedUp=%s',
    payload.isAvailable, payload.currency, payload.totalBalance, payload.grantedBalance, payload.toppedUpBalance)
  console.log('infos:', JSON.stringify(payload.infos))
} else {
  console.log('not ok:', JSON.stringify(payload))
  process.exitCode = 1
}
