-- Phase 2A deterministic extraction. Additive; approved claims and legacy KnowledgeIndex are unchanged.
CREATE TABLE KnowledgeDocumentExtraction (
  id VARCHAR(191) NOT NULL,
  documentVersionId VARCHAR(191) NOT NULL,
  requestedByUserId VARCHAR(191) NOT NULL,
  status ENUM('RUNNING','SUCCEEDED','FAILED','UNSUPPORTED') NOT NULL DEFAULT 'RUNNING',
  extractorName VARCHAR(191) NOT NULL,
  extractorVersion VARCHAR(191) NOT NULL,
  sourceSha256 VARCHAR(64) NOT NULL,
  contentHash VARCHAR(64) NULL,
  pageCount INTEGER NULL,
  fragmentCount INTEGER NOT NULL DEFAULT 0,
  characterCount INTEGER NOT NULL DEFAULT 0,
  errorCode VARCHAR(120) NULL,
  errorMessage TEXT NULL,
  startedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completedAt DATETIME(3) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX KDE_version_created_idx(documentVersionId, createdAt),
  INDEX KDE_status_created_idx(status, createdAt),
  INDEX KDE_requester_created_idx(requestedByUserId, createdAt),
  CONSTRAINT KDE_version_fkey FOREIGN KEY (documentVersionId) REFERENCES KnowledgeDocumentVersion(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT KDE_requester_fkey FOREIGN KEY (requestedByUserId) REFERENCES User(id) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE KnowledgeExtractionFragment (
  id VARCHAR(191) NOT NULL,
  extractionId VARCHAR(191) NOT NULL,
  ordinal INTEGER NOT NULL,
  pageNumber INTEGER NULL,
  sectionHeading VARCHAR(500) NULL,
  content LONGTEXT NOT NULL,
  contentHash VARCHAR(64) NOT NULL,
  characterCount INTEGER NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE INDEX KEF_extraction_ordinal_key(extractionId, ordinal),
  INDEX KEF_extraction_page_idx(extractionId, pageNumber),
  CONSTRAINT KEF_extraction_fkey FOREIGN KEY (extractionId) REFERENCES KnowledgeDocumentExtraction(id) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
