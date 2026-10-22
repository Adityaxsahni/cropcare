# Launch checklist

The website does not launch until `python scripts/check_launch.py` passes. It checks the automatic items below; the rest are manual.

## Checked by the script
- [ ] Custom domain connected, and written in `site/CNAME` (until then the site is a preview at adityaxsahni.github.io/cropcare; the deploy runs the gate with `--allow-no-domain`)
- [x] Favicon on every page (`favicon.ico`, `favicon.svg`, `apple-touch-icon.png`)
- [x] Privacy policy page exists and every page links to it
- [x] Privacy policy contact email filled in (adityacsc99@gmail.com)
- [x] No "made with AI" or similar tags
- [x] No em dashes, emoji, gradients, pill-shaped buttons, scroll or cursor animation, third-party scripts or fonts

## Manual
- [ ] Every number on the site comes from `results.md` and links to it. No made-up counts, reviews or testimonials.
- [ ] Only real photos taken with permission (or none). No AI-generated images.
- [ ] Copy read aloud once by a person; it sounds like a person wrote it.
- [ ] Domain DNS set, HTTPS working, `www` redirect decided
- [ ] If the site links the repository, the link is correct and the repository README is up to date
- [ ] App `EXPO_PUBLIC_PRIVACY_URL` points to the live privacy page

## Before the app reaches farmers
- [ ] `app/assets/advice.json` reviewed by a named agriculture expert; `review.reviewed` set to true with name and date; `sources` filled
- [ ] Final model chosen and its numbers in `results.md`
- [ ] APK tested in airplane mode on a low-end Android phone (docs/TEST_PLAN.md, "On device")
- [ ] Backend on Postgres, `ADMIN_TOKEN` set, `/stats` reachable
- [ ] Farmers asked for permission before installing; nothing collected that identifies them
