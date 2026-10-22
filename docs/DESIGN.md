# Design

CropCare is a tool for farmers, not a marketing product. The look follows the owner's city-explorer design: warm paper, ink type, one terracotta accent, serif headings, small uppercase mono labels, hairline cards and hatched spaces where a photo would go. It is adapted to the hard rules below, which win wherever the two disagree.

## Hard rules (app and website)

- No purple or any gradient backgrounds
- No pill-shaped buttons or chips. Buttons and chips use a 6 px corner radius; icon buttons are 6 px squares, never circles.
- No italic or oversized "magazine" hero headlines. Headlines are upright serif, at most 40 px.
- No emoji used as icons. Icons come from Ionicons (bundled with Expo) or inline SVG, always paired with a text label.
- No em dashes in any copy
- No fake reviews, fake testimonials, fake user counts or made-up accuracy figures. A number appears only after it is measured, and it links to `results.md`.
- No AI-generated photos. Only real photos we took, with permission, or none. Hatched panels stand in for photos and say what they are.
- No custom cursors, no cursor animations, no scroll-triggered animations, no parallax
- No "made with AI" badges or generator footers
- Copy is short, concrete and plain. No hype words.

## Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#F3EEE6` | `#16130F` | Paper |
| `surface` | `#FBF8F2` | `#211D18` | Cards, panels |
| `sunken` / `hatch` | `#EAE3D7` / `#D9CEBC` | `#2A251F` / `#3A332B` | Hatched photo spaces |
| `text` (ink) | `#1E1A16` | `#F2ECE2` | Body text, the black primary button |
| `muted` | `#665D52` | `#B3A999` | Secondary text, mono meta lines |
| `accent` | `#B5391F` | `#F08A6C` | Kickers, active tab, links, "needs action" |
| `good` | `#2F6B2F` | `#86C47A` | Healthy, high confidence |
| `warn` | `#8F5200` | `#E3A54B` | Draft advice, unsure |
| `border` | `#E1D8C9` | `#3A332B` | Hairlines |
| `visited` | `#6B4F1D` | `#D2B074` | Visited links on the website |

Every text colour meets WCAG AA (4.5:1) on both `bg` and `surface`, in both colour schemes.

## Type

- Serif for titles and names: the phone's own serif (Noto Serif on Android), Georgia on the web. Upright, regular weight.
- Mono for kickers, chips, meta lines and table headers: the phone's monospace, `ui-monospace` on the web. Uppercase with tracking, English only.
- Sans for body text: the system face.
- Sizes: title 30 px (app) / 40 px (web), body 17 to 18 px, English mono labels 12 to 13 px. Hindi is never smaller than 16 px, so in Hindi the labels use the normal face at 16 px and the tab bar grows to fit.
- No web fonts are downloaded, so nothing reaches a font host and everything works offline.

## Components

- Primary button: ink background, paper text, 56 px tall, 6 px radius. Secondary: outlined in ink. On the black camera screen the button is inverted (paper on black).
- Chips: outlined, 6 px radius, black fill when selected, 44 px tall when tappable.
- Cards: `surface` with a hairline border; no shadows.
- Info grid: two columns of mono label plus value, with hairlines, for facts about a result.
- Hatch: diagonal lines with a small mono caption tag, used where a photo would be. The caption says what it stands for ("Photo checked on this phone, not kept").
- Confidence: a word ("High", "Medium", "Low") plus the percentage, never colour alone.
- Every screen has a loading, empty and error state; actions confirm with a short toast.

## Motion

Only functional transitions provided by the platform (screen change). Nothing animates on scroll.
