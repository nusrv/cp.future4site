# Knowledge Platform Roadmap

## Status

Phase 1A, Phase 1B, and the Phase 1C manual pilot are operationally accepted by the owner. On 2026-07-15, Plesk successfully generated Prisma Client, passed 23 test files and 141 tests, passed client/server TypeScript, completed the production build, and applied all four additive knowledge-platform migrations to MariaDB. Phases 2A, 2B, 2C, 3, and 4 are implemented and migrated as separate controlled gates; activation and production evaluation remain intentionally separate. Local OCR on the shared Plesk server is no longer the preferred deployment path. Phase 5 semantic retrieval remains deliberately deferred by the measured decision gate.

## Non-negotiable architecture

- CP and MariaDB remain authoritative for documents, review state, approved claims, provenance, applicability, and audit history.
- Original files remain private and immutable.
- n8n never receives direct database access.
- Source approval, claim approval, locale approval, and public-safe scope remain separate decisions.
- AI output is always untrusted proposed material until a human approves it through CP.
- Generation may eventually consume only current APPROVED, PUBLIC_SAFE, effective, unexpired, non-superseded claims that match explicit applicability.
- Every generated factual statement must remain traceable to approved claim revisions and immutable source versions.
- No phase may silently broaden product, packaging, market, audience, or objective applicability.

## Gate 0: Phase 1B production acceptance — complete

### Required work

1. Pull the current develop commit on Plesk.
2. Take verified MariaDB and complete FILE_STORAGE_PATH backups.
3. Run the documented Prisma generation, schema validation, test, typecheck, build, and migration gates.
4. Rerun the full test suite after the three Plesk contract corrections.
5. Verify both Phase 1B migrations in MariaDB.
6. Restart CP and run the full source-review, claim, translation, supersession, permission, and Phase 1A regression smoke tests.
7. Verify the final CP logo and favicon after the production build.
8. Record production row counts and inspect whether KnowledgeIndex contains real or synthetic data.
9. Complete a rollback rehearsal or written restore verification.

### Exit criteria

- Full test suite passes on Plesk.
- Migration and restart succeed.
- OWNER_ADMIN, MARKETING, CONTENT_REVIEWER, READ_ONLY_MANAGEMENT, and unauthorized-role behavior are verified.
- An approved source, approved bilingual claim, rejected revision, and successful supersession are demonstrated.
- Existing Phase 1A files and versions remain downloadable and auditable.
- No generation, n8n, or publishing dispatch occurs.

Completion record: the owner reports Phase 1B and the Phase 1C pilot working in production. The later Plesk gate passed Prisma generation, 141 tests, TypeScript, production build, and all nine migrations, including the four 2026-07-15 knowledge migrations. Detailed evidence is recorded at the top of `SESSION_HANDOFF.md`.

## Phase 1C: governance and curated knowledge population

Purpose: prove the human operating model before adding automation.

### Scope

- Assign named source reviewers and claim approvers.
- Define required locales per claim family.
- Define a controlled claim-type vocabulary.
- Define market, audience, and objective vocabularies.
- Curate an initial high-value set of approved source versions.
- Manually enter and approve a representative claim set across products and packaging sizes.
- Establish review cadence, expiration policy, and source-replacement procedure.
- Add management reporting for queue age and approval counts only if operators need it.

### Exit criteria

- At least one complete approved claim set exists for each selected pilot product/packaging combination.
- Arabic and English review is exercised by different authorized operators where practical.
- Operators can explain the difference between trusted source, approved claim, and PUBLIC_SAFE claim.
- Backup, audit export, and correction/supersession procedures are accepted.

## Phase 2A: deterministic text extraction

Purpose: make source text reviewable without creating or approving claims.

### Scope

- Add an extraction-job model and explicit processing states.
- Extract text only from supported text-native formats, initially PDF/TXT/CSV.
- Store extracted text or structured fragments separately from original files and approved claims.
- Preserve document-version, page, section, and extractor-version provenance.
- Provide operator-visible extraction failures, retries, and sanitized audit events.
- Enforce file-size, page-count, timeout, and concurrency limits.
- Keep extracted content private and unavailable to content generation.

### Boundaries

- No OCR.
- No Gemini or other LLM.
- No claim suggestions.
- No automatic translation.
- No automatic source or claim approval.
- No n8n database access.

### Exit criteria

- Extraction is reproducible for an immutable version.
- Replacement versions create separate extraction results.
- Failures do not alter source-review or claim state.
- Storage paths and full restricted content are absent from logs and audit metadata.

## Phase 2B: OCR for scanned documents

Purpose: support image-only PDFs and approved image formats after deterministic extraction is stable.

Deployment decision on 2026-07-15: keep CP's local OCR flag disabled on the shared Plesk server. Plan a remote provider adapter only after the separately isolated Future OCR API is built and independently accepted. The standalone product planning workspace is `..\future_OCR`; it is not part of this repository.

### Scope

- Detect when a document has no usable text layer.
- Run OCR as a separate, explicitly requested job.
- Record OCR engine/version, language settings, page confidence, duration, and failure state.
- Support Arabic and English without treating OCR output as approved wording.
- Add operator comparison between source page and OCR text.
- Apply quotas and resource limits.

### Exit criteria

- OCR output remains proposed source text only.
- Low-confidence pages are clearly flagged.
- Arabic/English accuracy is measured on a representative evaluation set.
- No OCR output reaches generation or claims automatically.

## Phase 2C: AI-assisted candidate claims

Purpose: reduce manual transcription while keeping approval fully human.

### Scope

