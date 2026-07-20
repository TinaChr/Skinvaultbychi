// GET /api/products — catalogue as JSON. Cached, security headers, light rate limit.
const { loadProducts } = require("../lib/catalog");
const { send } = require("../lib/shop");
const { applySecurityHeaders, enforceRate } = require("../lib/security");
module.exports = async (req, res) => {
  applySecurityHeaders(res);
  if (!(await enforceRate(req, res, "products", 120, 600))) return;
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=3600");
  return send(res, 200, { products: loadProducts() });
};
