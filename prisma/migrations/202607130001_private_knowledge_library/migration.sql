ALTER TABLE FileObject
  ADD COLUMN fileExtension VARCHAR(191) NULL,
  ADD COLUMN declaredMimeType VARCHAR(191) NULL,
  ADD COLUMN securityStatus ENUM('PENDING', 'CLEAN', 'REJECTED', 'SCAN_UNAVAILABLE') NOT NULL DEFAULT 'PENDING';

CREATE INDEX FileObject_sha256Hash_idx ON FileObject(sha256Hash);
CREATE INDEX FileObject_securityStatus_idx ON FileObject(securityStatus);

CREATE TABLE KnowledgeDocument (
  id VARCHAR(191) NOT NULL,
  title VARCHAR(191) NOT NULL,
  category VARCHAR(191) NOT NULL,
  sourceType VARCHAR(191) NOT NULL,
  locale VARCHAR(191) NOT NULL DEFAULT 'en',
  market VARCHAR(191) NULL,
  notes TEXT NULL,
  lifecycleStatus ENUM('ACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  createdByUserId VARCHAR(191) NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,

  INDEX KnowledgeDocument_lifecycleStatus_updatedAt_idx(lifecycleStatus, updatedAt),
  INDEX KnowledgeDocument_category_idx(category),
  INDEX KnowledgeDocument_locale_idx(locale),
  INDEX KnowledgeDocument_market_idx(market),
  PRIMARY KEY (id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE KnowledgeDocumentVersion (
  id VARCHAR(191) NOT NULL,
  documentId VARCHAR(191) NOT NULL,
  fileObjectId VARCHAR(191) NOT NULL,
  versionNumber INTEGER NOT NULL,
  versionLabel VARCHAR(191) NULL,
  uploadedByUserId VARCHAR(191) NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  supersedesVersionId VARCHAR(191) NULL,
  reviewStatus ENUM('UPLOADED', 'READY_FOR_REVIEW', 'SUPERSEDED') NOT NULL DEFAULT 'UPLOADED',

  UNIQUE INDEX KnowledgeDocumentVersion_fileObjectId_key(fileObjectId),
  UNIQUE INDEX KnowledgeDocumentVersion_supersedesVersionId_key(supersedesVersionId),
  UNIQUE INDEX KnowledgeVersion_document_version_key(documentId, versionNumber),
  INDEX KnowledgeDocumentVersion_documentId_createdAt_idx(documentId, createdAt),
  INDEX KnowledgeDocumentVersion_reviewStatus_idx(reviewStatus),
  PRIMARY KEY (id)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE KnowledgeDocument
  ADD CONSTRAINT KnowledgeDocument_createdByUserId_fkey
  FOREIGN KEY (createdByUserId) REFERENCES User(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE KnowledgeDocumentVersion
  ADD CONSTRAINT KnowledgeDocumentVersion_documentId_fkey
  FOREIGN KEY (documentId) REFERENCES KnowledgeDocument(id)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT KnowledgeDocumentVersion_fileObjectId_fkey
  FOREIGN KEY (fileObjectId) REFERENCES FileObject(id)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT KnowledgeDocumentVersion_uploadedByUserId_fkey
  FOREIGN KEY (uploadedByUserId) REFERENCES User(id)
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT KnowledgeDocumentVersion_supersedesVersionId_fkey
  FOREIGN KEY (supersedesVersionId) REFERENCES KnowledgeDocumentVersion(id)
  ON DELETE RESTRICT ON UPDATE CASCADE;
