import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildPublishingCapabilities,
  getUnavailablePublishingPlatform,
  INSTAGRAM_UNAVAILABLE_REASON
} from '../src/shared/publishingCapabilities';

const root = process.cwd();
const routeSource = fs.readFileSync(path.join(root, 'src/server/routes/content.ts'), 'utf8');
const publishingSource = fs.readFileSync(path.join(root, 'src/client/src/ui/Publishing.tsx'), 'utf8');

describe('publishing capabilities', () => {
  it('reports Facebook available only when every required signal is satisfied', () => {
    const response = buildPublishingCapabilities({
      featureEnabled: true,
      credentialsConfigured: true,
      webhookConfigured: true,
      workflowAvailable: true,
      workflowActive: true
    });
    const facebook = response.platforms.find((entry) => entry.platform === 'facebook');

    expect(facebook).toMatchObject({
      enabled: true,
      configured: true,
      featureEnabled: true,
      credentialsConfigured: true,
      webhookConfigured: true,
      workflowAvailable: true,
      workflowActive: true,
      supportedContentTypes: ['text_image', 'carousel'],
      reason: null
    });
  });

  it.each([
    'featureEnabled',
    'credentialsConfigured',
    'webhookConfigured',
    'workflowAvailable',
    'workflowActive'
  ] as const)('disables Facebook when %s is false', (signal) => {
    const response = buildPublishingCapabilities({
      featureEnabled: true,
      credentialsConfigured: true,
      webhookConfigured: true,
      workflowAvailable: true,
      workflowActive: true,
      [signal]: false
    });
    expect(response.platforms.find((entry) => entry.platform === 'facebook')?.enabled).toBe(false);
  });

  it('always reports Instagram unavailable with no supported content types', () => {
    const response = buildPublishingCapabilities({
      featureEnabled: true,
      credentialsConfigured: true,
      webhookConfigured: true,
      workflowAvailable: true,
      workflowActive: true
    });
    expect(response.platforms.find((entry) => entry.platform === 'instagram')).toEqual({
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
    expect(routeSource).toContain('app.get(/api/content/publishing-capabilities');
    const response = buildPublishingCapabilities({
      featureEnabled: true,
      credentialsConfigured: true,
      webhookConfigured: true,
      workflowAvailable: true,
      workflowActive: true
    });
    expect(JSON.stringify(response)).not.toMatch(/access.?token|api.?key|secret|signed.?url|webhook.?path/i);
  });

  it('rejects Instagram before any database lookup, record, job, or dispatch work', () => {
    const publishRoute = routeSource.slice(routeSource.indexOf('app.post(/api/content/items/:id/publish'));
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
    expect(routeSource).toContain('platforms: z.array(z.enum([facebook, instagram])).min(1)');
  });
});
