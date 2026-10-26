# Development notes

## Architecture

```
frontend/   Next.js App Router UI (mobile-first)
backend/    FastAPI recommendation + content APIs
scripts/    Dataset prep + evaluation
data/       Processed Paris listings, images, embeddings
docs/       Guides and AI attribution
```

## Local workflow

1. `backend/.venv/bin/python scripts/prepare_dataset.py --count 400` (once)
2. `npm run backend` — API on :8000
3. `npm run frontend` — UI on :3000
4. `npm test` / `npm run eval`

## Observing recommendation adaptation

- Settings → Recommendation adaptation shows live top ranks + weight vector
- `GET /api/demo/adaptation`
- Taste DNA updates after each swipe
- Rejection reasons shift weights (`too_dark` → brightness bias, etc.)

## Optional LLM

Set `SWIPENEST_LLM_API_KEY` (and optional `SWIPENEST_LLM_BASE_URL`) for future LLM-backed application drafting. The default path uses grounded templates and needs no key.
