import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, patch, post, remove, upload } from "../api";
import { Header } from "./Dashboard";
import { assetUrl, deriveStage, formatLabel, isProcessing, needsMedia, stageLabel, type ContentRequest, type WorkflowStage } from "../contentWorkflow";

type ContentResponse = { requests: ContentRequest[] };
type ReviewDecision = "approved_publication" | "revision_requested" | "rejected" | "archived";
type FilterKey = "all" | "review" | "media" | "failed" | "ready" | "rejected";

export function MarketingStudio() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [showCreate, setShowCreate] = useState(false);
  const query = useQuery<ContentResponse>({
    queryKey: ["content"],
    queryFn: () => api<ContentResponse>("/api/content/requests"),
    refetchInterval: (current) => current.state.data?.requests.some(isProcessing) ? 2500 : false,
    refetchOnWindowFocus: true
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["content"] });
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => post<{ request: ContentRequest }>("/api/content/requests", body),
    onSuccess: async (result) => { setShowCreate(false); setSelectedId(result.request.id); await refresh(); }
  });
  const generate = useMutation({ mutationFn: (id: string) => post(`/api/content/requests/${id}/generate`, {}), onSuccess: refresh });
  const review = useMutation({ mutationFn: ({ id, decision }: { id: string; decision: ReviewDecision }) => post(`/api/content/requests/${id}/review`, { decision }), onSuccess: refresh });
  const creativeReview = useMutation({ mutationFn: ({ id, decision }: { id: string; decision: "approved" | "regenerate" | "rejected" }) => post(`/api/content/assets/${id}/review`, { decision }), onSuccess: refresh });
  const editCopy = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { headline: string; caption: string; hashtags: string; cta: string } }) => patch(`/api/content/items/${id}`, body),
    onSuccess: refresh
  });
  const uploadImage = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const body = new FormData();
      body.append("file", file);
      return upload(`/api/content/requests/${id}/assets/upload`, body);
    },
    onSuccess: refresh
  });
  const deleteRequest = useMutation({
    mutationFn: (id: string) => remove(`/api/content/requests/${id}`),
    onSuccess: async () => { setSelectedId(null); await refresh(); }
  });

  const requests = query.data?.requests ?? [];
  useEffect(() => {
    if (!selectedId && requests[0]) setSelectedId(requests[0].id);
    if (selectedId && requests.length && !requests.some((item) => item.id === selectedId)) setSelectedId(requests[0].id);
  }, [requests, selectedId]);

  const filtered = useMemo(() => requests.filter((request) => {
    const stage = deriveStage(request);
    if (filter === "review") return stage === "review_copy" || stage === "review_media";
    if (filter === "media") return stage === "generating_media";
    if (filter === "failed") return stage === "copy_failed" || stage === "media_failed";
    if (filter === "ready") return stage === "ready";
    if (filter === "rejected") return stage === "rejected" || stage === "archived";
    return stage !== "archived";
  }), [filter, requests]);
  const selected = filtered.find((request) => request.id === selectedId) ?? filtered[0];
  const mutationError = create.error ?? generate.error ?? review.error ?? creativeReview.error ?? editCopy.error ?? uploadImage.error ?? deleteRequest.error;
  const busy = generate.isPending || review.isPending || creativeReview.isPending || editCopy.isPending || uploadImage.isPending || deleteRequest.isPending;

  return (
    <section>
      <div className="page-heading-row">
        <Header title="Content" subtitle="Move each request from copy to media review and publishing." />
        <button className="btn btn-primary" onClick={() => setShowCreate((value) => !value)}>{showCreate ? "Close request form" : "New content request"}</button>
      </div>

      {showCreate ? <RequestForm pending={create.isPending} error={create.error?.message} onSubmit={(body) => create.mutate(body)} /> : null}

      <nav className="workflow-tabs" aria-label="Content filters">
        <FilterButton value="all" current={filter} onChange={setFilter} count={requests.filter((item) => deriveStage(item) !== "archived").length}>All</FilterButton>
        <FilterButton value="review" current={filter} onChange={setFilter} count={requests.filter((item) => ["review_copy", "review_media"].includes(deriveStage(item))).length}>Needs review</FilterButton>
        <FilterButton value="media" current={filter} onChange={setFilter} count={requests.filter((item) => deriveStage(item) === "generating_media").length}>Creating media</FilterButton>
        <FilterButton value="failed" current={filter} onChange={setFilter} count={requests.filter((item) => ["copy_failed", "media_failed"].includes(deriveStage(item))).length}>Failed</FilterButton>
        <FilterButton value="ready" current={filter} onChange={setFilter} count={requests.filter((item) => deriveStage(item) === "ready").length}>Ready to publish</FilterButton>
        <FilterButton value="rejected" current={filter} onChange={setFilter} count={requests.filter((item) => ["rejected", "archived"].includes(deriveStage(item))).length}>Rejected / archived</FilterButton>
      </nav>

      {query.isLoading ? <ContentSkeleton /> : (
        <div className="content-workspace">
          <section className="content-queue" aria-label="Content requests">
            {filtered.map((request) => {
              const stage = deriveStage(request);
              return <button className={`queue-row ${selected?.id === request.id ? "selected" : ""}`} key={request.id} onClick={() => setSelectedId(request.id)}>
                <span className="queue-copy"><strong>{request.topic}</strong><small>{formatLabel(request.format)} · {request.product || request.businessLine}</small></span>
                <StatusBadge stage={stage} />
              </button>;
            })}
            {filtered.length === 0 ? <div className="empty-state"><strong>No requests in this stage</strong><p>Create a request or choose another filter.</p></div> : null}
          </section>

          <section className="content-detail" aria-live="polite">
            {selected ? <RequestDetail request={selected} busy={busy} onGenerate={() => generate.mutate(selected.id)} onReview={(decision) => review.mutate({ id: selected.id, decision })} onCreativeReview={(assetId, decision) => creativeReview.mutate({ id: assetId, decision })} onEditCopy={(itemId, body) => editCopy.mutateAsync({ id: itemId, body }).then(() => undefined)} onUploadImage={(file) => uploadImage.mutate({ id: selected.id, file })} onDelete={() => { if (window.confirm("Permanently delete this failed request and its automation history? This cannot be undone.")) deleteRequest.mutate(selected.id); }} /> : <div className="empty-state"><strong>Select a content request</strong><p>Its current stage and next action will appear here.</p></div>}
          </section>
        </div>
      )}
      {mutationError ? <div className="notice notice-error" role="alert">{mutationError.message}</div> : null}
    </section>
  );
}

