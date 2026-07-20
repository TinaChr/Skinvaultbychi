#!/usr/bin/env python3
"""
SkinVault by Chi — SEO builder.
Injects canonical URLs, Open Graph + Twitter cards, and JSON-LD structured data
into every page. Idempotent: re-running replaces the managed block, never dupes.
Edit SITE below to your real domain before launch.
"""
import re, json, os

SITE = "https://skinvaultbychi.com"   # <-- change to your live domain
BRAND = "SkinVault by Chi"
OG_IMAGE = SITE + "/assets/og-cover.jpg"   # 1200x630 social card (add this image)
TWITTER = "@skinvaultbychi"                # <-- your handle, or remove

MARK_START = "<!-- SEO:start -->"
MARK_END = "<!-- SEO:end -->"

# page filename -> (canonical path, description, og:type)
PAGES = {
    "index.html": ("/", "Curated skincare for melanin-rich skin — vetted serums, SPF, PDRN and routines chosen for deeper tones and Nigerian weather. Delivered across Nigeria.", "website"),
    "shop.html": ("/shop.html", "Shop every vetted product in the vault — serums, cleansers, SPF and treatments chosen for melanin-rich skin. Filter by concern, price and routine.", "website"),
    "concerns.html": ("/concerns.html", "Find products and routines for your skin concern — dark spots, acne, dryness, dullness, ageing and sensitivity — chosen for deeper skin tones.", "website"),
    "bundles.html": ("/bundles.html", "Complete skincare routines, already built. Curated AM/PM bundles for your concern at a better price than buying each piece alone.", "website"),
    "beauty-from-within.html": ("/beauty-from-within.html", "Marine collagen, liposomal vitamin C and wellness supplements for skin — chosen with the same eye we bring to the shelf. Launching soon.", "website"),
    "about.html": ("/about.html", "How SkinVault by Chi vets every product for melanin-rich skin, and the story behind the vault. Curated, not collected.", "website"),
    "journal.html": ("/journal.html", "Ingredient breakdowns, honest routine advice and skincare myths put to rest — written for melanin-rich skin.", "website"),
    "contact.html": ("/contact.html", "Questions about products, orders or your routine? Real answers from people who know the shelf. Contact SkinVault by Chi.", "website"),
}

def org_ld():
    return {
        "@context": "https://schema.org",
        "@type": "Store",
        "@id": SITE + "/#store",
        "name": BRAND,
        "description": "Curated skincare store for melanin-rich skin, delivering across Nigeria.",
        "url": SITE,
        "image": OG_IMAGE,
        "priceRange": "₦9,000–₦220,000",
        "areaServed": {"@type": "Country", "name": "Nigeria"},
        "currenciesAccepted": "NGN",
        "paymentAccepted": "Card, Bank Transfer, USSD",
    }

def website_ld():
    return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": SITE + "/#website",
        "name": BRAND,
        "url": SITE,
        "potentialAction": {
            "@type": "SearchAction",
            "target": {"@type": "EntryPoint", "urlTemplate": SITE + "/shop.html?q={search_term_string}"},
            "query-input": "required name=search_term_string",
        },
    }

def breadcrumb_ld(name, path):
    items = [{"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"}]
    if path != "/":
        items.append({"@type": "ListItem", "position": 2, "name": name, "item": SITE + path})
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": items}

def product_ld_from_catalog():
    """Build ItemList of the homepage best-sellers with Offer/price."""
    with open("products.json", encoding="utf-8") as f:
        prods = json.load(f)
    names = [
        "La Roche-Posay Pure Vitamin C10 Serum", "Anua 100+ PDRN Hyaluronic Toner",
        "Medicube TXA Niacinamide Serum", "Beauty Of Joseon Relief Sun Rice + Probiotics SPF50+ Pa++++",
        "SKIN1004 Madagascar Centella Toner", "Urban Skin RX Super C Serum",
        "Numbuzin No.5+ Glutathione Brightening Serum", "Jumiso All Day Vitamin C Serum",
    ]
    by_name = {p[1]: p for p in prods}
    elements = []
    pos = 1
    for n in names:
        p = by_name.get(n)
        if not p or not p[2]:
            continue
        elements.append({
            "@type": "ListItem", "position": pos,
            "item": {
                "@type": "Product", "name": p[1], "category": p[0],
                "description": p[5] or ("Skincare from " + BRAND),
                "brand": {"@type": "Brand", "name": p[1].split(" ")[0]},
                "offers": {
                    "@type": "Offer", "priceCurrency": "NGN", "price": str(p[2]),
                    "availability": "https://schema.org/InStock",
                    "url": SITE + "/shop.html?q=" + p[1].split(" ")[0].lower(),
                },
            },
        })
        pos += 1
    return {"@context": "https://schema.org", "@type": "ItemList", "name": "Best sellers", "itemListElement": elements}

