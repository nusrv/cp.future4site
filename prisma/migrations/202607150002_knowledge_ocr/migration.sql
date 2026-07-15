-- Phase 2B explicit OCR jobs. Additive; OCR output is not an approved claim or generation input.
CREATE TABLE KnowledgeOcrJob (
  id VARCHAR(191) NOT NULL,
  activeKey VARCHAR(191) NULL,
  documentVersionId VARCHAR(191) NOT NULL,
  requestedByUserId VARCHAR(191) NOT NULL,
  status ENUM('RUNNING','SUCCEEDED','FAILED','UNSUPPORTED') NOT NULL DEFAULT 'RUNNING',
  engineName VARCHAR(191) NOT NULL,
  engineVersion VARCHAR(191) NOT NULL,
  languages VARCHAR(191) NOT NULL,
  sourceSha256 VARCHAR(64) NOT NULL,
  pageCount INTEGER NOT NULL DEFAULT 0,
  characterCount INTEGER NOT NULL DEFAULT 0,
  averageConfidence DOUBLE NULL,
  durationMs INTEGER NULL,
  errorCode VARCHAR(120) NULL,
  errorMessage TEXT NULL,
  startedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completedAt DATETIME(3) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE INDEX KOJ_active_key(activeKey),
  INDEX KOJ_version_created_idx(documentVersionId, createdAt),
  INDEX KOJ_status_created_idx(status, createdAt),
  INDEX KOJ_requester_created_idx(requestedByUserId, createdAt),
  CONSTRAINT KOJ_version_fkey FOREIGN KEY (documentVersionId) REFERENCES KnowledgeDocumentVersion(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT KOJ_requester_fkey FOREIGN KEY (requestedByUserId) REFERENCES User(id) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE KnowledgeOcrPage (
  id VARCHAR(191) NOT NULL,
  ocrJobId VARCHAR(191) NOT NULL,
  pageNumber INTEGER NOT NULL,
  content LONGTEXT NOT NULL,
  contentHash VARCHAR(64) NOT NULL,
  characterCount INTEGER NOT NULL,
  confidence DOUBLE NULL,
  lowConfidence BOOLEAN NOT NULL DEFAULT false,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE INDEX KOP_job_page_key(ocrJobId, pageNumber),
  INDEX KOP_job_confidence_idx(ocrJobId, lowConfidence),
  CONSTRAINT KOP_job_fkey FOREIGN KEY (ocrJobId) REFERENCES KnowledgeOcrJob(id) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