- Select an approved AI provider and document data-handling, retention, residency, and cost controls.
- Send only authorized source fragments through a controlled service boundary.
- Generate candidate claims with source-location references and confidence/explanation metadata.
- Generate optional translation suggestions as separate unapproved proposals.
- Require operators to create or accept a DRAFT revision before normal Phase 1B review begins.
- Record model, prompt version, source fragment IDs, and operator decision without logging secrets or unrestricted full documents.

### Boundaries

- Candidate does not equal claim.
- Candidate wording is never APPROVED automatically.
- English approval never approves Arabic, or vice versa.
- AI cannot set applicability or PUBLIC_SAFE scope without explicit operator confirmation.
- n8n may orchestrate signed jobs only; it cannot read MariaDB directly.

### Exit criteria

- A measured evaluation set shows acceptable factual precision and provenance accuracy.
- Hallucinated or unsupported candidates are rejected safely.
- Cost, timeout, retry, and provider-failure behavior is operationally accepted.

## Phase 3: approved-claim resolver

Purpose: provide deterministic, read-only retrieval of eligible approved claims.

### Scope

- Build a CP-owned resolver over the new approved-claim domain, not KnowledgeIndex.
- Filter by lifecycle, usage scope, effective/expiration dates, supersession, locale, brand, product, packaging, market, audience, and objective.
- Return claim revision IDs, approved wording, provenance references, and applicability decisions.
- Use exact relational filtering before considering semantic techniques.
- Add conflict, missing-coverage, and ambiguity reporting.
- Keep resolver results internal and read-only.

### Exit criteria

- Product-specific claims never resolve for another product.
- Packaging claims never resolve for another size.
- Locale and market restrictions are enforced.
- Every result is traceable to its immutable source version.
- Expired, rejected, restricted, and superseded claims are excluded as required.

## Phase 4: controlled generation integration

Purpose: allow content generation to use only resolver-approved evidence.

### Scope

- Define a signed CP-to-generation evidence envelope.
- Include only resolver-selected claim revisions and approved locale wording.
- Require generated output to cite claim IDs internally for review.
- Add a no-evidence behavior that refuses unsupported factual claims.
- Show operators which approved claims supported each generated item.
- Preserve current human content and publishing approval gates.

### Boundaries

- n8n receives a sanitized evidence payload, never database access.
- Prompts cannot query private storage.
- Generation cannot change claims, sources, or approval state.
- Publishing remains a separate deliberate action.

### Exit criteria

- Factual generation uses only supplied approved claims.
- Unsupported claims are detected in the evaluation suite.
- Removing or superseding a claim affects new generation without rewriting historical content/audit records.
- Existing publishing safeguards remain unchanged.

## Phase 5: optional semantic retrieval

Decision on 2026-07-15: deferred behind the measured gate in `docs/KNOWLEDGE_RETRIEVAL_DECISION.md`. Exact relational resolution is implemented first; no embedding model, vector database, semantic fallback, or `KnowledgeIndex` migration has been added.

Purpose: improve discovery only if exact relational resolution becomes insufficient.

### Entry criteria

- Phase 3 and Phase 4 are stable in production.
- Claim volume and operator evidence show a real retrieval problem.
- A security, privacy, cost, and deletion design is approved.

### Scope

- Embed approved claim revisions or approved source fragments, never unrestricted file-system content by default.
- Keep MariaDB identifiers and approval state authoritative.
- Filter relational eligibility before semantic ranking.
- Rebuild or invalidate vectors when a revision is superseded or expires.
- Evaluate recall, precision, cross-product leakage, Arabic behavior, and stale-vector handling.

## Cross-cutting work still required

- Production inventory of KnowledgeIndex before any retirement or migration proposal.
- Dependency and vulnerability remediation plan for existing npm audit findings.
- Antivirus or malware-scanning decision for private uploads.
- Data-retention and legal/privacy policy for source documents, extracted text, OCR, AI requests, and audit logs.
- Monitoring for storage capacity, extraction/OCR queues, failed jobs, provider costs, and audit anomalies.
- Browser and mobile acceptance testing for Knowledge Library and claim history.
- Restore drill covering MariaDB plus FILE_STORAGE_PATH as one coordinated backup unit.
- Operator runbooks and role assignment.
- A representative bilingual evaluation corpus with expected provenance and applicability.
- A remote OCR provider contract and CP adapter, deferred until Future OCR is independently stable.
- Packaging-format selection in content requests if generation must use packaging-restricted claims.
- Durable queue/worker architecture before extraction, OCR, or provider volume grows beyond controlled synchronous pilots.

## Decisions required from the owner

1. Which products, packaging formats, markets, and claim types form the pilot?
2. Are both Arabic and English mandatory for every PUBLIC_SAFE claim?
3. Who may review sources, review wording, and finally approve claims?
4. Which file formats and maximum page counts should extraction support first?
5. Is OCR required for the pilot, and which Arabic/English accuracy threshold is acceptable?
6. Which AI provider and data-retention terms are acceptable for candidate generation?
7. May restricted documents be sent to an external AI provider, or must they remain local/manual?
8. What claim expiration and periodic re-verification rules apply?
9. What evidence coverage is required before generation may use a product or packaging combination?

## Recommended immediate sequence

1. Preserve the successful deployment checkpoint and keep all new feature flags disabled until each activation is deliberately piloted.
2. Pilot Phase 2A with small TXT and CSV sources first; treat PDF/Poppler as a separate shared-server operational decision.
3. Build and run the bilingual Phase 3 resolver evaluation set over manually approved claims.
4. Keep CP local OCR disabled and develop Future OCR only in its separate project/session.
5. Review Gemini data handling, retention, residency, and cost before enabling Phase 2C.
6. Preserve and inspect the existing n8n workflow before enabling Phase 4 evidence-backed generation last.
7. Keep Phase 5 deferred unless measured exact-retrieval failures satisfy its documented entry gate.
