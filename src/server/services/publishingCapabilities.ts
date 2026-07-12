import { config } from '../config.js';
import type { PublishingCapabilitiesResponse } from '../../shared/contracts.js';
import { buildPublishingCapabilities } from '../../shared/publishingCapabilities.js';

export const FACEBOOK_WORKFLOW_NAME = 'FF Admin - Facebook Publishing';

type WorkflowSummary = {
  id?: string;
  name?: string;
  active?: boolean;
};

type WorkflowListResponse = {
  data?: WorkflowSummary[];
  nextCursor?: string;
};

type PublishingWorkflowState = {
  available: boolean;
  active: boolean;
  hasSuccessfulExecution: boolean;
};

const unavailableWorkflow: PublishingWorkflowState = {
  available: false,
  active: false,
  hasSuccessfulExecution: false
};

async function getWorkflowState(workflowName: string): Promise<PublishingWorkflowState> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const workflows: WorkflowSummary[] = [];
    let cursor: string | undefined;
    do {
      const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
      const response = await fetch(`${config.N8N_BASE_URL.replace(/\/$/, '')}/api/v1/workflows${query}`, {
        headers: { 'X-N8N-API-KEY': config.N8N_API_KEY },
        signal: controller.signal
      });
      if (!response.ok) return unavailableWorkflow;
      const body = await response.json() as WorkflowListResponse;
      workflows.push(...(body.data ?? []));
      cursor = body.nextCursor;
    } while (cursor);

    const workflow = workflows.find((entry) => entry.name === workflowName);
    if (!workflow?.id) return unavailableWorkflow;
    const executionsResponse = await fetch(`${config.N8N_BASE_URL.replace(/\/$/, '')}/api/v1/executions?workflowId=${encodeURIComponent(workflow.id)}&status=success&limit=1`, {
      headers: { 'X-N8N-API-KEY': config.N8N_API_KEY },
      signal: controller.signal
    });
    const executionsBody = executionsResponse.ok
      ? await executionsResponse.json() as { data?: unknown[] }
      : { data: [] };
    return {
      available: true,
      active: workflow.active === true,
      hasSuccessfulExecution: Boolean(executionsBody.data?.length)
    };
  } catch {
    return unavailableWorkflow;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getPublishingCapabilities(): Promise<PublishingCapabilitiesResponse> {
  const featureEnabled = config.INTEGRATION_MODE === 'live'
    && config.N8N_LIVE_ENABLED
    && config.META_PUBLISHING_ENABLED;
  const webhookConfigured = Boolean(config.N8N_BASE_URL)
    && Boolean(config.N8N_API_KEY)
    && Boolean(config.N8N_WEBHOOK_SECRET)
    && Boolean(config.N8N_PUBLISH_WEBHOOK_PATH);
  const workflow = featureEnabled && webhookConfigured
    ? await getWorkflowState(FACEBOOK_WORKFLOW_NAME)
    : unavailableWorkflow;

  return buildPublishingCapabilities({
    featureEnabled,
    credentialsConfigured: workflow.hasSuccessfulExecution,
    webhookConfigured,
    workflowAvailable: workflow.available,
    workflowActive: workflow.active
  });
}
