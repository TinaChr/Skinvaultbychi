/* SkinVault by Chi — storefront cart (works with the live /api backend) */
(function () {
  "use strict";
  var KEY = "sv_cart_v1";

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; }
  }
  function save(c) { localStorage.setItem(KEY, JSON.stringify(c)); render(); }
  function count(c) { return c.reduce(function (s, i) { return s + i.qty; }, 0); }
  function subtotal(c) { return c.reduce(function (s, i) { return s + i.price * i.qty; }, 0); }
  function naira(n) { return "₦" + Number(n).toLocaleString("en-NG"); }

  function add(name, price, sku) {
    var c = load();
    var hit = c.find(function (i) { return i.sku === (sku || name); });
    if (hit) hit.qty = Math.min(10, hit.qty + 1);
    else c.push({ sku: sku || name, name: name, price: price, qty: 1 });
    save(c);
    toast("Added to cart");
    openDrawer();
  }

  // ---------- toast ----------
  var toastEl, toastTimer;
  function toast(m) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "toast";
      toastEl.setAttribute("role", "status");
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = m;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2200);
  }

  // ---------- drawer ----------
  var drawer, backdrop;
  function ensureDrawer() {
    if (drawer) return;
    backdrop = document.createElement("div");
    backdrop.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:94;opacity:0;pointer-events:none;transition:opacity .3s";
    drawer = document.createElement("aside");
    drawer.setAttribute("aria-label", "Cart");
    drawer.style.cssText = "position:fixed;top:0;right:-420px;width:min(400px,100vw);height:100%;background:#FBF9F4;color:#211E1A;z-index:95;transition:right .35s;display:flex;flex-direction:column;box-shadow:-18px 0 50px rgba(0,0,0,.35);font-family:'Cormorant Garamond',Georgia,serif";
    drawer.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:20px 24px;border-bottom:1px solid rgba(33,30,26,.14)">' +
      '<strong style="font-size:22px">Your cart</strong>' +
      '<button id="sv-close" style="background:none;border:1px solid #211E1A;font-family:DM Mono,monospace;font-size:11px;letter-spacing:.12em;padding:7px 14px;cursor:pointer">CLOSE</button></div>' +
      '<div id="sv-items" style="flex:1;overflow:auto;padding:10px 24px"></div>' +
      '<div style="border-top:1px solid rgba(33,30,26,.14);padding:18px 24px">' +
      '<div style="display:flex;justify-content:space-between;font-family:DM Mono,monospace;font-size:13px;margin-bottom:14px"><span>Subtotal</span><strong id="sv-sub"></strong></div>' +
      '<a href="checkout.html" id="sv-checkout" class="btn btn-gold" style="display:block;text-align:center;background:#C9A84C;color:#1A1A1A;border:1px solid #C9A84C;font-family:DM Mono,monospace;font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;padding:16px;text-decoration:none">Checkout</a>' +
      '<p style="font-family:DM Mono,monospace;font-size:10.5px;color:#6E6656;margin-top:10px">Delivery calculated at checkout · secure payment via Paystack</p></div>';
    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);
    backdrop.addEventListener("click", closeDrawer);
    drawer.querySelector("#sv-close").addEventListener("click", closeDrawer);
  }
  function openDrawer() { ensureDrawer(); render(); backdrop.style.opacity = "1"; backdrop.style.pointerEvents = "auto"; drawer.style.right = "0"; }
  function closeDrawer() { if (!drawer) return; backdrop.style.opacity = "0"; backdrop.style.pointerEvents = "none"; drawer.style.right = "-420px"; }

  function render() {
    var c = load();
    var cartLink = document.querySelector(".nav-utils .cart");
    if (cartLink) cartLink.textContent = "Cart (" + count(c) + ")";
    if (!drawer) return;
    var box = drawer.querySelector("#sv-items");
    if (!c.length) {
      box.innerHTML = '<p style="padding:30px 0;color:#6E6656">Your cart is empty — the vault awaits.</p>';
    } else {
      box.innerHTML = c.map(function (i, idx) {
        return '<div style="display:flex;gap:12px;align-items:center;padding:14px 0;border-bottom:1px dashed rgba(33,30,26,.14)">' +
          '<div style="flex:1"><div style="font-weight:600;font-size:16.5px;line-height:1.3">' + esc(i.name) + '</div>' +
          '<div style="font-family:DM Mono,monospace;font-size:12px;color:#6E6656;margin-top:4px">' + naira(i.price) + '</div></div>' +
          '<div style="display:flex;align-items:center;gap:8px;font-family:DM Mono,monospace;font-size:13px">' +
          '<button data-svq="-1" data-svi="' + idx + '" style="border:1px solid #211E1A;background:none;width:26px;height:26px;cursor:pointer">–</button>' +
          '<span>' + i.qty + '</span>' +
          '<button data-svq="1" data-svi="' + idx + '" style="border:1px solid #211E1A;background:none;width:26px;height:26px;cursor:pointer">+</button>' +
          '<button data-svx="' + idx + '" aria-label="Remove" style="border:none;background:none;color:#9a3b2e;cursor:pointer;font-size:15px;margin-left:4px">×</button></div></div>';
      }).join("");
    }
    drawer.querySelector("#sv-sub").textContent = naira(subtotal(c));
    var co = drawer.querySelector("#sv-checkout");
    co.style.opacity = c.length ? "1" : ".45";
    co.style.pointerEvents = c.length ? "auto" : "none";
  }
  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;"); }

  // ---------- wire the page ----------
  var BUNDLE_MAP = { "glow starter kit": ["bundle-glow-starter", 63000, "Glow Starter Kit (Bundle)"], "clear skin system": ["bundle-clear-skin", 108000, "Clear Skin System (Bundle)"], "age defense system": ["bundle-age-defense", 138000, "Age Defense System (Bundle)"] };

  document.addEventListener("click", function (e) {
    // Add-to-cart buttons on product cards
    var b = e.target.closest && e.target.closest("button.add");
    if (b && !b.classList.contains("notify-btn")) {
      e.preventDefault(); e.stopPropagation();
      var card = b.closest(".p-card");
      if (!card) return;
      var name = (card.querySelector("h4") || {}).textContent || "";
      var priceEl = card.querySelector(".price");
      if (!name || !priceEl|| priceEl.classList.contains("tbc")) { toast("Price to confirm — message us to order"); return; }
      var price = parseInt(priceEl.textContent.replace(/[^\d]/g, ""), 10);
      if (!price) { toast("Price to confirm — message us to order"); return; }
      add(name.trim(), price);
      return;
    }
    // Bundle buy buttons
    var t = e.target.closest && e.target.closest(".tier a.btn");
    if (t && /buy the bundle/i.test(t.textContent)) {
      e.preventDefault(); e.stopPropagation();
      var tier = t.closest(".tier");
      var h = tier && tier.querySelector("h3");
      var key = h && h.textContent.trim().toLowerCase();
      var m = key && BUNDLE_MAP[key];
      if (m) add(m[2], m[1], m[0]); else toast("Message us for this bundle");
      return;
    }
    // Header cart opens the drawer
    var cl = e.target.closest && e.target.closest(".nav-utils .cart");
    if (cl) { e.preventDefault(); e.stopPropagation(); openDrawer(); }
  }, true); // capture phase: overrides the old demo-cart handler

  // Email capture forms -> /api/notify
  document.addEventListener("submit", function (e) {
    var f = e.target;
    if (!f.classList || !f.classList.contains("capture")) return;
    e.preventDefault(); e.stopImmediatePropagation();
    var input = f.querySelector('input[type="email"]');
    if (!input || !input.value) return;
    var hp = f.querySelector('input[name="website"]');
    var list = /beauty-from-within|bfw/.test(location.pathname) || f.closest(".bfw") ? "bfw" : "journal";
    fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: input.value, list: list, website: hp ? hp.value : "" }) })
      .then(function (r) { return r.json(); })
      .then(function (d) { toast(d.message || (d.saved ? "You're on the list." : "Saved.")); input.value = ""; })
      .catch(function () { toast("Could not save — please try again."); });
  }, true);

  document.addEventListener("DOMContentLoaded", render);
  if (document.readyState !== "loading") render();
  window.SVCart = { load: load, save: save, subtotal: subtotal, naira: naira, clear: function () { localStorage.removeItem(KEY); render(); } };
})();
