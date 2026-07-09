import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, post, remove } from "../api";
import { Header } from "./Dashboard";
import { assetUrl, formatLabel, isProcessing, needsMedia, type ContentRequest, type PublishingRecord } from "../contentWorkflow";

type ContentResponse = { requests: ContentRequest[] };
type Platform = "facebook" | "instagram";

export function Publishing() {
  const qc = useQueryClient();
  const query = useQuery<ContentResponse>({
    queryKey: ["content"],
    queryFn: () => api<ContentResponse>("/api/content/requests"),
    refetchInterval: (current) => current.state.data?.requests.some(isProcessing) ? 2500 : false,
    refetchOnWindowFocus: true
  });
  const approved = query.data?.requests.filter((request) => request.status === "APPROVED_PUBLICATION" && request.items[0]) ?? [];
  const publish = useMutation({
    mutationFn: ({ id, platforms, dryRun }: { id: string; platforms: Platform[]; dryRun: boolean }) => post(`/api/content/items/${id}/publish`, { platforms, dryRun }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] })
  });
  const deleteRecord = useMutation({
    mutationFn: (id: string) => remove(`/api/content/publishing-records/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] })
  });
  const clearRecords = useMutation({
    mutationFn: (itemId: string) => remove(`/api/content/items/${itemId}/publishing-records`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["content"] })
  });
  const busy = publish.isPending || deleteRecord.isPending || clearRecords.isPending;
  const error = publish.error?.message || deleteRecord.error?.message || clearRecords.error?.message;

  return <section>
    <Header title="Publishing" subtitle="Review the final post, check selected channels, then publish." />
    {query.isLoading ? <div className="publishing-skeleton skeleton-block" /> : null}
    {!query.isLoading && approved.length === 0 ? <div className="empty-state panel"><strong>Nothing is ready to publish</strong><p>Text posts arrive after copy approval. Media posts arrive after their image, video, or carousel is approved.</p></div> : null}
    <div className="publishing-list">{approved.map((request) => <PublishingCard
      key={request.id}
      request={request}
      busy={busy}
      error={error}
      onPublish={(platforms, dryRun) => publish.mutate({ id: request.items[0].id, platforms, dryRun })}
      onDeleteRecord={(recordId) => deleteRecord.mutate(recordId)}
      onClearRecords={(itemId) => clearRecords.mutate(itemId)}
    />)}</div>
  </section>;
}

function PublishingCard({ request, busy, error, onPublish, onDeleteRecord, onClearRecords }: {
  request: ContentRequest;
  busy: boolean;
  error?: string;
  onPublish: (platforms: Platform[], dryRun: boolean) => void;
  onDeleteRecord: (recordId: string) => void;
  onClearRecords: (itemId: string) => void;
}) {
  const item = request.items[0];
  const approvedAsset = request.assets.find((asset) => asset.approvalStatus === "approved");
  const url = assetUrl(approvedAsset);
  const facebookAllowed = true;
  const instagramAllowed = needsMedia(request.format) && Boolean(approvedAsset);
  const [platforms, setPlatforms] = useState<Platform[]>(instagramAllowed ? ["facebook", "instagram"] : ["facebook"]);
  useEffect(() => { if (!instagramAllowed) setPlatforms((current) => current.filter((value) => value !== "instagram")); }, [instagramAllowed]);
  const records = item.publishingRecords ?? [];
  const dryRunPlatforms = useMemo(() => new Set(records.filter((record) => record.mode === "DRY_RUN" && record.status !== "FAILED").map((record) => record.platform.toLowerCase() as Platform)), [records]);
  const checkPassed = platforms.length > 0 && platforms.every((platform) => dryRunPlatforms.has(platform));
  const liveRecords = records.filter((record) => record.mode !== "DRY_RUN");
  const toggle = (platform: Platform) => setPlatforms((current) => current.includes(platform) ? current.filter((value) => value !== platform) : [...current, platform]);

  return <article className="publishing-item">
    <header className="publishing-header"><div><span className="detail-type">{formatLabel(request.format)}</span><h2>{request.topic}</h2><p>{request.brand} · {request.product || request.businessLine}</p></div><span className="status-badge status-ok"><span />Ready to publish</span></header>
    <div className={`publishing-preview ${approvedAsset ? "has-media" : ""}`}>
      <section><h3>Final post</h3><div className="copy-preview"><strong>{item.headline}</strong><p>{item.caption}</p>{item.hashtags ? <p className="hashtags">{item.hashtags}</p> : null}{item.cta ? <small>CTA: {item.cta}</small> : null}</div></section>
      {approvedAsset ? <section><h3>Approved media</h3><div className="media-preview">{url ? (approvedAsset.assetType === "video" ? <video src={url} controls /> : <img src={url} alt={`Approved media for ${request.topic}`} />) : <div className="asset-file"><strong>Approved {approvedAsset.assetType}</strong><p>The asset is stored internally and will be attached by the publishing workflow.</p></div>}</div></section> : null}
    </div>

    <section className="channel-picker" aria-labelledby={`channels-${request.id}`}>
      <div><h3 id={`channels-${request.id}`}>Choose channels</h3><p>The publishing check runs only for selected channels.</p></div>
      <label><input type="checkbox" checked={platforms.includes("facebook")} disabled={!facebookAllowed || busy} onChange={() => toggle("facebook")} /><span><strong>Facebook</strong><small>{dryRunPlatforms.has("facebook") ? "Check passed" : "Check required"}</small></span></label>
      <label className={!instagramAllowed ? "disabled" : ""}><input type="checkbox" checked={platforms.includes("instagram")} disabled={!instagramAllowed || busy} onChange={() => toggle("instagram")} /><span><strong>Instagram</strong><small>{instagramAllowed ? (dryRunPlatforms.has("instagram") ? "Check passed" : "Check required") : "Image or video required"}</small></span></label>
    </section>

    {records.length ? <PublishingRecords records={records} busy={busy} onDeleteRecord={onDeleteRecord} onClearRecords={() => onClearRecords(item.id)} /> : null}
    {liveRecords.length ? <div className="publication-results" aria-live="polite">{liveRecords.map((record) => <p key={record.id}><strong>{record.platform === "FACEBOOK" ? "Facebook" : "Instagram"}</strong><span>{record.status.replaceAll("_", " ").toLowerCase()}</span>{record.platformUrl ? <a href={record.platformUrl} target="_blank" rel="noreferrer">View post</a> : null}</p>)}</div> : null}
    {error ? <div className="notice notice-error" role="alert">{error}</div> : null}
    <footer className="publishing-actions">
      <p>{checkPassed ? "Publishing check passed for the selected channels." : "Run the publishing check before publishing."}</p>
      {!checkPassed ? <button className="btn btn-primary" disabled={busy || platforms.length === 0} onClick={() => onPublish(platforms, true)}>{busy ? "Running check" : "Run publishing check"}</button> : <button className="btn btn-primary" disabled={busy} onClick={() => { if (confirm(`Publish this post to ${platforms.join(" and ")}?`)) onPublish(platforms, false); }}>{busy ? "Submitting" : "Publish to selected channels"}</button>}
    </footer>
  </article>;
}

function PublishingRecords({ records, busy, onDeleteRecord, onClearRecords }: { records: PublishingRecord[]; busy: boolean; onDeleteRecord: (recordId: string) => void; onClearRecords: () => void }) {
  const sorted = [...records].sort((a, b) => a.platform.localeCompare(b.platform) || a.mode.localeCompare(b.mode));
  return <section className="publishing-records" aria-label="Publishing records">
    <div className="publishing-records-header"><h3>Publishing records</h3><button className="btn btn-ghost" disabled={busy} onClick={() => { if (confirm("Clear all publishing records from CP only? This will not delete posts already published on Facebook or Instagram.")) onClearRecords(); }}>Clear all records</button></div>
    <div className="publishing-record-list">{sorted.map((record) => <div className="publishing-record-row" key={record.id}>
      <div><strong>{record.platform === "FACEBOOK" ? "Facebook" : "Instagram"}</strong><small>{record.mode.toLowerCase()} · {record.status.replaceAll("_", " ").toLowerCase()}</small>{recordError(record) ? <em>{recordError(record)}</em> : null}</div>
      <div className="publishing-record-actions">{record.platformUrl ? <a href={record.platformUrl} target="_blank" rel="noreferrer">View post</a> : null}<button className="btn btn-ghost danger" disabled={busy} onClick={() => { if (confirm("Delete this CP publishing record only? External Facebook/Instagram posts will not be removed.")) onDeleteRecord(record.id); }}>Remove</button></div>
    </div>)}</div>
  </section>;
}

function recordError(record: PublishingRecord) {
  const errors = record.errors;
  if (!errors || typeof errors !== "object") return null;
  const message = errors.message;
  if (typeof message === "string") return message;
  const error = errors.error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return null;
}