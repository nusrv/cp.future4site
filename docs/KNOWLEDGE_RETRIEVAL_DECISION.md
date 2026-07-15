# Phase 5 Retrieval Decision

## Decision

Semantic retrieval, embeddings, and a vector database are deferred. Phase 3 exact relational resolution is the production candidate. There is currently no measured evidence that it fails to retrieve relevant governed claims after operators set brand, product, packaging, market, audience, objective, locale, and lifecycle metadata.

This is a deliberate Phase 5 gate, not unfinished implementation. Adding semantic infrastructure before measuring exact retrieval would expand the external data surface, introduce model/version drift, create re-indexing and deletion obligations, and make applicability enforcement harder to reason about.

## Evaluation baseline

`tests/fixtures/knowledge-retrieval-evaluation.json` is the initial deterministic safety corpus. It verifies positive exact matches and negative product, packaging, market, audience, objective, lifecycle, scope, effective-date, expiration, and supersession cases. It is intentionally synthetic and must be supplemented on Plesk with representative approved Arabic and English claims.

For each real pilot request, record:

- the exact resolver context;
- claims expected by a human reviewer;
- claims returned;
- false positives;
- false negatives;
- missing or incorrect metadata;
- whether the request itself lacked a required structured field;
- review time and operator decision.

## Adoption threshold

Do not approve semantic retrieval unless all conditions hold:

1. At least 100 representative bilingual request/claim judgments have been reviewed.
2. Exact resolution precision remains at least 99% for public-safe use.
3. At least 10 material false negatives remain after metadata and UI corrections.
4. Those false negatives are demonstrably caused by vocabulary mismatch, not missing applicability, locale, lifecycle, or approval data.
5. A semantic proof of concept improves recall without reducing precision below 99%.
6. Provider retention, residency, cost, re-indexing, backup, deletion, and incident procedures are approved.

## Future proof-of-concept boundary

If the gate passes, semantic search may rank only the set already filtered by Phase 3 lifecycle, locale, usage scope, dates, supersession, and exact applicability. It must never broaden product, packaging, market, audience, objective, brand, or locale restrictions. Results must still return immutable claim revision IDs and provenance. `KnowledgeIndex` remains untouched until production contents are separately inventoried.
