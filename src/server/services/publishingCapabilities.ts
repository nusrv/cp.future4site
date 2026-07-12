import { config } from '../config.js';
import type { PublishingCapabilitiesResponse, PublishingCapability } from '../../shared/contracts.js';
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

type ExecutionSummary = {
  status?: string;
  startedAt?: string;
  stoppedAt?: string;
};

type PublishingWorkflowState = {
  available: boolean;
  active: boolean;
  credentialValidation: PublishingCapability['credentialValidation'];
  lastExecutionAt: string | null;
  lastExecutionStatus: PublishingCapability['lastExecutionStatus'];
  lastSuccessfulExecutionAt: string | null;
};

const unavailableWorkflow: PublishingWorkflowState = {
  available: false,
  active: false,
  credentialValidation: 'unknown',
  lastExecutionAt: null,
  lastExecutionStatus: null,
  lastSuccessfulExecutionAt: null
};

function executionTime(execution: ExecutionSummary | undefined) {
  return execution?.stoppedAt || execution?.startedAt || null;
}

function isRecent(timestamp: string | null) {
  if (!timestamp) return false;
  const time = Date.parse(timestamp);
  return Number.isFinite(time) && Date.now() - time <= 30 * 24 * 60 * 60 * 1000;
}

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
    const executionsResponse = await fetch(`${config.N8N_BASE_URL.replace(/\/$/, '')}/api/v1/executions?workflowId=${encodeURIComponent(workflow.id)}&limit=20`, {
      headers: { 'X-N8N-API-KEY': config.N8N_API_KEY },
      signal: controller.signal
    });
    if (!executionsResponse.ok) {
      return {
        available: true,
        active: workflow.active === true,
        credentialValidation: 'unknown',
        lastExecutionAt: null,
        lastExecutionStatus: null,
        lastSuccessfulExecutionAt: null
      };
    }
    const executionsBody = await executionsResponse.json() as { data?: ExecutionSummary[] };
    const executions = executionsBody.data ?? [];
    const lastExecution = executions[0];
    const lastSuccessfulExecution = executions.find((entry) => entry.status === 'success');
    const lastExecutionStatus = lastExecution?.status === 'success' || lastExecution?.status === 'error'
      ? lastExecution.status
      : null;
    const lastSuccessfulExecutionAt = executionTime(lastSuccessfulExecution);
    const credentialValidation: PublishingCapability['credentialValidation'] = lastExecutionStatus === 'error'
      ? 'previous_failure'
      : isRecent(lastSuccessfulExecutionAt)
        ? 'recent_success'
        : executions.length
          ? 'unknown'
          : 'not_yet_verified';
    return {
      available: true,
      active: workflow.active === true,
      credentialValidation,
      lastExecutionAt: executionTime(lastExecution),
      lastExecutionStatus,
      lastSuccessfulExecutionAt
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
    webhookConfigured,
    workflowAvailable: workflow.available,
    workflowActive: workflow.active,
    credentialValidation: workflow.credentialValidation,
    lastExecutionAt: workflow.lastExecutionAt,
    lastExecutionStatus: workflow.lastExecutionStatus,
    lastSuccessfulExecutionAt: workflow.lastSuccessfulExecutionAt
  });
}
