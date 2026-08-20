import { apply } from '../lib/index.js'

function mount(credentials) {
  let route
  const fakeWebServer = { register: (r) => { route = r; return () => {} } }
  const ctx = {
    inject: (services, cb) => {
      if (services.includes('webServer')) {
        cb({ webServer: fakeWebServer, effect: (fn) => { const d = fn(); return typeof d === 'function' ? d : () => {} } })
      }
    },
    get: (name) => (name === 'credentials' && credentials ? { resolve: async () => ({ value: credentials }) } : undefined),
  }
  apply(ctx)
  return route
}

const call = async (route, req) => {
  const res = { writeHead(s, h) { this.status = s; this.headers = h }, end(b) { this.body = b } }
  await route.handler(req, res)
  return res
}

let route = mount(undefined)

let res = await call(route, { method: 'POST', socket: { remoteAddress: '127.0.0.1' }, headers: {} })
console.log('POST ->', res.status)

res = await call(route, { method: 'GET', socket: { remoteAddress: '10.0.0.5' }, headers: {} })
console.log('remote 10.0.0.5 ->', res.status, res.body.slice(0, 70))

res = await call(route, { method: 'GET', socket: { remoteAddress: '127.0.0.1' }, headers: { 'x-forwarded-for': '1.2.3.4' } })
console.log('x-forwarded-for ->', res.status, res.body.slice(0, 70))

res = await call(route, { method: 'GET', socket: { remoteAddress: '127.0.0.1' }, headers: { host: '127.0.0.1:3340', origin: 'http://evil.example' } })
console.log('evil origin ->', res.status, res.body.slice(0, 70))

res = await call(route, { method: 'GET', socket: { remoteAddress: '127.0.0.1' }, headers: { host: '127.0.0.1:3340', origin: 'http://127.0.0.1:3340' } })
console.log('loopback, no key ->', res.status, res.body.slice(0, 120))

route = mount('sk-invalid-key-for-guard-test')
res = await call(route, { method: 'GET', socket: { remoteAddress: '127.0.0.1' }, headers: { host: '127.0.0.1:3340', origin: 'http://127.0.0.1:3340' } })
console.log('loopback, bad key ->', res.status, res.body.slice(0, 160))
