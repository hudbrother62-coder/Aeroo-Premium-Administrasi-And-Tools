# Simpul Rebrand — Design QA

- Source visual truth: ImageGen Simpul final identity board.
- Implementation captures: desktop light, desktop dark, mobile 390×844, and login desktop/mobile captured with Chromium via agent-browser.
- Desktop viewport: 1440 × 900 CSS px.
- Mobile viewport: 390 × 844 CSS px.
- Source is a brand identity board rather than a literal product screen, so fidelity is judged on brand mark, palette, hierarchy, surface language, navigation treatment, motion/polish, and responsive behavior.

## Full-view comparison evidence

The implementation carries the selected visual language into the product: dark navy navigation/hero surfaces, purple → blue → cyan accents, the selected Simpul knot asset, bright neutral content surfaces, rounded cards, short strong headings, restrained copy, gradient action emphasis, and a purpose-built dark theme.

The first light capture occurred during initial data settling. A repeat after network settle plus 1.5 s showed checking=false, the full dashboard, correct colors, and no remaining skeleton.

## Required fidelity surfaces

### Fonts and typography
No P0/P1/P2 finding. The app retains its high-performance system font stack instead of adding a webfont. Weight, hierarchy, letter spacing, and compact labels were adjusted to match the modern SaaS direction. This is an intentional performance trade-off.

### Spacing and layout rhythm
No P0/P1/P2 finding. Sidebar, hero, cards, metric grid, login split layout, mobile header, and bottom navigation use consistent spacing/radii. Desktop and mobile use distinct layouts. Mobile at 390 px has no horizontal overflow.

### Colors and visual tokens
No P0/P1/P2 finding. Light and dark palettes map to the selected navy/violet/blue/cyan direction. Semantic success/warning/danger colors remain distinct from brand accents.

### Image quality and asset fidelity
No P0/P1/P2 finding. The actual Simpul logo image is used in sidebar, mobile header, login, metadata icon, and dashboard hero. No custom SVG/CSS logo recreation remains.

### Copy and content
No P0/P1/P2 finding. User-visible AIRO/AEROO naming was removed from checked screens and replaced with Simpul. Internal session/storage identifiers are intentionally retained for compatibility.

## Responsive and interaction checks

- Desktop 1440 px: sidebar visible; no horizontal overflow; no Next.js error overlay.
- Mobile 390 px: desktop sidebar hidden; mobile header visible; bottom navigation visible; no horizontal overflow.
- Dark mode 1440 px: full render with no overflow/error overlay.
- Login: desktop and mobile render without overflow.
- Reduced-motion users get effectively disabled motion.
- Hover/focus/page-entry/card effects use CSS transform/opacity/border/shadow rather than JS animation libraries.

## Performance checks

- No animation library added.
- Simpul logo is an optimized WebP.
- Global shared JS remains about 103 kB.
- Agenda Excel dependency changed from eager client import to on-demand dynamic import.
- Agenda first-load dropped from about 232 kB to about 113 kB.
- Offscreen dense lists use content-visibility:auto.
- Auth identity is no longer refetched on every client route change.
- Route loading skeleton provides immediate perceived response.

## Comparison history

1. Initial P2: dashboard hero used a CSS-drawn decorative knot approximation.
   - Fix: replaced it with /simpul-logo.webp.
   - Post-fix evidence: final desktop/mobile captures use the real logo asset.
2. Initial light screenshot appeared blank while data was settling.
   - Verification: settled capture contains full content and checking=false.
   - No remaining defect.

## Follow-up polish

P3 only: a future iteration could use a display font closer to the brand-board wordmark, but the current system font is deliberately retained for speed and platform consistency.

final result: passed
