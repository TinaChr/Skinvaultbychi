// SkinVault by Chi — security helpers
// Rate limiting, origin/CORS enforcement, security headers, input sanitisation,
// and honeypot spam detection. Rate limiting uses Upstash if configured
// (durable across serverless invocations) and falls back to a best-effort
// in-memory limiter otherwise.
const { storeConfigured, storeCmd } = require("./shop");

// ---------- Allowed origins ----------
// Requests to write endpoints (checkout, notify) must come from your own site.
// Set ALLOWED_ORIGINS in Vercel to a comma-separated list to override, e.g.
// "https://skinvaultbychi.com,https://www.skinvaultbychi.com".
function allowedOrigins() {
  const env = process.env.ALLOWED_ORIGINS;
  if (env) return env.split(",").map((s) => s.trim()).filter(Boolean);
  return null; // null => allow same-host (derived per request) only
}

function requestHost(req) {
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0];
  return `${proto}://${req.headers.host}`;
}

// Returns { ok, origin }. Blocks cross-site POSTs (basic CSRF/abuse defence).
// Same-origin browser requests often omit Origin; those are allowed. A present
// Origin that doesn't match the allow-list (or the site's own host) is blocked.
function checkOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return { ok: true, origin: null }; // same-origin / non-CORS
  const allow = allowedOrigins();
  const self = requestHost(req);
  const list = allow || [self];
  // Also treat *.vercel.app preview of the same project as allowed if no explicit list.
  const ok = list.includes(origin) || (!allow && /\.vercel\.app$/.test(new URL(origin).host));
  return { ok, origin };
}

// ---------- Security headers ----------
function applySecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
}

// ---------- Client IP ----------
function clientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return String(xff).split(",")[0].trim();
  return (req.socket && req.socket.remoteAddress) || "unknown";
}

// ---------- Rate limiting ----------
const _mem = new Map(); // fallback only; per-instance

async function rateLimit(key, limit, windowSec) {
  const bucket = `rl:${key}`;
  if (storeConfigured()) {
    try {
      // INCR then set expiry on first hit — atomic enough for this purpose.
      const r = await storeCmd(["INCR", bucket]);
      const n = (r && r.result) || 1;
      if (n === 1) await storeCmd(["EXPIRE", bucket, String(windowSec)]);
      return { ok: n <= limit, remaining: Math.max(0, limit - n), count: n };
    } catch {
      // fall through to memory
    }
  }
  const now = Date.now();
  const rec = _mem.get(bucket);
  if (!rec || now > rec.reset) {
    _mem.set(bucket, { count: 1, reset: now + windowSec * 1000 });
    return { ok: true, remaining: limit - 1, count: 1 };
  }
  rec.count++;
  return { ok: rec.count <= limit, remaining: Math.max(0, limit - rec.count), count: rec.count };
}

// Convenience: enforce a limit and write a 429 if exceeded. Returns true if OK.
async function enforceRate(req, res, name, limit, windowSec) {
  const rl = await rateLimit(`${name}:${clientIp(req)}`, limit, windowSec);
  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(rl.remaining));
  if (!rl.ok) {
    res.setHeader("Retry-After", String(windowSec));
    res.statusCode = 429;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Too many requests — please wait a moment and try again." }));
    return false;
  }
  return true;
}

// ---------- Input sanitisation ----------
// Strips control chars, collapses whitespace, hard-caps length. For names,
// addresses, etc. — NOT for emails (validated separately).
function clean(v, max) {
  if (v == null) return "";
  return String(v).replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, max || 200);
}

// Honeypot: a hidden form field real users never fill. If present + non-empty,
// it's almost certainly a bot. Field name is intentionally tempting.
function isSpam(body) {
  return !!(body && typeof body.website === "string" && body.website.trim() !== "");
}

// Body-size guard for JSON endpoints (defends against oversized payloads).
const MAX_BODY = 24 * 1024; // 24 KB is plenty for a cart

module.exports = {
  checkOrigin, applySecurityHeaders, clientIp, rateLimit, enforceRate,
  clean, isSpam, MAX_BODY,
};
