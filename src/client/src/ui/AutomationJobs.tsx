import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, post } from "../api";
import { Header } from "./Dashboard";

export function AutomationJobs() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["jobs"], queryFn: () => api<any>("/api/automation/jobs") });
  const retry = useMutation({ mutationFn: (id: string) => post(`/api/automation/jobs/${id}/retry`, {}), onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }) });
  return (
    <section>
      <Header title="Automation jobs" subtitle="Track n8n requests, callbacks, mock outputs, retries, failures, and event history." />
      <div className="panel p-5 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Job</th><th>Status</th><th>Workflow</th><th>Cost</th><th>Actions</th></tr></thead>
          <tbody>{data?.jobs?.map((job: any) => <tr key={job.id}>
            <td><strong>{job.title}</strong><br /><span className="text-xs text-[var(--text-muted)]">{job.correlationId}</span></td>
            <td><span className={`badge ${job.currentStatus === "FAILED" ? "badge-fail" : "badge-ok"}`}>{job.currentStatus}</span></td>
            <td>{job.workflowName}<br /><span className="text-xs">{job.workflowVersion}</span></td>
            <td>{job.creditCost ?? 0} credits</td>
            <td>{job.currentStatus === "FAILED" ? <button className="btn btn-secondary" onClick={() => retry.mutate(job.id)}>Retry</button> : null}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

