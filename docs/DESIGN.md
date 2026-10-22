# Design

CropCare is a tool for farmers, not a marketing product. It should look like a clear, sturdy government-grade utility: plain, legible, calm.

## Hard rules (app and website)

- No purple or any gradient backgrounds
- No pill-shaped buttons. Buttons use a 6 px corner radius.
- No emoji used as icons. Icons come from Ionicons (bundled with Expo) or inline SVG, always paired with a text label.
- No em dashes in any copy
- No fake reviews, fake testimonials, fake user counts or made-up accuracy figures. A number appears only after it is measured, and it links to `results.md`.
- No AI-generated photos. Only real photos we took, with permission, or none.
- No custom cursors, no cursor animations, no scroll-triggered animations, no parallax
- No "made with AI" badges or generator footers
- Copy is short, concrete and plain. No hype words.

## Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg` | `#FFFFFF` | `#141613` | Page background. White, not cream: the app is read outdoors in bright sun, where white gives the most contrast |
| `surface` | `#F4F5F1` | `#1D201B` | Cards, panels |
| `text` | `#1C1F1A` | `#ECEDE8` | Body text |
| `muted` | `#5A6155` | `#A6AD9F` | Secondary text |
| `primary` | `#2F6B2F` | `#7FBF6E` | Main buttons, links (leaf green) |
| `onPrimary` | `#FFFFFF` | `#0E1A0C` | Text on primary |
| `warn` | `#9A5B00` | `#E0A040` | Unsure state, medium confidence |
| `danger` | `#A3271F` | `#EF8A80` | Disease found |
| `border` | `#D9D8CF` | `#33372F` | Dividers, outlines |
| `visited` | `#6B4F1D` | `#D2B074` | Visited links on the website |

All text and background pairs meet WCAG AA contrast (4.5:1 for body text).

## Type

- App: system font (Roboto on Android) which renders Devanagari through Noto Sans Devanagari. Body 18 px, headings 26 px. Hindi text is never smaller than 16 px.
- Website: system fonts only (system-ui, then Noto Sans Devanagari or Mangal for Hindi). No web font requests, so no visitor data goes to a font host.

## Components

- Primary button: full width on phone, minimum height 56 px, 6 px radius, icon plus text label
- Secondary button: outlined, same size
- Confidence: a word ("High", "Medium", "Low") plus the percentage, never colour alone
- Every screen has a loading, empty and error state

## Motion

Only functional transitions provided by the platform (screen change). Nothing animates on scroll.
