import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, post } from "../api";
import { Header } from "./Dashboard";

export function Publishing() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["content"], queryFn: () => api<any>("/api/content/requests") });
  const publish = useMutation({ mutationFn: ({ id, platforms, dryRun }: any) => post(`/api/content/items/${id}/publish`, { platforms, dryRun }), onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }) });
  const approved = data?.requests?.filter((r: any) => r.status === "APPROVED_PUBLICATION" && r.items?.[0]) ?? [];
  return (
    <section>
      <Header title="Publishing control" subtitle="Generation and approval are separate from Facebook and Instagram publishing jobs." />
      <div className="space-y-4">
        {approved.length === 0 ? <div className="panel p-6">No content is approved for publication.</div> : null}
        {approved.map((req: any) => <article className="panel p-5" key={req.id}>
          <h2 className="text-xl font-black">{req.topic}</h2>
          <p className="text-sm text-[var(--text-muted)] mt-1 whitespace-pre-line leading-6">{req.items[0].caption}</p>
          {req.items[0].hashtags ? <p className="mt-2 text-xs font-bold text-[var(--olive)]">{req.items[0].hashtags}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn btn-secondary" onClick={() => publish.mutate({ id: req.items[0].id, platforms: ["facebook"], dryRun: true })}>Dry-run Facebook</button>
            <button className="btn btn-secondary" onClick={() => publish.mutate({ id: req.items[0].id, platforms: ["instagram"], dryRun: true })}>Dry-run Instagram</button>
            <button className="btn btn-primary" onClick={() => publish.mutate({ id: req.items[0].id, platforms: ["facebook"], dryRun: false })}>Publish to Facebook</button>
            <button className="btn btn-primary" onClick={() => publish.mutate({ id: req.items[0].id, platforms: ["instagram"], dryRun: false })}>Publish to Instagram</button>
            <button className="btn btn-primary" onClick={() => publish.mutate({ id: req.items[0].id, platforms: ["facebook", "instagram"], dryRun: false })}>Publish to both</button>
          </div>
        </article>)}
      </div>
    </section>
  );
}

