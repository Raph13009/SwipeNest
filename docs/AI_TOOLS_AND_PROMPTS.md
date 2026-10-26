# AI tools, models and prompts

## Models used

| Capability | Tool / model | Notes |
|---|---|---|
| Text embeddings | `sentence-transformers/all-MiniLM-L6-v2` | Precomputed offline + online query encoding |
| Visual features | Deterministic image statistics (brightness, warmth, contrast, edges, palette) | Fast, reproducible; complements structured style attributes |
| Adaptive ranking | Custom preference-vector learner (NumPy) | Updates after every swipe |
| Natural-language search | MiniLM semantic similarity + constraint parser | Budget/surface/arrondissement/style extraction via regex + embeddings |
| Scam detection | Weighted rule engine + local rent references | Explainable signals; not a fraud verdict |
| Application copilot | Deterministic grounded template generator (FR/EN) | Optional LLM hook via `SWIPENEST_LLM_API_KEY` (not required) |

## Why not a hosted LLM for core ranking?

Core personalization must work offline, be reproducible for academic evaluation, and avoid inventing match scores. Learning is implemented as:

1. Maintain user text preference vector \(u_t\) and visual preference vector \(u_v\).
2. On like: \(u \leftarrow (1-\eta)u + \eta e\)
3. On reject: \(u \leftarrow (1-\eta)u - \eta e\)
4. Rejection reasons adjust ranking weights and soft constraints (budget, surface, brightness, neighborhood, style, amenities).
5. Final score blends semantic, visual, budget, surface, location, style, amenity and a small exploration term.

## Application message generation

Messages are grounded only in:

- user-provided name / occupation / about text
- selected listing attributes (arrondissement, surface, rooms, rent)

**Prompt policy (if optional LLM is configured):**

```
You write rental application messages for Paris apartments.
Use only the provided user profile and listing facts.
Never invent income, employer, guarantor, or documents.
Language: {language}. Tone: {tone}.
Return only the message body.
```

The default demo path uses local templates so the feature works without API keys.

## Explainability

`GET /api/explain/{id}` returns factors computed from the same scoring parts used for ranking (`budget`, `location`, `surface`, `style`, `semantic`, `visual`, `amenity`, `brightness`). Compromises are low-scoring factors — not fabricated narrative.

## Evaluation

Run:

```bash
backend/.venv/bin/python scripts/evaluate_recommender.py
backend/.venv/bin/pytest backend/tests -q
```

See `docs/evaluation_report.json` after evaluation.
