# Development rules

## General
- TypeScript in the app, typed Python (type hints) in `ml/` and `backend/`
- Keep functions small. Do not duplicate logic between screens; shared logic goes in `app/src/lib`.
- Do not modify unrelated files.

## Before coding
- Read PRD.md, ARCHITECTURE.md, DESIGN.md and this file.
- Inspect what already exists and reuse it.

## Honesty in numbers
- Never write a metric that was not measured. Leave the blank in `results.md` until the script prints it.
- Every number in the README or website links to the script and data split that produced it.
- Report small test sets with their confidence interval (`evaluate.py` prints it).

## Data
- Field photos are test only. Never train on them, never tune on them.
- Splits are written once to `manifest.csv`. Do not re-split.
- Run `scripts/check_leakage.py` after any change to the data.

## Treatment advice
- Advice text changes only with the reviewer's sign-off recorded in `app/assets/advice.json` (`review` block).
- No pesticide dose is written from memory. Doses come from the product label or the reviewing expert.

## UI
- Follow DESIGN.md hard rules.
- Every screen works in Hindi and English, and has loading, empty and error states.

## Security and privacy
- Never commit secrets. Configuration goes in `.env` (see `.env.example`).
- Validate every request body on the server.
- No personal data: no names, phone numbers, photos or GPS.

## Testing
- `ml`: `pytest` in `ml/`
- `backend`: `pytest` in `backend/`
- `app`: `npm run typecheck`, `npm run lint`, `npm test`
- Fix failing tests before moving on.

## Git
- Small commits with descriptive messages, one feature per branch for larger work.
