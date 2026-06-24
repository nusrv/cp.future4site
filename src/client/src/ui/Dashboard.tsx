import { useQuery } from "@tanstack/react-query";
import { api } from "../api";

export function Dashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard"], queryFn: () => api<any>("/api/dashboard") });
  const metrics = data?.metrics ?? {};
  return (
    <section>
      <Header title="Operational dashboard" subtitle="Synthetic-safe view of leads, tasks, content, publishing, and automation." />
      {isLoading ? <div className="card">Loading dashboard</div> : null}
      {error ? <div className="card text-red-700">{error.message}</div> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric label="New leads" value={metrics.newLeads ?? 0} />
        <Metric label="Overdue tasks" value={metrics.overdueTasks ?? 0} />
        <Metric label="Content awaiting review" value={metrics.contentAwaitingReview ?? 0} />
        <Metric label="Failed jobs" value={metrics.failedJobs ?? 0} danger />
        <Metric label="Publishing records" value={metrics.publishingRecords ?? 0} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3 mt-5">
        <div className="panel p-5 lg:col-span-2">
          <h2 className="font-black text-xl">Integration mode</h2>
          <p className="text-sm text-[var(--text-muted)] mt-2">The initial platform is designed to run in Mock and Dry-run before live external services are enabled.</p>
          <div className="mt-4 flex gap-2 flex-wrap">
            <span className="badge badge-mock">Mock supported</span>
            <span className="badge badge-dry">Dry-run supported</span>
            <span className="badge badge-live">Live gated by env</span>
          </div>
        </div>
        <div className="panel p-5">
          <h2 className="font-black text-xl">Safety gates</h2>
          <ul className="mt-3 text-sm text-[var(--text-muted)] space-y-2">
            <li>No public registration.</li>
            <li>No browser-side n8n credentials.</li>
            <li>No automatic publishing.</li>
            <li>Supplier data is restricted.</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <div className="text-sm font-black text-brand-700">Internal platform</div>
      <h1 className="text-4xl font-black tracking-tight">{title}</h1>
      {subtitle ? <p className="text-[var(--text-muted)] mt-2 max-w-3xl">{subtitle}</p> : null}
    </div>
  );
}

function Metric({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="panel p-5">
      <div className="text-sm text-[var(--text-muted)] font-bold">{label}</div>
      <div className={`text-4xl font-black mt-3 ${danger && value > 0 ? "text-red-700" : ""}`}>{value}</div>
    </div>
  );
}

