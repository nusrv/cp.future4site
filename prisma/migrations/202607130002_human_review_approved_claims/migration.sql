-- Phase 1B is additive. Document and KnowledgeIndex are intentionally unchanged.
ALTER TABLE KnowledgeDocumentVersion
  MODIFY reviewStatus ENUM('UPLOADED','READY_FOR_REVIEW','UNDER_REVIEW','APPROVED_SOURCE','REJECTED','SUPERSEDED') NOT NULL DEFAULT 'UPLOADED',
  ADD COLUMN reviewedByUserId VARCHAR(191) NULL,
  ADD COLUMN reviewedAt DATETIME(3) NULL,
  ADD COLUMN approvedByUserId VARCHAR(191) NULL,
  ADD COLUMN approvedAt DATETIME(3) NULL,
  ADD COLUMN rejectionReason TEXT NULL,
  ADD COLUMN reviewNotes TEXT NULL,
  ADD COLUMN supersededAt DATETIME(3) NULL,
  ADD INDEX KDV_reviewStatus_createdAt_idx(reviewStatus, createdAt),
  ADD INDEX KDV_approvedAt_idx(approvedAt),
  ADD CONSTRAINT KDV_reviewedBy_fkey FOREIGN KEY (reviewedByUserId) REFERENCES User(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT KDV_approvedBy_fkey FOREIGN KEY (approvedByUserId) REFERENCES User(id) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE Brand (
  id VARCHAR(191) NOT NULL,
  `key` VARCHAR(191) NOT NULL,
  name VARCHAR(191) NOT NULL,
  status VARCHAR(191) NOT NULL DEFAULT 'active',
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE INDEX Brand_key_key(`key`),
  UNIQUE INDEX Brand_name_key(name)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO Brand (id, `key`, name, status, createdAt, updatedAt)
VALUES ('brand-future-oils', 'future-oils', 'Future Oils', 'active', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

ALTER TABLE Product
  ADD COLUMN brandId VARCHAR(191) NULL,
  ADD INDEX Product_brandId_idx(brandId),
  ADD CONSTRAINT Product_brandId_fkey FOREIGN KEY (brandId) REFERENCES Brand(id) ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE Product SET brandId = 'brand-future-oils'
WHERE name IN ('Refined Sunflower Oil', 'Palm Olein CP10') AND brandId IS NULL;

CREATE TABLE KnowledgeDocumentVersionReview (
  id VARCHAR(191) NOT NULL,
  versionId VARCHAR(191) NOT NULL,
  actorUserId VARCHAR(191) NOT NULL,
  action VARCHAR(191) NOT NULL,
  previousStatus ENUM('UPLOADED','READY_FOR_REVIEW','UNDER_REVIEW','APPROVED_SOURCE','REJECTED','SUPERSEDED') NOT NULL,
  newStatus ENUM('UPLOADED','READY_FOR_REVIEW','UNDER_REVIEW','APPROVED_SOURCE','REJECTED','SUPERSEDED') NOT NULL,
  notes TEXT NULL,
  rejectionReason TEXT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX KDVR_version_created_idx(versionId, createdAt),
  INDEX KDVR_status_created_idx(newStatus, createdAt),
  CONSTRAINT KDVR_version_fkey FOREIGN KEY (versionId) REFERENCES KnowledgeDocumentVersion(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT KDVR_actor_fkey FOREIGN KEY (actorUserId) REFERENCES User(id) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE KnowledgeClaim (
  id VARCHAR(191) NOT NULL,
  stableKey VARCHAR(191) NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  claimType VARCHAR(191) NOT NULL,
  status ENUM('DRAFT','UNDER_REVIEW','APPROVED','REJECTED','SUPERSEDED','EXPIRED') NOT NULL DEFAULT 'DRAFT',
  usageScope ENUM('PUBLIC_SAFE','INTERNAL_ONLY','RESTRICTED') NOT NULL,
  requiredLocales JSON NOT NULL,
  effectiveAt DATETIME(3) NULL,
  expiresAt DATETIME(3) NULL,
  restrictions TEXT NULL,
  internalNotes TEXT NULL,
  rejectionReason TEXT NULL,
  reviewNotes TEXT NULL,
  createdByUserId VARCHAR(191) NOT NULL,
  lastEditedByUserId VARCHAR(191) NOT NULL,
  reviewedByUserId VARCHAR(191) NULL,
  reviewedAt DATETIME(3) NULL,
  approvedByUserId VARCHAR(191) NULL,
  approvedAt DATETIME(3) NULL,
  supersedesClaimId VARCHAR(191) NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE INDEX KnowledgeClaim_stableKey_revision_key(stableKey, revision),
  UNIQUE INDEX KnowledgeClaim_supersedesClaimId_key(supersedesClaimId),
  INDEX KnowledgeClaim_stableKey_idx(stableKey),
  INDEX KnowledgeClaim_status_updatedAt_idx(status, updatedAt),
  INDEX KnowledgeClaim_scope_status_idx(usageScope, status),
  INDEX KnowledgeClaim_effectiveAt_idx(effectiveAt),
  INDEX KnowledgeClaim_expiresAt_idx(expiresAt),
  CONSTRAINT KC_createdBy_fkey FOREIGN KEY (createdByUserId) REFERENCES User(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT KC_editedBy_fkey FOREIGN KEY (lastEditedByUserId) REFERENCES User(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT KC_reviewedBy_fkey FOREIGN KEY (reviewedByUserId) REFERENCES User(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT KC_approvedBy_fkey FOREIGN KEY (approvedByUserId) REFERENCES User(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT KC_supersedes_fkey FOREIGN KEY (supersedesClaimId) REFERENCES KnowledgeClaim(id) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE KnowledgeClaimTranslation (
  id VARCHAR(191) NOT NULL,
  claimId VARCHAR(191) NOT NULL,
  locale VARCHAR(191) NOT NULL,
  wording TEXT NOT NULL,
  reviewStatus ENUM('DRAFT','UNDER_REVIEW','APPROVED','REJECTED') NOT NULL DEFAULT 'DRAFT',
  reviewedByUserId VARCHAR(191) NULL,
  reviewedAt DATETIME(3) NULL,
  approvedByUserId VARCHAR(191) NULL,
  approvedAt DATETIME(3) NULL,
  reviewNotes TEXT NULL,
  rejectionReason TEXT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updatedAt DATETIME(3) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE INDEX KCT_claim_locale_key(claimId, locale),
  INDEX KCT_locale_status_idx(locale, reviewStatus),
  INDEX KCT_status_updated_idx(reviewStatus, updatedAt),
  CONSTRAINT KCT_claim_fkey FOREIGN KEY (claimId) REFERENCES KnowledgeClaim(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT KCT_reviewedBy_fkey FOREIGN KEY (reviewedByUserId) REFERENCES User(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT KCT_approvedBy_fkey FOREIGN KEY (approvedByUserId) REFERENCES User(id) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE KnowledgeClaimSource (
  id VARCHAR(191) NOT NULL,
  claimId VARCHAR(191) NOT NULL,
  documentVersionId VARCHAR(191) NOT NULL,
  pageNumber INTEGER NULL,
  sectionHeading VARCHAR(500) NULL,
  tableFigureReference VARCHAR(500) NULL,
  sourceExcerpt TEXT NULL,
  sourceNotes TEXT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  INDEX KCS_claimId_idx(claimId),
  INDEX KCS_version_claim_idx(documentVersionId, claimId),
  CONSTRAINT KCS_claim_fkey FOREIGN KEY (claimId) REFERENCES KnowledgeClaim(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT KCS_version_fkey FOREIGN KEY (documentVersionId) REFERENCES KnowledgeDocumentVersion(id) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE KnowledgeClaimBrand (
  claimId VARCHAR(191) NOT NULL,
  brandId VARCHAR(191) NOT NULL,
  PRIMARY KEY (claimId, brandId),
  INDEX KCB_brand_claim_idx(brandId, claimId),
  CONSTRAINT KCB_claim_fkey FOREIGN KEY (claimId) REFERENCES KnowledgeClaim(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT KCB_brand_fkey FOREIGN KEY (brandId) REFERENCES Brand(id) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE KnowledgeClaimProduct (
  claimId VARCHAR(191) NOT NULL,
  productId VARCHAR(191) NOT NULL,
  PRIMARY KEY (claimId, productId),
  INDEX KCP_product_claim_idx(productId, claimId),
  CONSTRAINT KCP_claim_fkey FOREIGN KEY (claimId) REFERENCES KnowledgeClaim(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT KCP_product_fkey FOREIGN KEY (productId) REFERENCES Product(id) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE KnowledgeClaimPackagingFormat (
  claimId VARCHAR(191) NOT NULL,
  packagingFormatId VARCHAR(191) NOT NULL,
  PRIMARY KEY (claimId, packagingFormatId),
  INDEX KCPF_packaging_claim_idx(packagingFormatId, claimId),
  CONSTRAINT KCPF_claim_fkey FOREIGN KEY (claimId) REFERENCES KnowledgeClaim(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT KCPF_packaging_fkey FOREIGN KEY (packagingFormatId) REFERENCES PackagingFormat(id) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE KnowledgeClaimMarket (
  id VARCHAR(191) NOT NULL,
  claimId VARCHAR(191) NOT NULL,
  value VARCHAR(191) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE INDEX KCM_claim_value_key(claimId, value),
  INDEX KCM_value_claim_idx(value, claimId),
  CONSTRAINT KCM_claim_fkey FOREIGN KEY (claimId) REFERENCES KnowledgeClaim(id) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE KnowledgeClaimAudience (
  id VARCHAR(191) NOT NULL,
  claimId VARCHAR(191) NOT NULL,
  value VARCHAR(191) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE INDEX KCA_claim_value_key(claimId, value),
  INDEX KCA_value_claim_idx(value, claimId),
  CONSTRAINT KCA_claim_fkey FOREIGN KEY (claimId) REFERENCES KnowledgeClaim(id) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE KnowledgeClaimObjective (
  id VARCHAR(191) NOT NULL,
  claimId VARCHAR(191) NOT NULL,
  value VARCHAR(191) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE INDEX KCO_claim_value_key(claimId, value),
  INDEX KCO_value_claim_idx(value, claimId),
  CONSTRAINT KCO_claim_fkey FOREIGN KEY (claimId) REFERENCES KnowledgeClaim(id) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
