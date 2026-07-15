-- Phase 4 evidence snapshots. Existing generation stays unchanged while the feature flag is disabled.
ALTER TABLE ContentRequest ADD COLUMN locale VARCHAR(191) NOT NULL DEFAULT 'en';

CREATE TABLE KnowledgeEvidenceBundle (
  id VARCHAR(191) NOT NULL,
  contentRequestId VARCHAR(191) NOT NULL,
  automationJobId VARCHAR(191) NULL,
  resolutionId VARCHAR(64) NOT NULL,
  locale VARCHAR(191) NOT NULL,
  context JSON NOT NULL,
  claims JSON NOT NULL,
  claimCount INTEGER NOT NULL,
  createdByUserId VARCHAR(191) NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE INDEX KEB_automation_job_key(automationJobId),
  INDEX KEB_request_created_idx(contentRequestId, createdAt),
  INDEX KEB_resolution_idx(resolutionId),
  INDEX KEB_creator_created_idx(createdByUserId, createdAt),
  CONSTRAINT KEB_request_fkey FOREIGN KEY (contentRequestId) REFERENCES ContentRequest(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT KEB_job_fkey FOREIGN KEY (automationJobId) REFERENCES AutomationJob(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT KEB_creator_fkey FOREIGN KEY (createdByUserId) REFERENCES User(id) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
