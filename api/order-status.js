// GET /api/order-status?ref=SV-...
// Verifies the transaction directly with Paystack (source of truth).
// Security: rate limited, reference format-checked, safe fields only.
const { paystack, send } = require("../lib/shop");
const { applySecurityHeaders, enforceRate } = require("../lib/security");

module.exports = async (req, res) => {
  applySecurityHeaders(res);
  if (!(await enforceRate(req, res, "status", 30, 600))) return;
  const ref = (req.query && req.query.ref) || new URL(req.url, "http://x").searchParams.get("ref");
  if (!ref || !/^SV-[A-Z0-9-]{6,40}$/.test(ref)) return send(res, 400, { error: "Missing or invalid reference." });
  try {
    const v = await paystack("/transaction/verify/" + encodeURIComponent(ref));
    const d = v.data || {};
    const order = (d.metadata && d.metadata.order) || null;
    return send(res, 200, {
      reference: ref,
      status: d.status,
      paidAt: d.paid_at || null,
      amount: d.amount ? d.amount / 100 : null,
      channel: d.channel || null,
      order,
    });
  } catch (e) {
    return send(res, 502, { error: "Could not verify this order right now." });
  }
};
