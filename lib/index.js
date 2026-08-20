/**
 * dsh-balance host half: exposes one loopback-only HTTP route
 * (`GET /dsh-balance`) that resolves the DeepSeek API key the same way
 * `llm-deepseek` does (the `llm-deepseek` settings section, falling back to
 * the `DEEPSEEK_API_KEY` environment reference / process env) and queries
 * `GET {baseURL}/user/balance` on the user's behalf. The browser client half
 * never sees the API key — it only reads this route.
 *
 * No runtime dependencies: the plugin acquires `webServer` (and optionally
 * `credentials` / `settings`) through the cordis context.
 */

export const name = 'dsh-balance'

const ROUTE_PATH = '/dsh-balance'
const DEFAULT_API_KEY_ENV = 'DEEPSEEK_API_KEY'
const PUBLIC_BASE_URL = 'https://api.deepseek.com'
const BASE_URL_ENV = 'DEEPSEEK_BASE_URL'
const FETCH_TIMEOUT_MS = 15_000

const REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

/** Strip anything that could echo a secret (provider errors never do, defensively). */
function redact(text) {
  return String(text)
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***')
    .replace(/\b[A-Fa-f0-9]{32,}\b/g, '***')
}

/**
 * Loopback-only + same-origin-ish guard, mirroring dshmarket's
 * `isTrustedRequest`: loopback peer, no forwarded headers; a present Origin
 * must match Host (plain GET navigations omit Origin and pass).
 */
function trustedRequest(req) {
  const addr = req.socket?.remoteAddress
  if (typeof addr !== 'string' || !LOOPBACK.has(addr)) return false
  const fwd = req.headers.forwarded ?? req.headers['x-forwarded-for'] ?? req.headers['x-real-ip'] ?? req.headers['x-forwarded-host']
  if (fwd !== undefined) return false
  const origin = req.headers.origin
  if (typeof origin !== 'string' || origin.length === 0) return true
  const host = req.headers.host
  if (typeof host !== 'string' || host.length === 0) return false
  try {
    const parsed = new URL(origin)
    return parsed.protocol === 'http:' && parsed.host === host && LOOPBACK.has(parsed.hostname)
  } catch {
    return false
  }
}

/**
 * Connection facts, resolved per request so a changed Models-page setting or
 * credential reaches the next refresh without a restart. Prefers the
 * `llm-deepseek` settings section (the exact base URL / key env the model
 * provider uses), then the `DEEPSEEK_BASE_URL` env override, then defaults.
 */
function resolveConnection(ctx) {
  let apiKeyEnv = DEFAULT_API_KEY_ENV
  let baseURL = process.env[BASE_URL_ENV]?.trim() || PUBLIC_BASE_URL
  try {
    const settings = ctx.get('settings')
    const deepseek = settings?.get?.('llm-deepseek')
    if (deepseek !== null && typeof deepseek === 'object') {
      if (typeof deepseek.apiKeyEnv === 'string' && REF_PATTERN.test(deepseek.apiKeyEnv)) {
        apiKeyEnv = deepseek.apiKeyEnv
      }
      if (typeof deepseek.baseURL === 'string' && deepseek.baseURL.length > 0) {
        baseURL = deepseek.baseURL
      }
    }
  } catch {
    // settings unavailable — keep defaults
  }
  return { apiKeyEnv, baseURL }
}

async function resolveApiKey(ctx, apiKeyEnv) {
  try {
    const credentials = ctx.get('credentials')
    if (credentials !== undefined && typeof credentials.resolve === 'function') {
      const hit = await credentials.resolve(apiKeyEnv)
      if (hit !== undefined && typeof hit.value === 'string' && hit.value.length > 0) {
        return hit.value
      }
    }
  } catch {
    // credentials unavailable or failed — fall through to env
  }
  const ambient = process.env[apiKeyEnv]
  if (typeof ambient === 'string' && ambient.length > 0) return ambient
  return undefined
}

async function fetchBalance(ctx) {
  const { apiKeyEnv, baseURL } = resolveConnection(ctx)
  const key = await resolveApiKey(ctx, apiKeyEnv)
  if (key === undefined) {
    return {
      ok: false,
      error: 'missing-api-key',
      message: `未配置 API Key：请先在「设置 → 模型」中配置 ${apiKeyEnv}（或设置环境变量 ${apiKeyEnv}）。`,
    }
  }
  let response
  try {
    response = await fetch(`${baseURL.replace(/\/+$/, '')}/user/balance`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${key}`,
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
  } catch (error) {
    return {
      ok: false,
      error: 'fetch-failed',
      message: redact(error instanceof Error ? error.message : String(error)),
    }
  }
  if (!response.ok) {
    let detail = ''
    try {
      const body = await response.json()
      detail = typeof body?.error?.message === 'string' ? body.error.message : JSON.stringify(body).slice(0, 300)
    } catch {
      detail = response.statusText
    }
    return {
      ok: false,
      error: `http-${response.status}`,
      message: redact(detail),
    }
  }
  let data
  try {
    data = await response.json()
  } catch (error) {
    return {
      ok: false,
      error: 'bad-response',
      message: redact(error instanceof Error ? error.message : String(error)),
    }
  }
  const infos = Array.isArray(data?.balance_infos) ? data.balance_infos : []
  const primary = infos[0]
  return {
    ok: true,
    isAvailable: data?.is_available === true,
    currency: typeof primary?.currency === 'string' ? primary.currency : null,
    totalBalance: typeof primary?.total_balance === 'string' ? primary.total_balance : null,
    grantedBalance: typeof primary?.granted_balance === 'string' ? primary.granted_balance : null,
    toppedUpBalance: typeof primary?.topped_up_balance === 'string' ? primary.topped_up_balance : null,
    infos,
    fetchedAt: new Date().toISOString(),
  }
}

export function apply(ctx) {
  ctx.inject(['webServer'], (hostCtx) => {
    hostCtx.effect(() => hostCtx.webServer.register({
      kind: 'exact',
      path: ROUTE_PATH,
      handler: async (req, res) => {
        if (req.method !== 'GET') {
          res.writeHead(405, { allow: 'GET' })
          res.end()
          return
        }
        if (!trustedRequest(req)) {
          sendJson(res, 403, { ok: false, error: 'forbidden', message: 'balance is limited to same-origin loopback requests' })
          return
        }
        try {
          sendJson(res, 200, await fetchBalance(ctx))
        } catch (error) {
          sendJson(res, 500, {
            ok: false,
            error: 'internal',
            message: redact(error instanceof Error ? error.message : String(error)),
          })
        }
      },
    }), 'dsh-balance: balance route')
  })
}