type CopyUpdate = { headline: string; caption: string; hashtags: string; cta: string };

function RequestDetail({ request, busy, onGenerate, onReview, onCreativeReview, onEditCopy, onUploadImage, onDelete }: {
  request: ContentRequest;
  busy: boolean;
  onGenerate: () => void;
  onReview: (decision: ReviewDecision) => void;
  onCreativeReview: (assetId: string, decision: "approved" | "regenerate" | "rejected") => void;
  onEditCopy: (itemId: string, body: CopyUpdate) => Promise<void>;
  onUploadImage: (file: File) => void;
  onDelete: () => void;
}) {
  const [editingCopy, setEditingCopy] = useState(false);
  useEffect(() => setEditingCopy(false), [request.id]);
  const stage = deriveStage(request);
  const item = request.items[0];
  const asset = request.assets.find((entry) => entry.approvalStatus !== "rejected") ?? request.assets[0];
  const latestJob = request.jobs[0];
  const mediaUrl = assetUrl(asset);
  const mediaName = request.format === "text_video" ? "video" : request.format === "carousel" ? "carousel" : "image";
  const approvalLabel = request.format === "text" ? "Approve and send to Publishing" : `Approve copy and create ${mediaName}`;
  const failed = stage === "copy_failed" || stage === "media_failed";
  const supportsImageUpload = request.format === "text_image" || request.format === "carousel";

  return <>
    <header className="detail-header">
      <div><span className="detail-type">{formatLabel(request.format)}</span><h2>{request.topic}</h2><p>{request.brand} · {request.product || request.businessLine} · {request.market || "All markets"}</p></div>
      <StatusBadge stage={stage} />
    </header>
    <WorkflowProgress request={request} stage={stage} />

    <div className={`preview-grid ${needsMedia(request.format) ? "has-media" : ""}`}>
      <section className="preview-section">
        <div className="preview-section-header">
          <h3>Copy</h3>
          {stage === "review_copy" && item && !editingCopy ? <button className="btn btn-secondary btn-compact" disabled={busy} onClick={() => setEditingCopy(true)}>Edit copy</button> : null}
        </div>
        {item && editingCopy ? <CopyEditor item={item} busy={busy} onCancel={() => setEditingCopy(false)} onSave={(body) => { void onEditCopy(item.id, body).then(() => setEditingCopy(false)).catch(() => undefined); }} /> : null}
        {item && !editingCopy ? <div className="copy-preview"><strong>{item.headline}</strong><p>{item.caption}</p>{item.hashtags ? <p className="hashtags">{item.hashtags}</p> : null}{item.cta ? <small>CTA: {item.cta}</small> : null}</div> : null}
        {!item ? <div className="empty-preview">Copy has not been generated yet.</div> : null}
      </section>
      {needsMedia(request.format) ? <section className="preview-section">
        <h3>Media</h3>
        {stage === "generating_media" ? <ProcessingPanel title={`Creating ${mediaName}`} detail="This usually takes a few minutes. This page updates automatically." /> : null}
        {stage === "media_failed" ? <div className="media-placeholder error"><strong>Media generation failed</strong><p>{latestJob?.errorMessage || "The automation did not return a usable asset."}</p></div> : null}
        {asset && ["review_media", "ready"].includes(stage) ? <div className="media-preview">{mediaUrl ? (asset.assetType === "video" ? <video src={mediaUrl} controls /> : <img src={mediaUrl} alt={`${asset.sourceTool === "manual_upload" ? "Uploaded" : "Generated"} ${mediaName} for ${request.topic}`} />) : <div className="asset-file"><strong>{mediaName[0].toUpperCase() + mediaName.slice(1)} received</strong><p>The asset is stored internally. Public preview is not available for this file reference.</p></div>}</div> : null}
        {["draft", "review_copy", "generating_copy", "copy_failed"].includes(stage) ? <div className="empty-preview">Media starts after the copy is approved.</div> : null}
      </section> : null}
    </div>

    {latestJob && isProcessing(request) ? <p className="automation-note" role="status"><span className="status-pulse" />{latestJob.currentStep || "Automation is working"}</p> : null}

    <footer className="detail-actions">
      <div className="secondary-actions">
        {stage === "review_copy" ? <button className="btn btn-secondary" disabled={busy} onClick={onGenerate}>Regenerate copy</button> : null}
        {stage === "review_copy" ? <button className="btn btn-quiet-danger" disabled={busy} onClick={() => onReview("rejected")}>Reject request</button> : null}
        {stage === "review_media" && asset ? <button className="btn btn-secondary" disabled={busy} onClick={() => onCreativeReview(asset.id, "regenerate")}>Create another {mediaName}</button> : null}
        {supportsImageUpload && ["review_media", "media_failed"].includes(stage) ? <label className={`btn btn-secondary file-button ${busy ? "disabled" : ""}`}>Upload my image<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) onUploadImage(file); event.currentTarget.value = ""; }} /></label> : null}
        {stage === "rejected" ? <button className="btn btn-secondary" disabled={busy} onClick={() => onReview("revision_requested")}>Restore to review</button> : null}
        {stage === "rejected" ? <button className="btn btn-secondary" disabled={busy} onClick={() => onReview("archived")}>Archive request</button> : null}
        {failed ? <button className="btn btn-secondary" disabled={busy} onClick={() => onReview("archived")}>Archive failed request</button> : null}
        {failed ? <button className="btn btn-danger" disabled={busy} onClick={onDelete}>Delete failed request</button> : null}
        {isProcessing(request) ? <Link className="btn btn-secondary" to="/automation">View automation details</Link> : null}
      </div>
      <div>
        {["draft", "copy_failed"].includes(stage) ? <button className="btn btn-primary" disabled={busy} onClick={onGenerate}>{stage === "copy_failed" ? "Retry copy generation" : "Generate copy"}</button> : null}
        {stage === "review_copy" ? <button className="btn btn-primary" disabled={busy} onClick={() => onReview("approved_publication")}>{approvalLabel}</button> : null}
        {stage === "media_failed" ? <button className="btn btn-primary" disabled={busy} onClick={() => onReview("approved_publication")}>Retry {mediaName} generation</button> : null}
        {stage === "review_media" && asset ? <button className="btn btn-primary" disabled={busy} onClick={() => onCreativeReview(asset.id, "approved")}>Approve {mediaName} and send to Publishing</button> : null}
        {stage === "ready" ? <Link className="btn btn-primary" to="/publishing">Open Publishing</Link> : null}
      </div>
    </footer>
  </>;
}

