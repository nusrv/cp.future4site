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
  credentialsConfigured: boolean;
  webhookConfigured: boolean;
  workflowAvailable: boolean;
  workflowActive: boolean;
};

export function buildPublishingCapabilities(signals: PublishingCapabilitySignals): PublishingCapabilitiesResponse {
  const configured = signals.featureEnabled && signals.credentialsConfigured && signals.webhookConfigured;
  const enabled = configured && signals.workflowAvailable && signals.workflowActive;
  let reason: string | null = null;
  if (!signals.featureEnabled || !signals.webhookConfigured) {
    reason = 'Facebook publishing configuration is incomplete.';
  } else if (!signals.workflowAvailable || !signals.workflowActive) {
    reason = 'Facebook publishing workflow is unavailable or inactive.';
  } else if (!signals.credentialsConfigured) {
    reason = 'Facebook publishing credentials have not been verified by a successful workflow execution.';
  }

  const facebook: PublishingCapability = {
    platform: 'facebook',
    enabled,
    configured,
    featureEnabled: signals.featureEnabled,
    credentialsConfigured: signals.credentialsConfigured,
    webhookConfigured: signals.webhookConfigured,
    workflowAvailable: signals.workflowAvailable,
    workflowActive: signals.workflowActive,
    supportedContentTypes: ['text_image', 'carousel'],
    reason
  };

  const instagram: PublishingCapability = {
    platform: 'instagram',
    enabled: false,
    configured: false,
    featureEnabled: false,
    credentialsConfigured: false,
    webhookConfigured: false,
    workflowAvailable: false,
    workflowActive: false,
    supportedContentTypes: [],
    reason: INSTAGRAM_UNAVAILABLE_REASON
  };

  return { platforms: [facebook, instagram] };
}
