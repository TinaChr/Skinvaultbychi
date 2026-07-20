// SkinVault by Chi — server-side catalogue (single source of pricing truth)
// products.json rows: [group, name, price, tier, ampm, benefit, isSupplement]
const fs = require("fs");
const path = require("path");

let _products = null;

function loadProducts() {
  if (_products) return _products;
  const raw = fs.readFileSync(path.join(process.cwd(), "products.json"), "utf8");
  _products = JSON.parse(raw);
  return _products;
}

// Bundles are priced as fixed SKUs (15% off separate total, rounded to ₦500 —
// pending Chi's final confirmation; update here to change site-wide).
const BUNDLES = {
  "bundle-glow-starter": {
    name: "Glow Starter Kit (Bundle)",
    price: 63000,
    items: [
      "CeraVe Acne Control Cleanser",
      "Jumiso All Day Vitamin C Serum",
      "La Roche-Posay Anthelios SPF 50+",
    ],
  },
  "bundle-clear-skin": {
    name: "Clear Skin System (Bundle)",
    price: 108000,
    items: [
      "CeraVe Acne Control Cleanser",
      "Ezanic Azelaic Acid 20% Cream",
      "The Ordinary Glycolic Acid 7% Toning Solution",
      "Seoul 1988 Cream Retinol",
      "La Roche-Posay Anthelios SPF 50+",
    ],
  },
  "bundle-age-defense": {
    name: "Age Defense System (Bundle)",
    price: 138000,
    items: [
      "La Roche-Posay Pure Retinol Serum",
      "Seoul 1988 Cream Retinol",
      "Naturium Vitamin C Complex Serum 30ml",
      "La Roche-Posay Anthelios SPF 50+",
    ],
  },
};

function findProduct(name) {
  return loadProducts().find((p) => p[1] === name) || null;
}

/**
 * Validate a client cart and reprice it server-side.
 * items: [{ name: string, qty: number }]
 * Returns { ok, items, subtotal, problems }
 */
function priceCart(items) {
  const problems = [];
  const priced = [];
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, items: [], subtotal: 0, problems: ["Cart is empty."] };
  }
  if (items.length > 40) {
    return { ok: false, items: [], subtotal: 0, problems: ["Too many line items."] };
  }
  for (const it of items) {
    const qty = Math.max(1, Math.min(10, parseInt(it && it.qty, 10) || 1));
    const name = String((it && it.name) || "").slice(0, 160);
    const bundle = BUNDLES[name];
    if (bundle) {
      priced.push({ name: bundle.name, sku: name, qty, unit: bundle.price, line: bundle.price * qty, bundle: true });
      continue;
    }
    const p = findProduct(name);
    if (!p) { problems.push(`Not in catalogue: ${name}`); continue; }
    if (p[6] === 1) { problems.push(`${p[1]} is pending registration and can't be purchased yet.`); continue; }
    if (!p[2] || p[2] <= 0) { problems.push(`${p[1]} has no confirmed price yet — message us to order it.`); continue; }
    priced.push({ name: p[1], sku: p[1], qty, unit: p[2], line: p[2] * qty, bundle: false });
  }
  const subtotal = priced.reduce((s, x) => s + x.line, 0);
  return { ok: problems.length === 0 && priced.length > 0, items: priced, subtotal, problems };
}

module.exports = { loadProducts, findProduct, priceCart, BUNDLES };