function CopyEditor({ item, busy, onCancel, onSave }: { item: ContentRequest["items"][number]; busy: boolean; onCancel: () => void; onSave: (body: CopyUpdate) => void }) {
  return <form className="copy-editor" onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave({ headline: String(form.get("headline") || ""), caption: String(form.get("caption") || ""), hashtags: String(form.get("hashtags") || ""), cta: String(form.get("cta") || "") });
  }}>
    <label><span className="label">Headline</span><input className="input" name="headline" maxLength={300} defaultValue={item.headline || ""} /></label>
    <label><span className="label">Caption</span><textarea className="input copy-editor-caption" name="caption" maxLength={10000} required defaultValue={item.caption || ""} /></label>
    <label><span className="label">Hashtags</span><textarea className="input" name="hashtags" maxLength={2000} defaultValue={item.hashtags || ""} /></label>
    <label><span className="label">Call to action</span><input className="input" name="cta" maxLength={300} defaultValue={item.cta || ""} /></label>
    <div className="copy-editor-actions"><button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>Cancel editing</button><button className="btn btn-primary" disabled={busy}>{busy ? "Saving changes" : "Save copy changes"}</button></div>
  </form>;
}
function WorkflowProgress({ request, stage }: { request: ContentRequest; stage: WorkflowStage }) {
  const steps = needsMedia(request.format) ? ["Brief", "Review copy", request.format === "text_video" ? "Create video" : request.format === "carousel" ? "Create carousel" : "Create image", "Review media", "Ready to publish"] : ["Brief", "Review copy", "Ready to publish"];
  const index = stage === "ready" ? steps.length - 1 : stage === "review_media" ? steps.length - 2 : ["generating_media", "media_failed"].includes(stage) ? 2 : stage === "review_copy" ? 1 : 0;
  return <ol className="workflow-progress" aria-label="Content progress">{steps.map((step, stepIndex) => <li className={stepIndex < index ? "complete" : stepIndex === index ? "current" : ""} key={step}><span>{stepIndex < index ? "✓" : stepIndex + 1}</span>{step}</li>)}</ol>;
}

