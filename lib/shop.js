// SkinVault by Chi — shared backend helpers
const crypto = require("crypto");

// ---- Delivery (placeholder rates: confirm with your courier, then edit) ----
const DELIVERY = {
  lagos: { label: "Lagos", fee: 3500 },
  nationwide: { label: "Outside Lagos (nationwide)", fee: 6000 },
};
const FREE_DELIVERY_OVER = 150000; // ₦ — set to 0 to disable free delivery

function deliveryFee(zone, subtotal) {
  const z = DELIVERY[zone] || DELIVERY.nationwide;
  if (FREE_DELIVERY_OVER > 0 && subtotal >= FREE_DELIVERY_OVER) return { zone: z.label, fee: 0, free: true };
  return { zone: z.label, fee: z.fee, free: false };
}

// ---- Paystack ----
const PAYSTACK_BASE = "https://api.paystack.co";

function paystackKey() {
  const k = process.env.PAYSTACK_SECRET_KEY;
  if (!k) throw new Error("PAYSTACK_SECRET_KEY is not set. Add it in Vercel → Project → Settings → Environment Variables.");
  return k;
}

async function paystack(pathname, options = {}) {
  const res = await fetch(PAYSTACK_BASE + pathname, {
    ...options,
    headers: {
      Authorization: `Bearer ${paystackKey()}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status === false) {
    throw new Error(`Paystack error (${res.status}): ${data.message || "unknown"}`);
  }
  return data;
}

function verifyPaystackSignature(rawBody, signature) {
  const hash = crypto.createHmac("sha512", paystackKey()).update(rawBody).digest("hex");
  return !!signature && crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
}

// ---- Optional storage (Upstash Redis REST — free tier) ----
// Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN to enable email lists
// and an order log. Everything payment-critical works WITHOUT this.
function storeConfigured() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function storeCmd(cmd) {
  const res = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cmd),
  });
  if (!res.ok) throw new Error(`Store error ${res.status}`);
  return res.json();
}

// ---- HTTP helpers (Vercel Node functions) ----
function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

async function readBody(req, maxBytes) {
  const cap = maxBytes || 24 * 1024;
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > cap) throw new Error("PAYLOAD_TOO_LARGE");
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

function isEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length < 200;
}

module.exports = { DELIVERY, FREE_DELIVERY_OVER, deliveryFee, paystack, verifyPaystackSignature, storeConfigured, storeCmd, send, readBody, isEmail };
