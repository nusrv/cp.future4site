import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, post } from "../api";
import { Header } from "./Dashboard";

export function MarketingStudio() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["content"], queryFn: () => api<any>("/api/content/requests") });
  const create = useMutation({ mutationFn: (body: any) => post<any>("/api/content/requests", body), onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }) });
  const generate = useMutation({ mutationFn: (id: string) => post(`/api/content/requests/${id}/generate`, {}), onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }) });
  const review = useMutation({ mutationFn: ({ id, decision }: any) => post(`/api/content/requests/${id}/review`, { decision }), onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] }) });
  return (
    <section>
      <Header title="Marketing Studio" subtitle="Create internal content requests, run mock generation, preview outputs, and separate approval from publishing." />
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
          <label><span className="label">Format</span><select className="input" name="format"><option value="text">Text only</option><option value="text_image">Text and image</option><option value="text_video">Text and video</option><option value="carousel">Carousel</option></select></label>
          <Input name="cta" label="CTA" defaultValue="Request a Quote" />
          <Area name="internalNotes" label="Internal notes" />
          <button className="btn btn-primary">Save request</button>
        </form>
        <div className="space-y-4">
          {data?.requests?.map((req: any) => (
            <article className="panel p-5" key={req.id}>
              <div className="flex flex-wrap justify-between gap-3">
                <div><h2 className="text-xl font-black">{req.topic}</h2><p className="text-sm text-[var(--text-muted)]">{req.brand} · {req.businessLine} · {req.format}</p></div>
                <span className="badge">{req.status}</span>
              </div>
              {req.items?.[0] ? <div className="card mt-4">
                <div className="badge badge-mock">Mock generation preview</div>
                <h3 className="font-black mt-3">{req.items[0].headline}</h3>
                <p className="mt-2 text-sm">{req.items[0].caption}</p>
                <div className="mt-3 text-sm text-[var(--text-muted)]">CTA: {req.items[0].cta}</div>
              </div> : <div className="card mt-4 text-[var(--text-muted)]">No generated output yet.</div>}
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn btn-secondary" onClick={() => generate.mutate(req.id)}>Generate</button>
                <button className="btn btn-secondary" onClick={() => review.mutate({ id: req.id, decision: "revision_requested" })}>Request revision</button>
                <button className="btn btn-secondary" onClick={() => review.mutate({ id: req.id, decision: "approved_internal" })}>Approve internal</button>
                <button className="btn btn-primary" onClick={() => review.mutate({ id: req.id, decision: "approved_publication" })}>Approve publication</button>
                <button className="btn btn-danger" onClick={() => review.mutate({ id: req.id, decision: "rejected" })}>Reject</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Input(props: { name: string; label: string; defaultValue?: string }) {
  return <label><span className="label">{props.label}</span><input className="input" name={props.name} defaultValue={props.defaultValue} /></label>;
}
function Area(props: { name: string; label: string }) {
  return <label><span className="label">{props.label}</span><textarea className="input min-h-24" name={props.name} /></label>;
}

