// POST /api/checkout
// Body: { email, name, phone, address, city, zone, items:[{name,qty}], website(honeypot) }
// Security: origin check, rate limit, body-size cap, honeypot, input sanitisation.
// Server reprices every cart from products.json — client prices are never trusted.
const { priceCart } = require("../lib/catalog");
const { deliveryFee, paystack, send, readBody, isEmail } = require("../lib/shop");
const { checkOrigin, applySecurityHeaders, enforceRate, clean, isSpam, MAX_BODY } = require("../lib/security");

module.exports = async (req, res) => {
  applySecurityHeaders(res);
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });

  const origin = checkOrigin(req);
  if (!origin.ok) return send(res, 403, { error: "Request blocked (invalid origin)." });

  // Rate limit: 8 checkout attempts per IP per 10 minutes.
  if (!(await enforceRate(req, res, "checkout", 8, 600))) return;

  let raw;
  try {
    raw = await readBody(req, MAX_BODY);
  } catch (e) {
    return send(res, 413, { error: "Request too large." });
  }
  let body;
  try {
    body = JSON.parse(raw.toString("utf8") || "{}");
  } catch {
    return send(res, 400, { error: "Invalid JSON" });
  }

  // Honeypot — silently accept so bots don't learn, but do nothing real.
  if (isSpam(body)) return send(res, 200, { url: null, ignored: true });

  const email = clean(body.email, 200);
  const name = clean(body.name, 120);
  const phone = clean(body.phone, 32);
  const address = clean(body.address, 300);
  const city = clean(body.city, 80);
  const zone = body.zone === "lagos" ? "lagos" : "nationwide";

  if (!isEmail(email)) return send(res, 400, { error: "A valid email is required." });
  if (name.length < 2) return send(res, 400, { error: "Please tell us your name." });
  if (phone.replace(/\D/g, "").length < 7) return send(res, 400, { error: "A phone number is required for delivery." });
  if (address.length < 5) return send(res, 400, { error: "A delivery address is required." });

  const cart = priceCart(body.items);
  if (!cart.ok) return send(res, 400, { error: cart.problems.join(" ") || "Cart could not be validated." });

  const del = deliveryFee(zone, cart.subtotal);
  const total = cart.subtotal + del.fee;
  const reference = "SV-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 7).toUpperCase();

  const site = (req.headers["x-forwarded-proto"] || "https").split(",")[0] + "://" + req.headers.host;
  try {
    const init = await paystack("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email,
        amount: total * 100, // kobo
        currency: "NGN",
        reference,
        callback_url: `${site}/order-confirmed.html?ref=${reference}`,
        metadata: {
          order: {
            customer: { name, phone, address, city, zone: del.zone },
            items: cart.items.map((i) => ({ n: i.name, q: i.qty, u: i.unit })),
            subtotal: cart.subtotal,
            delivery: del.fee,
            total,
          },
          custom_fields: [
            { display_name: "Order", variable_name: "order_summary", value: cart.items.map((i) => i.qty + "× " + i.name).join("; ").slice(0, 900) },
          ],
        },
      }),
    });
    return send(res, 200, { url: init.data.authorization_url, reference, total, delivery: del.fee, subtotal: cart.subtotal });
  } catch (e) {
    return send(res, 502, { error: "Could not start payment — please try again." });
  }
};
