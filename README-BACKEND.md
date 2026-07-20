SkinVault by Chi — backend (v1)
================================

WHAT THIS IS
A serverless backend that deploys together with the site on Vercel.
Payments run through Paystack (card, transfer, USSD, in naira).
No database is required: Paystack is the order ledger — every paid order,
with its full item list and delivery address, lives in your Paystack
dashboard under Transactions.

ENDPOINTS
  POST /api/checkout          validates + reprices the cart server-side,
                              adds delivery, returns a Paystack payment URL
  GET  /api/order-status?ref= verifies a payment with Paystack (confirmation page)
  POST /api/paystack-webhook  signature-verified webhook (set in Paystack dashboard)
  POST /api/notify            email signups (BFW launch list / Journal) — optional store
  GET  /api/products          the catalogue as JSON

STOREFRONT
  assets/cart.js              real cart (drawer, quantities, localStorage)
  checkout.html               delivery details + Paystack handoff
  order-confirmed.html        payment verification + receipt view

SECURITY BUILT IN
  - Client prices are ignored; every item is repriced from products.json
  - Supplements (pending NAFDAC) and unpriced items cannot be checked out
  - Quantities clamped 1–10, carts capped at 40 lines
  - Webhook requires a valid HMAC-SHA512 Paystack signature

SET-UP (once, ~10 minutes)
  1. Create a Paystack account at paystack.com and get your keys
     (Dashboard → Settings → API Keys & Webhooks).
  2. Deploy:  npx vercel   (from this folder; say yes to defaults)
  3. In Vercel → Project → Settings → Environment Variables, add:
        PAYSTACK_SECRET_KEY = sk_test_... (later sk_live_...)
     then redeploy:  npx vercel --prod
  4. In Paystack → Settings → Webhooks, set:
        https://YOUR-DOMAIN/api/paystack-webhook
  5. Test with a Paystack test card, then switch the key to sk_live_.

OPTIONAL EMAIL LISTS
  Create a free Redis database at console.upstash.com and add
  UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to Vercel env vars.
  Signups then land in sets "list:bfw" and "list:journal", and paid orders
  are also mirrored to an "orders" log.

THINGS TO CONFIRM BEFORE GOING LIVE (edit lib/shop.js + lib/catalog.js)
  - Delivery fees (currently Lagos ₦3,500 / nationwide ₦6,000,
    free over ₦150,000 — placeholders)
  - Bundle prices (currently 15% off separate totals, pending your sign-off)
  - Ezanic azelaic 20% is a prescription pharmaceutical — recommend swapping
    it out of the Clear Skin System before launch

SECURITY (v1)
=============
Built-in protections, all active with no extra setup:

APPLICATION
  - Server-side repricing: client-sent prices are never trusted; every cart
    is recomputed from products.json before payment
  - Supplements (pending NAFDAC) and unpriced items are rejected at checkout
  - Quantities clamped 1–10; carts capped at 40 lines; request bodies capped at 24 KB
  - All customer input sanitised (control chars stripped, length-capped)

ABUSE / BOT DEFENCE
  - Rate limiting per IP:  checkout 8 / 10 min,  notify 5 / 10 min,
    order-status 30 / 10 min,  products 120 / 10 min
    (Durable via Upstash if configured; in-memory fallback otherwise —
     setting UPSTASH keys is recommended so limits survive across serverless calls.)
  - Honeypot field on checkout + signup forms silently drops bots
  - Cross-origin POSTs blocked (basic CSRF/abuse defence). If you add a custom domain, set ALLOWED_ORIGINS in Vercel, e.g.
        ALLOWED_ORIGINS=https://skinvaultbychi.com,https://www.skinvaultbychi.com

PAYMENT
  - Webhook requires a valid Paystack HMAC-SHA512 signature
  - Order status is verified live against Paystack, never assumed from the URL
  - Your Paystack secret key lives only in Vercel env vars, never in the site

TRANSPORT / BROWSER (via vercel.json, on every page)
  - Content-Security-Policy locking scripts/styles/connections to known sources
    (self + Google Fonts + Paystack checkout)
  - HSTS, X-Content-Type-Options, X-Frame-Options: DENY, Referrer-Policy,
    Permissions-Policy, frame-ancestors 'none' (clickjacking protection)

OPTIONAL NEXT STEPS (not required for launch)
  - Turn on Vercel's built-in DDoS/Attack Challenge mode in the dashboard
  - Add Cloudflare Turnstile (free CAPTCHA) if bots ever slip past the honeypot
  - Set ALLOWED_ORIGINS once your custom domain is live

SEO (v1)
========
Every page ships search-engine and social-share ready.

ON EACH PAGE
  - Unique <title> and meta description (written for melanin-rich-skin search intent)
  - Canonical URL (clean, extensionless — matches Vercel cleanUrls)
  - Open Graph + Twitter Card tags (title, description, image, url, locale en_NG)
  - JSON-LD structured data:
      * Store + WebSite (with Sitelinks search box) on every page
      * BreadcrumbList on every page
      * ItemList of 8 best-sellers WITH prices on the homepage
        (lets Google show product + ₦ price in results)
      * FAQPage on the contact page (eligible for FAQ rich results)
  - Geo tags (Lagos / NG) and theme-color

SITE-WIDE FILES
  - sitemap.xml     all 8 public pages, submitted via robots.txt
  - robots.txt      allows everything except /checkout, /order-confirmed, /api/
  - site.webmanifest PWA manifest (installable, branded)
  - index.html      real homepage (old /skinvault-by-chi.html 301-redirects to /)

BEFORE / AFTER LAUNCH — DO THESE
  1. Set your real domain: edit SITE at the top of build_seo.py, then run
     `python3 build_seo.py` and update sitemap.xml + robots.txt to match.
     (Everything currently uses https://skinvaultbychi.com as a placeholder.)
  2. Add social + icon images to assets/:
       og-cover.jpg   1200x630  (the link-preview card)
       icon-192.png, icon-512.png, favicon.ico
  3. Submit sitemap.xml in Google Search Console (and Bing Webmaster Tools).
  4. Re-run build_seo.py any time you change page descriptions or best-sellers.

WHY THIS MATTERS HERE
  "Skincare for dark skin Nigeria", "PDRN serum Lagos", "vitamin C serum melanin" are the kinds of low-competition, high-intent searches this markup targets — product+price rich results and a curated-store schema help you show up above generic marketplaces.
