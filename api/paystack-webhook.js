// POST /api/paystack-webhook  (set this URL in Paystack Dashboard → Settings → Webhooks)
// Security: verifies HMAC-SHA512 signature before trusting anything; body cap.
const { verifyPaystackSignature, storeConfigured, storeCmd, send, readBody } = require("../lib/shop");
const { applySecurityHeaders } = require("../lib/security");

module.exports = async (req, res) => {
  applySecurityHeaders(res);
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });

  let raw;
  try { raw = await readBody(req, 64 * 1024); } catch { return send(res, 413, { error: "Too large" }); }

  let okSig = false;
  try { okSig = verifyPaystackSignature(raw, req.headers["x-paystack-signature"]); } catch { okSig = false; }
  if (!okSig) return send(res, 401, { error: "Bad signature" });

  let event;
  try { event = JSON.parse(raw.toString("utf8")); } catch { return send(res, 400, { error: "Bad JSON" }); }

  if (event.event === "charge.success" && event.data && event.data.reference) {
    if (storeConfigured()) {
      const rec = {
        ref: event.data.reference,
        amount: (event.data.amount || 0) / 100,
        email: event.data.customer && event.data.customer.email,
        paidAt: event.data.paid_at,
        order: event.data.metadata && event.data.metadata.order,
      };
      try {
        await storeCmd(["LPUSH", "orders", JSON.stringify(rec)]);
        await storeCmd(["SET", "order:" + rec.ref, JSON.stringify(rec)]);
      } catch { /* best-effort; Paystack remains source of truth */ }
    }
  }
  return send(res, 200, { received: true });
};
