RAPIRA HOMEPAGE TYPOGRAPHY SPECIFICATION
===========================================

1. CURRENTLY ACTIVE & INSTALLED FONT:
   Font: Tanker
   Designer: Ruosi Huang
   Foundry: Indian Type Foundry (ITF) / Fontshare
   License: 100% Free for Personal & Commercial Use (including website embedding via @font-face)
   Characteristics: Heavy narrow capitals display sans-serif with smooth rounded corners, matching the reference festival poster aesthetic.
   Installed Files in public/fonts/:
   - tanker.woff2 (19,236 bytes)
   - tanker.ttf (78,636 bytes)

2. COMMERCIAL NOTRE FONT (FLAVORTYPE) SPECIFICATION:
   Font: Notre
   Foundry: Flavortype (Bandung, Indonesia) / Ilham Herry
   Vendor: Creative Fabrica / YouWorkForThem ($22.00 commercial purchase)
   Status: Commercial proprietary font. No legitimate free trial/freeware distribution exists.

3. SEAMLESS MODULAR ARCHITECTURE:
   The stylesheet `public/css/homepage.css` declares:
   font-family: 'Notre', 'Tanker', 'Anton', sans-serif !important;

   If you acquire the licensed Notre webfont from Flavortype/Creative Fabrica in the future, simply drop:
   - notre.woff2 (recommended) or notre.woff / notre.otf / notre.ttf
   into this directory (`public/fonts/`).
   The browser will immediately prioritize and render Notre over Tanker with zero CSS or codebase modifications.