def faq_ld():
    """Contact page has real Q&A — mark it up for FAQ rich results."""
    qas = [
        ("Is SkinVault only for dark skin?", "Everything here works across skin tones — we simply choose and describe it with melanin-rich skin as the priority, because that's who's usually left out."),
        ("How do I know what to buy?", "Start with Shop by Concern, or message us and we'll build a routine around your main concern. We'd rather help you buy the right two products than the wrong five."),
        ("Are your products authentic?", "Yes. Every product is sourced to be genuine — authenticity is the whole basis of a curated vault."),
        ("Where do you deliver?", "Across Nigeria, with Lagos and nationwide delivery options at checkout."),
        ("When do the supplements go live?", "They're in final registration. Join the list on the Beauty from Within page and you'll be emailed the day they launch."),
    ]
    return {
        "@context": "https://schema.org", "@type": "FAQPage",
        "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in qas],
    }

def build_block(fname, path, desc, ogtype):
    url = SITE + path
    title_m = None
    ld = []
    # Common graph on every page
    ld.append(org_ld())
    ld.append(website_ld())
    if fname == "index.html":
        ld.append(product_ld_from_catalog())
    else:
        # breadcrumb uses the page's H1-ish name from the title
        pass
    tags = []
    tags.append(MARK_START)
    tags.append(f'<link rel="canonical" href="{url}">')
    tags.append('<meta name="robots" content="index, follow, max-image-preview:large">')
    tags.append(f'<meta property="og:url" content="{url}">')
    tags.append(f'<meta property="og:image" content="{OG_IMAGE}">')
    tags.append('<meta property="og:image:width" content="1200">')
    tags.append('<meta property="og:image:height" content="630">')
    tags.append(f'<meta property="og:locale" content="en_NG">')
    tags.append('<meta name="twitter:card" content="summary_large_image">')
    if TWITTER:
        tags.append(f'<meta name="twitter:site" content="{TWITTER}">')
    tags.append(f'<meta name="twitter:image" content="{OG_IMAGE}">')
    tags.append('<meta name="geo.region" content="NG-LA">')
    tags.append('<meta name="geo.placename" content="Lagos">')
    for obj in ld:
        tags.append('<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + '</script>')
    # breadcrumb + page-specific
    with open(fname, encoding="utf-8") as f:
        html = f.read()
    tm = re.search(r"<title>(.*?)</title>", html, re.S)
    pagename = (tm.group(1).split("|")[0].split("—")[0].strip() if tm else fname)
    tags.append('<script type="application/ld+json">' + json.dumps(breadcrumb_ld(pagename, path), ensure_ascii=False, separators=(",", ":")) + '</script>')
    if fname == "contact.html":
        tags.append('<script type="application/ld+json">' + json.dumps(faq_ld(), ensure_ascii=False, separators=(",", ":")) + '</script>')
    tags.append(MARK_END)
    return "\n".join(tags)

def inject(fname, path, desc, ogtype):
    with open(fname, encoding="utf-8") as f:
        html = f.read()
    # ensure meta description matches our SEO copy
    if re.search(r'<meta name="description"', html):
        html = re.sub(r'<meta name="description" content="[^"]*">',
                      f'<meta name="description" content="{desc}">', html, count=1)
    else:
        html = html.replace("</title>", f'</title>\n<meta name="description" content="{desc}">', 1)
    block = build_block(fname, path, desc, ogtype)
    # remove any previous managed block
    html = re.sub(re.escape(MARK_START) + r".*?" + re.escape(MARK_END), "", html, flags=re.S).replace("\n\n\n", "\n")
    html = html.replace("</head>", block + "\n</head>", 1)
    with open(fname, "w", encoding="utf-8") as f:
        f.write(html)
    return len(block)

if __name__ == "__main__":
    # Create index.html from the homepage if not present
    if not os.path.exists("index.html") and os.path.exists("skinvault-by-chi.html"):
        with open("skinvault-by-chi.html", encoding="utf-8") as f:
            home = f.read()
        with open("index.html", "w", encoding="utf-8") as f:
            f.write(home)
        print("created index.html from skinvault-by-chi.html")
    for fname, (path, desc, ogtype) in PAGES.items():
        if os.path.exists(fname):
            n = inject(fname, path, desc, ogtype)
            print(f"SEO injected: {fname} ({n} chars)")
        else:
            print(f"skip (missing): {fname}")
