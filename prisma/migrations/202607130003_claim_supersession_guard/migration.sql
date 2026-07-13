-- Additive Phase 1B correction. The direct revision chain and approved replacement target are distinct.
ALTER TABLE KnowledgeClaim
  ADD COLUMN replacesApprovedClaimId VARCHAR(191) NULL,
  ADD INDEX KnowledgeClaim_replacement_status_idx(replacesApprovedClaimId, status),
  ADD CONSTRAINT KC_replacesApproved_fkey
    FOREIGN KEY (replacesApprovedClaimId) REFERENCES KnowledgeClaim(id)
    ON DELETE RESTRICT ON UPDATE CASCADE;
