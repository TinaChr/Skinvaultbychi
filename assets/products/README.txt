SkinVault by Chi — product images folder
========================================
The website expects one image per product in this folder, named exactly as
listed in SkinVault_Image_Sourcing_Manifest.xlsx (column E).

Fastest way to fill it:
  1. Put download_product_images.py next to the manifest (one level up from here)
  2. Run:  pip install requests openpyxl
  3. Run:  python download_product_images.py

The script downloads every image with a sourced URL, auto-extracts the
official pack shot from the brand product pages in the manifest, updates the
Status column, and can be re-run safely — it skips files already here.

Rows without a URL: open the "Image Search Link" in the manifest, save the
official image here under the exact filename in column E, mark it Sourced.
Cards on the site update automatically as files land — no code changes needed.