function StatusBadge({ stage }: { stage: WorkflowStage }) {
  const tone = stage.includes("failed") || stage === "rejected" ? "fail" : stage === "ready" ? "ok" : stage.includes("generating") ? "waiting" : stage.includes("review") ? "info" : "neutral";
  return <span className={`status-badge status-${tone}`}><span aria-hidden="true" />{stageLabel(stage)}</span>;
}

function FilterButton({ value, current, onChange, count, children }: { value: FilterKey; current: FilterKey; onChange: (value: FilterKey) => void; count: number; children: ReactNode }) {
  return <button className={current === value ? "active" : ""} aria-current={current === value ? "page" : undefined} onClick={() => onChange(value)}>{children}<span>{count}</span></button>;
}

function ProcessingPanel({ title, detail }: { title: string; detail: string }) {
  return <div className="media-placeholder"><span className="processing-mark" aria-hidden="true" /><strong>{title}</strong><p>{detail}</p></div>;
}

function ContentSkeleton() {
  return <div className="content-workspace" aria-label="Loading content"><div className="content-queue skeleton-block" /><div className="content-detail skeleton-block" /></div>;
}

function RequestForm({ pending, error, onSubmit }: { pending: boolean; error?: string; onSubmit: (body: Record<string, unknown>) => void }) {
  return <form className="request-form" onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const format = String(form.get("format"));
    onSubmit({
      topic: String(form.get("topic")), brand: String(form.get("brand")), businessLine: String(form.get("businessLine")), product: String(form.get("product")), market: String(form.get("market")), audience: String(form.get("audience")), objective: String(form.get("objective")), channel: format === "text" ? "Facebook" : "Facebook, Instagram", format, cta: String(form.get("cta")), internalNotes: String(form.get("internalNotes")), requestedPublishingChannels: format === "text" ? ["facebook"] : ["facebook", "instagram"]
    });
  }}>
    <div className="form-heading"><div><h2>New content request</h2><p>Start with the copy. Media is created only after copy approval.</p></div></div>
    <label className="form-span-2"><span className="label">Topic or instruction</span><textarea className="input min-h-24" name="topic" required /></label>
    <Input name="brand" label="Brand" defaultValue="Future Oils" />
    <Input name="businessLine" label="Business line" defaultValue="Edible Oils" />
    <Input name="product" label="Product" defaultValue="Refined Sunflower Oil" />
    <Input name="market" label="Market" defaultValue="Gulf/MENA" />
    <Input name="audience" label="Audience" defaultValue="Importers and distributors" />
    <label><span className="label">Format</span><select className="input" name="format" defaultValue="text_image"><option value="text">Text only</option><option value="text_image">Text and image</option><option value="text_video">Text and video</option><option value="carousel">Carousel</option></select></label>
    <label className="form-span-2"><span className="label">Objective</span><textarea className="input" name="objective" /></label>
    <Input name="cta" label="Call to action" defaultValue="Request a Quote" />
    <Input name="internalNotes" label="Internal notes" />
    {error ? <p className="notice notice-error form-span-2" role="alert">{error}</p> : null}
    <div className="form-actions form-span-2"><button className="btn btn-primary" disabled={pending}>{pending ? "Saving request" : "Save content request"}</button></div>
  </form>;
}

function Input({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  return <label><span className="label">{label}</span><input className="input" name={name} defaultValue={defaultValue} /></label>;
}
