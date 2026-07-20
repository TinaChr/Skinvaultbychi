// POST /api/notify   Body: { email, list: "bfw"|"journal", website(honeypot) }
// Security: origin check, rate limit, honeypot, body cap.
const { storeConfigured, storeCmd, send, readBody, isEmail } = require("../lib/shop");
const { checkOrigin, applySecurityHeaders, enforceRate, isSpam, MAX_BODY } = require("../lib/security");

module.exports = async (req, res) => {
  applySecurityHeaders(res);
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });

  const origin = checkOrigin(req);
  if (!origin.ok) return send(res, 403, { error: "Request blocked (invalid origin)." });

  // Rate limit: 5 signups per IP per 10 minutes.
  if (!(await enforceRate(req, res, "notify", 5, 600))) return;

  let raw;
  try { raw = await readBody(req, MAX_BODY); } catch { return send(res, 413, { error: "Request too large." }); }
  let body;
  try { body = JSON.parse(raw.toString("utf8") || "{}"); } catch { return send(res, 400, { error: "Invalid JSON" }); }

  if (isSpam(body)) return send(res, 200, { saved: true }); // silently ignore bots

  const list = body.list === "journal" ? "journal" : "bfw";
  if (!isEmail(body.email)) return send(res, 400, { error: "Please enter a valid email address." });
  if (!storeConfigured()) {
    return send(res, 200, { saved: false, message: "List storage isn't configured yet — message us on WhatsApp and we'll add you by hand." });
  }
  try {
    await storeCmd(["SADD", "list:" + list, body.email.toLowerCase()]);
    return send(res, 200, { saved: true, message: "You're on the list — one email, the day it goes live." });
  } catch (e) {
    return send(res, 502, { error: "Could not save right now — please try again." });
  }
};
