# SwipeNest AI

Premium AI-powered apartment hunting for **Paris** — Tinder-smooth discovery, adaptive recommendations, explainable matching, scam risk signals, and an application copilot.

> Listings are **synthetic demonstration data** adapted from [ListingGenie](https://huggingface.co/datasets/omersh234/listinggenie-listings) (MIT).

## Stack

- **Frontend:** Next.js 15, React, TypeScript, Tailwind CSS 4, Framer Motion, Leaflet
- **Backend:** FastAPI, NumPy, scikit-learn, Sentence Transformers
- **Data:** 400+ Paris-adapted synthetic rentals with local images + precomputed embeddings

## Quick start

### 1. Python backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Prepare dataset & embeddings (first run only, ~1–2 minutes):

```bash
cd ..
backend/.venv/bin/python scripts/prepare_dataset.py --count 400
```

Start API:

```bash
cd backend
.venv/bin/uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Optional env (`frontend/.env.local`):

```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

## Features

- Mobile-first swipe discovery with gesture feedback
- Adaptive multimodal recommendation engine
- Rejection-reason learning
- Taste DNA dashboard
- “Why this apartment?” explanations tied to real scores
- Natural-language dream search + refinements
- Explainable scam risk detector (with synthetic high-risk examples)
- Application copilot (FR/EN), editable, never auto-sent
- Favorites, comparison, Paris map, EN/FR i18n

## Tests & evaluation

```bash
backend/.venv/bin/pytest backend/tests -q
backend/.venv/bin/python scripts/evaluate_recommender.py
```

## Documentation

- [User guide](docs/USER_GUIDE.md)
- [Dataset](docs/DATASET.md)
- [AI tools & prompts](docs/AI_TOOLS_AND_PROMPTS.md)
- Brand direction: `DA.jpeg`
- Product requirements: `SwipeNest_PRD.pdf`

## Brand

Colors from the approved DA:

| Token | Hex |
|---|---|
| Vert sauge | `#1B4D3E` |
| Vert clair | `#A7C4B8` |
| Rose poudré | `#FADADD` |
| Beige | `#F8F6F1` |

Typography: **Plus Jakarta Sans**

## Academic note

This project is designed for an Advanced AI Algorithms assignment: real embeddings, adaptive preference vectors, explainable ranking factors, and measurable evaluation against a non-personalized baseline — not a decorative LLM wrapper.
