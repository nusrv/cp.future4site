-- Phase 2C unapproved AI-assisted candidates. Additive; candidates are not approved claims.
CREATE TABLE KnowledgeCandidateRun (
  id VARCHAR(191) NOT NULL,
  activeKey VARCHAR(191) NULL,
  requestedByUserId VARCHAR(191) NOT NULL,
  extractionId VARCHAR(191) NULL,
  ocrJobId VARCHAR(191) NULL,
  status ENUM('RUNNING','SUCCEEDED','FAILED') NOT NULL DEFAULT 'RUNNING',
  provider VARCHAR(191) NOT NULL,
  model VARCHAR(191) NOT NULL,
  promptVersion VARCHAR(191) NOT NULL,
  inputHash VARCHAR(64) NOT NULL,
  candidateCount INTEGER NOT NULL DEFAULT 0,
  inputTokens INTEGER NULL,
  outputTokens INTEGER NULL,
  durationMs INTEGER NULL,
  errorCode VARCHAR(120) NULL,
  errorMessage TEXT NULL,
  startedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completedAt DATETIME(3) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE INDEX KCR_active_key(activeKey),
  INDEX KCR_status_created_idx(status, createdAt),
  INDEX KCR_extraction_created_idx(extractionId, createdAt),
  INDEX KCR_ocr_created_idx(ocrJobId, createdAt),
  INDEX KCR_requester_created_idx(requestedByUserId, createdAt),
  CONSTRAINT KCR_requester_fkey FOREIGN KEY (requestedByUserId) REFERENCES User(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT KCR_extraction_fkey FOREIGN KEY (extractionId) REFERENCES KnowledgeDocumentExtraction(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT KCR_ocr_fkey FOREIGN KEY (ocrJobId) REFERENCES KnowledgeOcrJob(id) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE KnowledgeCandidateClaim (
  id VARCHAR(191) NOT NULL,
  runId VARCHAR(191) NOT NULL,
  ordinal INTEGER NOT NULL,
  status ENUM('PROPOSED','ACCEPTED','REJECTED') NOT NULL DEFAULT 'PROPOSED',
  proposedStableKey VARCHAR(191) NOT NULL,
  proposedClaimType VARCHAR(191) NOT NULL,
  explanation TEXT NULL,
  confidence DOUBLE NULL,
  decidedByUserId VARCHAR(191) NULL,
  decidedAt DATETIME(3) NULL,
  decisionReason TEXT NULL,
  acceptedClaimId VARCHAR(191) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE INDEX KCC_run_ordinal_key(runId, ordinal),
  UNIQUE INDEX KCC_accepted_claim_key(acceptedClaimId),
  INDEX KCC_status_created_idx(status, createdAt),
  INDEX KCC_stable_key_idx(proposedStableKey),
  CONSTRAINT KCC_run_fkey FOREIGN KEY (runId) REFERENCES KnowledgeCandidateRun(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT KCC_decider_fkey FOREIGN KEY (decidedByUserId) REFERENCES User(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT KCC_accepted_claim_fkey FOREIGN KEY (acceptedClaimId) REFERENCES KnowledgeClaim(id) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE KnowledgeCandidateTranslation (
  id VARCHAR(191) NOT NULL,
  candidateId VARCHAR(191) NOT NULL,
  locale VARCHAR(191) NOT NULL,
  wording TEXT NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE INDEX KCT_candidate_locale_key(candidateId, locale),
  INDEX KCT_locale_idx(locale),
  CONSTRAINT KCT_candidate_fkey FOREIGN KEY (candidateId) REFERENCES KnowledgeCandidateClaim(id) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE KnowledgeCandidateSource (
  id VARCHAR(191) NOT NULL,
  candidateId VARCHAR(191) NOT NULL,
  extractionFragmentId VARCHAR(191) NULL,
  ocrPageId VARCHAR(191) NULL,
  sourceExcerpt TEXT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE INDEX KCS_candidate_fragment_key(candidateId, extractionFragmentId),
  UNIQUE INDEX KCS_candidate_ocr_page_key(candidateId, ocrPageId),
  INDEX KCS_fragment_idx(extractionFragmentId),
  INDEX KCS_ocr_page_idx(ocrPageId),
  CONSTRAINT KCS_candidate_fkey FOREIGN KEY (candidateId) REFERENCES KnowledgeCandidateClaim(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT KCS_fragment_fkey FOREIGN KEY (extractionFragmentId) REFERENCES KnowledgeExtractionFragment(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT KCS_ocr_page_fkey FOREIGN KEY (ocrPageId) REFERENCES KnowledgeOcrPage(id) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
