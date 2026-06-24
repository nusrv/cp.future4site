-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
    `failedLoginCount` INTEGER NOT NULL DEFAULT 0,
    `lockedUntil` DATETIME(3) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,

    UNIQUE INDEX `Role_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permission` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,

    UNIQUE INDEX `Permission_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserRole` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `UserRole_userId_roleId_key`(`userId`, `roleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'REVOKED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Session_tokenHash_key`(`tokenHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditEvent` (
    `id` VARCHAR(191) NOT NULL,
    `actorUserId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `summary` TEXT NOT NULL,
    `metadata` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditEvent_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `AuditEvent_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IntegrationSetting` (
    `id` VARCHAR(191) NOT NULL,
    `service` VARCHAR(191) NOT NULL,
    `mode` ENUM('MOCK', 'DRY_RUN', 'LIVE') NOT NULL DEFAULT 'MOCK',
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `reference` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'not_configured',
    `lastCheckedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AutomationJob` (
    `id` VARCHAR(191) NOT NULL,
    `jobType` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `relatedEntityType` VARCHAR(191) NULL,
    `relatedEntityId` VARCHAR(191) NULL,
    `contentRequestId` VARCHAR(191) NULL,
    `requestedByUserId` VARCHAR(191) NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'normal',
    `workflowName` VARCHAR(191) NOT NULL,
    `workflowVersion` VARCHAR(191) NOT NULL DEFAULT 'mock-v1',
    `inputPayload` JSON NOT NULL,
    `currentStatus` ENUM('DRAFT', 'QUEUED', 'SUBMITTED', 'RUNNING', 'WAITING_FOR_EXTERNAL_SERVICE', 'WAITING_FOR_CALLBACK', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED', 'RETRY_SCHEDULED', 'AWAITING_HUMAN_REVIEW', 'REVISION_REQUESTED', 'APPROVED_INTERNAL', 'APPROVED_FOR_PUBLICATION', 'REJECTED', 'CANCEL_REQUESTED', 'CANCELLED', 'ARCHIVED') NOT NULL DEFAULT 'QUEUED',
    `currentStep` VARCHAR(191) NULL,
    `n8nExecutionId` VARCHAR(191) NULL,
    `externalService` VARCHAR(191) NULL,
    `externalCreationId` VARCHAR(191) NULL,
    `outputPayload` JSON NULL,
    `errorCode` VARCHAR(191) NULL,
    `errorMessage` TEXT NULL,
    `retryCount` INTEGER NOT NULL DEFAULT 0,
    `maxRetries` INTEGER NOT NULL DEFAULT 3,
    `creditCost` INTEGER NULL,
    `moneyCost` DECIMAL(10, 2) NULL,
    `humanReviewStatus` VARCHAR(191) NOT NULL DEFAULT 'not_required',
    `approvalId` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `correlationId` VARCHAR(191) NOT NULL,
    `archiveStatus` VARCHAR(191) NOT NULL DEFAULT 'active',
    `visibilityScope` ENUM('PUBLIC_SAFE', 'INTERNAL', 'RESTRICTED', 'SUPPLIER_CONFIDENTIAL') NOT NULL DEFAULT 'INTERNAL',
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AutomationJob_idempotencyKey_key`(`idempotencyKey`),
    UNIQUE INDEX `AutomationJob_correlationId_key`(`correlationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AutomationJobEvent` (
    `id` VARCHAR(191) NOT NULL,
    `jobId` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `previousStatus` ENUM('DRAFT', 'QUEUED', 'SUBMITTED', 'RUNNING', 'WAITING_FOR_EXTERNAL_SERVICE', 'WAITING_FOR_CALLBACK', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED', 'RETRY_SCHEDULED', 'AWAITING_HUMAN_REVIEW', 'REVISION_REQUESTED', 'APPROVED_INTERNAL', 'APPROVED_FOR_PUBLICATION', 'REJECTED', 'CANCEL_REQUESTED', 'CANCELLED', 'ARCHIVED') NULL,
    `newStatus` ENUM('DRAFT', 'QUEUED', 'SUBMITTED', 'RUNNING', 'WAITING_FOR_EXTERNAL_SERVICE', 'WAITING_FOR_CALLBACK', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED', 'RETRY_SCHEDULED', 'AWAITING_HUMAN_REVIEW', 'REVISION_REQUESTED', 'APPROVED_INTERNAL', 'APPROVED_FOR_PUBLICATION', 'REJECTED', 'CANCEL_REQUESTED', 'CANCELLED', 'ARCHIVED') NULL,
    `actorType` VARCHAR(191) NOT NULL DEFAULT 'platform',
    `actorId` VARCHAR(191) NULL,
    `message` TEXT NOT NULL,
    `payloadSummary` JSON NULL,
    `retryNumber` INTEGER NOT NULL DEFAULT 0,
    `externalReference` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AutomationJobEvent_jobId_createdAt_idx`(`jobId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Organization` (
    `id` VARCHAR(191) NOT NULL,
    `legalName` VARCHAR(191) NOT NULL,
    `displayName` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `market` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `notes` TEXT NULL,
    `synthetic` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrganizationRole` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `OrganizationRole_organizationId_role_key`(`organizationId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contact` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `whatsapp` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `synthetic` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Lead` (
    `id` VARCHAR(191) NOT NULL,
    `sourceLeadId` VARCHAR(191) NULL,
    `organizationId` VARCHAR(191) NULL,
    `contactId` VARCHAR(191) NULL,
    `leadType` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `status` VARCHAR(191) NOT NULL DEFAULT 'new',
    `quality` VARCHAR(191) NOT NULL DEFAULT 'unreviewed',
    `firstTouchDueAt` DATETIME(3) NULL,
    `firstTouchDoneAt` DATETIME(3) NULL,
    `ownerUserId` VARCHAR(191) NULL,
    `rawPayload` JSON NULL,
    `rawPayloadRestricted` BOOLEAN NOT NULL DEFAULT true,
    `synthetic` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Lead_sourceLeadId_key`(`sourceLeadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Inquiry` (
    `id` VARCHAR(191) NOT NULL,
    `leadId` VARCHAR(191) NULL,
    `organizationId` VARCHAR(191) NULL,
    `inquiryType` VARCHAR(191) NOT NULL,
    `product` VARCHAR(191) NULL,
    `quantity` VARCHAR(191) NULL,
    `quantityUnit` VARCHAR(191) NULL,
    `packaging` VARCHAR(191) NULL,
    `destination` VARCHAR(191) NULL,
    `incoterms` VARCHAR(191) NULL,
    `paymentTerms` VARCHAR(191) NULL,
    `certifications` VARCHAR(191) NULL,
    `message` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'received',
    `synthetic` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CustomerProfile` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'prospect',
    `market` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `synthetic` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `CustomerProfile_organizationId_key`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupplierProfile` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `verificationStatus` VARCHAR(191) NOT NULL DEFAULT 'unreviewed',
    `productOffered` VARCHAR(191) NULL,
    `monthlyCapacityMt` VARCHAR(191) NULL,
    `originCountry` VARCHAR(191) NULL,
    `certifications` TEXT NULL,
    `internalNotes` TEXT NULL,
    `visibilityScope` ENUM('PUBLIC_SAFE', 'INTERNAL', 'RESTRICTED', 'SUPPLIER_CONFIDENTIAL') NOT NULL DEFAULT 'SUPPLIER_CONFIDENTIAL',
    `synthetic` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `SupplierProfile_organizationId_key`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Deal` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'open',
    `stage` VARCHAR(191) NOT NULL DEFAULT 'lead_review',
    `ownerUserId` VARCHAR(191) NULL,
    `nextAction` VARCHAR(191) NULL,
    `nextActionDueAt` DATETIME(3) NULL,
    `synthetic` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DealStage` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `DealStage_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DealStageHistory` (
    `id` VARCHAR(191) NOT NULL,
    `dealId` VARCHAR(191) NOT NULL,
    `stage` VARCHAR(191) NOT NULL,
    `reason` TEXT NULL,
    `enteredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DealLineItem` (
    `id` VARCHAR(191) NOT NULL,
    `dealId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NULL,
    `description` TEXT NULL,
    `quantity` VARCHAR(191) NULL,
    `unit` VARCHAR(191) NULL,
    `packaging` VARCHAR(191) NULL,
    `destination` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'requested',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Task` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `relatedType` VARCHAR(191) NULL,
    `relatedId` VARCHAR(191) NULL,
    `ownerUserId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'open',
    `dueAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `synthetic` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Document` (
    `id` VARCHAR(191) NOT NULL,
    `documentType` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `fileId` VARCHAR(191) NULL,
    `relatedType` VARCHAR(191) NULL,
    `relatedId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `visibilityScope` ENUM('PUBLIC_SAFE', 'INTERNAL', 'RESTRICTED', 'SUPPLIER_CONFIDENTIAL') NOT NULL DEFAULT 'RESTRICTED',
    `synthetic` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Product` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'active',
    `tdsStatus` VARCHAR(191) NOT NULL DEFAULT 'not_found',
    `publicMarketingAllowed` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PackagingFormat` (
    `id` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'approved',
    `visualAssetStatus` VARCHAR(191) NOT NULL DEFAULT 'missing',

    UNIQUE INDEX `PackagingFormat_label_key`(`label`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KnowledgeIndex` (
    `id` VARCHAR(191) NOT NULL,
    `claimId` VARCHAR(191) NOT NULL,
    `approvedWording` TEXT NOT NULL,
    `sourceFile` VARCHAR(191) NOT NULL,
    `sourceSection` VARCHAR(191) NOT NULL,
    `contentHash` VARCHAR(191) NULL,
    `verificationStatus` VARCHAR(191) NOT NULL DEFAULT 'verified',
    `visibilityScope` ENUM('PUBLIC_SAFE', 'INTERNAL', 'RESTRICTED', 'SUPPLIER_CONFIDENTIAL') NOT NULL DEFAULT 'PUBLIC_SAFE',
    `restrictions` TEXT NULL,
    `lastSyncedAt` DATETIME(3) NULL,
    `conflictState` VARCHAR(191) NOT NULL DEFAULT 'none',
    `synthetic` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `KnowledgeIndex_claimId_key`(`claimId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Campaign` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `brand` VARCHAR(191) NOT NULL,
    `businessLine` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `synthetic` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContentRequest` (
    `id` VARCHAR(191) NOT NULL,
    `topic` TEXT NOT NULL,
    `brand` VARCHAR(191) NOT NULL,
    `businessLine` VARCHAR(191) NOT NULL,
    `product` VARCHAR(191) NULL,
    `market` VARCHAR(191) NULL,
    `audience` VARCHAR(191) NULL,
    `objective` TEXT NULL,
    `channel` VARCHAR(191) NULL,
    `format` VARCHAR(191) NOT NULL,
    `cta` VARCHAR(191) NULL,
    `internalNotes` TEXT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'GENERATING', 'WAITING_FOR_EXTERNAL_SERVICE', 'GENERATION_COMPLETED', 'AWAITING_REVIEW', 'REVISION_REQUESTED', 'APPROVED_INTERNAL', 'APPROVED_PUBLICATION', 'REJECTED', 'ARCHIVED', 'FAILED') NOT NULL DEFAULT 'DRAFT',
    `requestedPublishingChannels` JSON NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `synthetic` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContentItem` (
    `id` VARCHAR(191) NOT NULL,
    `contentRequestId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `headline` VARCHAR(191) NULL,
    `caption` TEXT NULL,
    `cta` VARCHAR(191) NULL,
    `hashtags` TEXT NULL,
    `status` ENUM('DRAFT', 'SUBMITTED', 'GENERATING', 'WAITING_FOR_EXTERNAL_SERVICE', 'GENERATION_COMPLETED', 'AWAITING_REVIEW', 'REVISION_REQUESTED', 'APPROVED_INTERNAL', 'APPROVED_PUBLICATION', 'REJECTED', 'ARCHIVED', 'FAILED') NOT NULL DEFAULT 'GENERATION_COMPLETED',
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreativeAsset` (
    `id` VARCHAR(191) NOT NULL,
    `contentRequestId` VARCHAR(191) NULL,
    `fileId` VARCHAR(191) NULL,
    `assetType` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `approvalStatus` VARCHAR(191) NOT NULL DEFAULT 'not_approved',
    `sourceTool` VARCHAR(191) NOT NULL DEFAULT 'mock',
    `metadata` JSON NULL,
    `visibilityScope` ENUM('PUBLIC_SAFE', 'INTERNAL', 'RESTRICTED', 'SUPPLIER_CONFIDENTIAL') NOT NULL DEFAULT 'INTERNAL',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FileObject` (
    `id` VARCHAR(191) NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `originalName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `sha256Hash` VARCHAR(191) NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `durationSeconds` INTEGER NULL,
    `assetType` VARCHAR(191) NOT NULL,
    `visibilityScope` ENUM('PUBLIC_SAFE', 'INTERNAL', 'RESTRICTED', 'SUPPLIER_CONFIDENTIAL') NOT NULL DEFAULT 'INTERNAL',
    `approvalStatus` VARCHAR(191) NOT NULL DEFAULT 'not_approved',
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdByUserId` VARCHAR(191) NULL,
    `synthetic` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `FileObject_storageKey_key`(`storageKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Approval` (
    `id` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `approvalType` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'requested',
    `requestedByUserId` VARCHAR(191) NULL,
    `decidedByUserId` VARCHAR(191) NULL,
    `decisionNotes` TEXT NULL,
    `decidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PublishingRecord` (
    `id` VARCHAR(191) NOT NULL,
    `contentItemId` VARCHAR(191) NOT NULL,
    `platform` ENUM('FACEBOOK', 'INSTAGRAM') NOT NULL,
    `status` ENUM('DRAFT', 'DRY_RUN', 'QUEUED', 'PUBLISHED', 'PARTIAL_SUCCESS', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `mode` ENUM('MOCK', 'DRY_RUN', 'LIVE') NOT NULL DEFAULT 'MOCK',
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `automationJobId` VARCHAR(191) NULL,
    `requestedByUserId` VARCHAR(191) NULL,
    `approvedByUserId` VARCHAR(191) NULL,
    `platformPostId` VARCHAR(191) NULL,
    `platformUrl` VARCHAR(191) NULL,
    `publishedAt` DATETIME(3) NULL,
    `warnings` JSON NULL,
    `errors` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PublishingRecord_idempotencyKey_key`(`idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditEvent` ADD CONSTRAINT `AuditEvent_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutomationJobEvent` ADD CONSTRAINT `AutomationJobEvent_jobId_fkey` FOREIGN KEY (`jobId`) REFERENCES `AutomationJob`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrganizationRole` ADD CONSTRAINT `OrganizationRole_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contact` ADD CONSTRAINT `Contact_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Lead` ADD CONSTRAINT `Lead_contactId_fkey` FOREIGN KEY (`contactId`) REFERENCES `Contact`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Inquiry` ADD CONSTRAINT `Inquiry_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `Lead`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Inquiry` ADD CONSTRAINT `Inquiry_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CustomerProfile` ADD CONSTRAINT `CustomerProfile_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupplierProfile` ADD CONSTRAINT `SupplierProfile_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Deal` ADD CONSTRAINT `Deal_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DealStageHistory` ADD CONSTRAINT `DealStageHistory_dealId_fkey` FOREIGN KEY (`dealId`) REFERENCES `Deal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DealLineItem` ADD CONSTRAINT `DealLineItem_dealId_fkey` FOREIGN KEY (`dealId`) REFERENCES `Deal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContentItem` ADD CONSTRAINT `ContentItem_contentRequestId_fkey` FOREIGN KEY (`contentRequestId`) REFERENCES `ContentRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreativeAsset` ADD CONSTRAINT `CreativeAsset_contentRequestId_fkey` FOREIGN KEY (`contentRequestId`) REFERENCES `ContentRequest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PublishingRecord` ADD CONSTRAINT `PublishingRecord_contentItemId_fkey` FOREIGN KEY (`contentItemId`) REFERENCES `ContentItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

