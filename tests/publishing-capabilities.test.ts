import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildPublishingCapabilities,
  getUnavailablePublishingPlatform,
  INSTAGRAM_UNAVAILABLE_REASON,
  type PublishingCapabilitySignals
} from '../src/shared/publishingCapabilities';

const root = process.cwd();
const routeSource = fs.readFileSync(path.join(root, 'src/server/routes/content.ts'), 'utf8');
const publishingSource = fs.readFileSync(path.join(root, 'src/client/src/ui/Publishing.tsx'), 'utf8');

function readySignals(overrides: Partial<PublishingCapabilitySignals> = {}): PublishingCapabilitySignals {
  return {
    featureEnabled: true,
    webhookConfigured: true,
    workflowAvailable: true,
    workflowActive: true,
    credentialValidation: 'recent_success',
    lastExecutionAt: '2026-07-09T13:21:45.598Z',
    lastExecutionStatus: 'success',
    lastSuccessfulExecutionAt: '2026-07-09T13:21:45.598Z',
    ...overrides
  };
}

describe('publishing capabilities', () => {
  it('reports Facebook ready with explicit n8n credential ownership and execution evidence', () => {
    const facebook = buildPublishingCapabilities(readySignals()).platforms.find((entry) => entry.platform === 'facebook');
    expect(facebook).toMatchObject({
      enabled: true,
      configured: true,
      featureEnabled: true,
      credentialManagement: 'n8n',
      credentialValidation: 'recent_success',
      webhookConfigured: true,
      workflowAvailable: true,
      workflowActive: true,
      lastSuccessfulExecutionAt: '2026-07-09T13:21:45.598Z',
      supportedContentTypes: ['text_image', 'carousel'],
      reason: null,
      warning: null
    });
  });

  it.each(['featureEnabled', 'webhookConfigured', 'workflowAvailable', 'workflowActive'] as const)(
    'disables Facebook when %s is false',
    (signal) => {
      const facebook = buildPublishingCapabilities(readySignals({ [signal]: false })).platforms.find((entry) => entry.platform === 'facebook');
      expect(facebook?.enabled).toBe(false);
    }
  );

  it('keeps an active configured workflow enabled when execution history is cleared', () => {
    const facebook = buildPublishingCapabilities(readySignals({
      credentialValidation: 'not_yet_verified',
      lastExecutionAt: null,
      lastExecutionStatus: null,
      lastSuccessfulExecutionAt: null
    })).platforms.find((entry) => entry.platform === 'facebook');
    expect(facebook?.enabled).toBe(true);
    expect(facebook?.credentialManagement).toBe('n8n');
    expect(facebook?.credentialValidation).toBe('not_yet_verified');
    expect(facebook?.warning).toContain('managed by n8n');
  });

  it('reports a previous failure as degraded evidence without falsely disabling the active workflow', () => {
    const facebook = buildPublishingCapabilities(readySignals({
      credentialValidation: 'previous_failure',
      lastExecutionStatus: 'error'
    })).platforms.find((entry) => entry.platform === 'facebook');
    expect(facebook?.enabled).toBe(true);
    expect(facebook?.warning).toContain('most recent Facebook workflow execution failed');
  });

  it('always reports Instagram unavailable with no supported content types', () => {
    expect(buildPublishingCapabilities(readySignals()).platforms.find((entry) => entry.platform === 'instagram')).toEqual({
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
    });
  });

  it('returns the safe 409 contract for direct or mixed Instagram requests', () => {
    expect(getUnavailablePublishingPlatform(['instagram'])).toEqual({
      error: 'Publishing capability unavailable',
      code: 'PUBLISHING_CAPABILITY_UNAVAILABLE',
      platform: 'instagram',
      explanation: INSTAGRAM_UNAVAILABLE_REASON
    });
    expect(getUnavailablePublishingPlatform(['facebook', 'instagram'])).not.toBeNull();
    expect(getUnavailablePublishingPlatform(['facebook'])).toBeNull();
  });

  it('registers the capability endpoint without exposing sensitive configuration', () => {
    expect(routeSource).toContain('/api/content/publishing-capabilities');
    const response = buildPublishingCapabilities(readySignals());
    expect(JSON.stringify(response)).not.toMatch(/access.?token|api.?key|secret|signed.?url|webhook.?path/i);
    expect(JSON.stringify(response)).not.toContain('FUTURE_OILS_FACEBOOK_ACCESS_TOKEN');
  });

  it('rejects Instagram before any database lookup, record, job, or dispatch work', () => {
    const publishRoute = routeSource.slice(routeSource.indexOf('/api/content/items/:id/publish'));
    const guardIndex = publishRoute.indexOf('getUnavailablePublishingPlatform(input.platforms)');
    expect(guardIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(publishRoute.indexOf('prisma.contentItem.findUniqueOrThrow'));
    expect(guardIndex).toBeLessThan(publishRoute.indexOf('createAutomationJob({'));
    expect(guardIndex).toBeLessThan(publishRoute.indexOf('prisma.publishingRecord.upsert'));
    expect(guardIndex).toBeLessThan(publishRoute.indexOf('dispatchJob(job.id)'));
    expect(publishRoute).toContain('reply.code(409).send(unavailablePlatform)');
  });

  it('disables Instagram in the UI and displays the server-provided reason', () => {
    expect(publishingSource).not.toContain('const facebookAllowed = true');
    expect(publishingSource).toContain('disabled={!instagramAllowed || busy}');
    expect(publishingSource).toContain('instagramCapability?.reason');
    expect(publishingSource).toContain(INSTAGRAM_UNAVAILABLE_REASON);
  });

  it('keeps Facebook publishing on the existing job and webhook path', () => {
    expect(routeSource).toContain('jobType: `publish_${platform}`');
    expect(routeSource).toContain('workflowName: config.N8N_PUBLISH_WEBHOOK_PATH');
    expect(routeSource).toContain('dispatchJob(job.id)');
    expect(routeSource).toContain('platforms: z.array(z.enum(');
  });
});
