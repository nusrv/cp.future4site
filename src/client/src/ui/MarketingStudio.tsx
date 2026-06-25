import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, post } from "../api";
import { Header } from "./Dashboard";

export function MarketingStudio() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["content"], queryFn: () => api<any>("/api/content/requests") });
  const create = useMutation({ mutationFn: (body: any) => post<any>("/api/content/requests", body), onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }) });
  const generate = useMutation({ mutationFn: (id: string) => post(`/api/content/requests/${id}/generate`, {}), onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }) });
  const review = useMutation({ mutationFn: ({ id, decision }: any) => post(`/api/content/requests/${id}/review`, { decision }), onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }) });

  const requests = data?.requests ?? [];
  const activeRequests = requests.filter((req: any) => req.status !== "REJECTED" && req.status !== "ARCHIVED");
  const rejectedRequests = requests.filter((req: any) => req.status === "REJECTED");

  return (
    <section>
      <Header title="Marketing Studio" subtitle="Create content requests, run generation, review outputs, and keep approval separate from publishing." />
      <div className="grid gap-5 xl:grid-cols-[430px_1fr]">
        <form className="panel p-5 space-y-3" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          create.mutate({
            topic: String(form.get("topic")),
            brand: String(form.get("brand")),
            businessLine: String(form.get("businessLine")),
            product: String(form.get("product")),
            market: String(form.get("market")),
            audience: String(form.get("audience")),
            objective: String(form.get("objective")),
            channel: String(form.get("channel")),
            format: String(form.get("format")),
            cta: String(form.get("cta")),
            internalNotes: String(form.get("internalNotes")),
            requestedPublishingChannels: ["facebook", "instagram"]
          });
          event.currentTarget.reset();
        }}>
          <h2 className="font-black text-xl">New content request</h2>
          <Area name="topic" label="Topic or instruction" />
          <div className="grid grid-cols-2 gap-3">
            <Input name="brand" label="Brand" defaultValue="Future Oils" />
            <Input name="businessLine" label="Business line" defaultValue="Edible Oils" />
          </div>
          <Input name="product" label="Product" defaultValue="Refined Sunflower Oil" />
          <Input name="market" label="Market" defaultValue="Gulf/MENA" />
          <Input name="audience" label="Audience" defaultValue="Importers and distributors" />
          <Area name="objective" label="Objective" />
          <Input name="channel" label="Channel" defaultValue="Facebook, Instagram" />
          <label><span className="label">Format</span><select className="input" name="format" defaultValue="text_image"><option value="text">Text only</option><option value="text_image">Text and image</option><option value="text_video">Text and video</option><option value="carousel">Carousel</option></select></label>
          <Input name="cta" label="CTA" defaultValue="Request a Quote" />
          <Area name="internalNotes" label="Internal notes" />
          <button className="btn btn-primary">Save request</button>
        </form>

        <div className="space-y-4">
          {activeRequests.map((req: any) => <ContentRequestCard key={req.id} req={req} generate={generate} review={review} />)}
          {activeRequests.length === 0 ? <div className="panel p-5 text-[var(--text-muted)]">No active content requests.</div> : null}
        </div>
      </div>

      <section className="panel p-5 mt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-black text-xl">Rejected posts</h2>
            <p className="text-sm text-[var(--text-muted)]">Rejected items are blocked from publishing. Restore moves them back to review; delete archives them.</p>
          </div>
          <span className="badge">{rejectedRequests.length} rejected</span>
        </div>
        <div className="mt-4 grid gap-3">
          {rejectedRequests.map((req: any) => (
            <article className="card" key={req.id}>
              <div className="flex flex-wrap justify-between gap-3">
                <div><h3 className="font-black">{req.topic}</h3><p className="text-sm text-[var(--text-muted)]">{req.brand} · {req.businessLine} · {req.format}</p></div>
                <span className="badge badge-fail">REJECTED</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="btn btn-secondary" onClick={() => review.mutate({ id: req.id, decision: "revision_requested" })}>Restore to review</button>
                <button className="btn btn-danger" onClick={() => {
                  if (confirm("Archive this rejected post? It will be removed from the rejected list.")) review.mutate({ id: req.id, decision: "archived" });
                }}>Delete</button>
              </div>
            </article>
          ))}
          {rejectedRequests.length === 0 ? <div className="card text-[var(--text-muted)]">No rejected posts.</div> : null}
        </div>
      </section>
    </section>
  );
}

function ContentRequestCard({ req, generate, review }: { req: any; generate: any; review: any }) {
  const latestItem = req.items?.[0];
  return (
    <article className="panel p-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div><h2 className="text-xl font-black">{req.topic}</h2><p className="text-sm text-[var(--text-muted)]">{req.brand} · {req.businessLine} · {req.format}</p></div>
        <span className="badge">{req.status}</span>
      </div>
      {latestItem ? <div className="card mt-4">
        <div className="badge badge-mock">Generated content preview</div>
        <h3 className="font-black mt-3">{latestItem.headline}</h3>
        <p className="mt-2 whitespace-pre-line text-sm leading-6">{latestItem.caption}</p>
        {latestItem.hashtags ? <p className="mt-3 text-xs font-bold text-[var(--olive)]">{latestItem.hashtags}</p> : null}
        <div className="mt-3 text-sm text-[var(--text-muted)]">CTA: {latestItem.cta}</div>
      </div> : <div className="card mt-4 text-[var(--text-muted)]">No generated output yet.</div>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn btn-secondary" onClick={() => generate.mutate(req.id)}>Generate</button>
        <button className="btn btn-secondary" onClick={() => review.mutate({ id: req.id, decision: "revision_requested" })}>Request revision</button>
        <button className="btn btn-secondary" onClick={() => review.mutate({ id: req.id, decision: "approved_internal" })}>Approve internal</button>
        <button className="btn btn-primary" onClick={() => review.mutate({ id: req.id, decision: "approved_publication" })}>Approve publication + request creative</button>
        <button className="btn btn-danger" onClick={() => review.mutate({ id: req.id, decision: "rejected" })}>Reject</button>
      </div>
      {review.error ? <p className="mt-3 text-sm text-red-700">{review.error.message}</p> : null}
    </article>
  );
}

function Input(props: { name: string; label: string; defaultValue?: string }) {
  return <label><span className="label">{props.label}</span><input className="input" name={props.name} defaultValue={props.defaultValue} /></label>;
}

function Area(props: { name: string; label: string }) {
  return <label><span className="label">{props.label}</span><textarea className="input min-h-24" name={props.name} /></label>;
}
