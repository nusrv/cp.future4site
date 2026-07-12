import type { PublishPlatform, PublishingCapabilitiesResponse, PublishingCapability } from './contracts.js';

export const INSTAGRAM_UNAVAILABLE_REASON = 'Instagram publishing is not configured yet.';

export type PublishingCapabilityErrorResponse = {
  error: 'Publishing capability unavailable';
  code: 'PUBLISHING_CAPABILITY_UNAVAILABLE';
  platform: PublishPlatform;
  explanation: string;
};

export function getUnavailablePublishingPlatform(platforms: PublishPlatform[]): PublishingCapabilityErrorResponse | null {
  if (!platforms.includes('instagram')) return null;
  return {
    error: 'Publishing capability unavailable',
    code: 'PUBLISHING_CAPABILITY_UNAVAILABLE',
    platform: 'instagram',
    explanation: INSTAGRAM_UNAVAILABLE_REASON
  };
}

export type PublishingCapabilitySignals = {
  featureEnabled: boolean;
  webhookConfigured: boolean;
  workflowAvailable: boolean;
  workflowActive: boolean;
  credentialValidation: PublishingCapability['credentialValidation'];
  lastExecutionAt: string | null;
  lastExecutionStatus: PublishingCapability['lastExecutionStatus'];
  lastSuccessfulExecutionAt: string | null;
};

export function buildPublishingCapabilities(signals: PublishingCapabilitySignals): PublishingCapabilitiesResponse {
  const configured = signals.featureEnabled && signals.webhookConfigured;
  const enabled = configured && signals.workflowAvailable && signals.workflowActive;
  let reason: string | null = null;
  if (!signals.featureEnabled || !signals.webhookConfigured) {
    reason = 'Facebook publishing configuration is incomplete.';
  } else if (!signals.workflowAvailable || !signals.workflowActive) {
    reason = 'Facebook publishing workflow is unavailable or inactive.';
  }
  const warning = enabled && signals.credentialValidation === 'previous_failure'
    ? 'The most recent Facebook workflow execution failed. Credentials remain managed by n8n.'
    : enabled && signals.credentialValidation === 'not_yet_verified'
      ? 'Facebook credentials are managed by n8n and have not yet been verified by retained execution history.'
      : enabled && signals.credentialValidation === 'unknown'
        ? 'Facebook execution history could not be checked. Credentials remain managed by n8n.'
        : null;

  const facebook: PublishingCapability = {
    platform: 'facebook',
    enabled,
    configured,
    featureEnabled: signals.featureEnabled,
    credentialManagement: 'n8n',
    credentialValidation: signals.credentialValidation,
    webhookConfigured: signals.webhookConfigured,
    workflowAvailable: signals.workflowAvailable,
    workflowActive: signals.workflowActive,
    lastExecutionAt: signals.lastExecutionAt,
    lastExecutionStatus: signals.lastExecutionStatus,
    lastSuccessfulExecutionAt: signals.lastSuccessfulExecutionAt,
    supportedContentTypes: ['text_image', 'carousel'],
    reason,
    warning
  };

  const instagram: PublishingCapability = {
    platform: 'instagram',
    enabled: false,
    configured: false,
    featureEnabled: false,
    credentialManagement: 'n8n',
    credentialValidation: 'not_yet_verified',
    webhookConfigured: false,
    workflowAvailable: false,
    workflowActive: false,
    lastExecutionAt: null,
    lastExecutionStatus: null,
    lastSuccessfulExecutionAt: null,
    supportedContentTypes: [],
    reason: INSTAGRAM_UNAVAILABLE_REASON,
    warning: null
  };

  return { platforms: [facebook, instagram] };
}
