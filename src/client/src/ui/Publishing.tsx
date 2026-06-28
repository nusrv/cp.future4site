import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, post } from "../api";
import { Header } from "./Dashboard";
import { assetUrl, formatLabel, isProcessing, needsMedia, type ContentRequest } from "../contentWorkflow";

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

  return <section>
    <Header title="Publishing" subtitle="Review the final post, check selected channels, then publish." />
    {query.isLoading ? <div className="publishing-skeleton skeleton-block" /> : null}
    {!query.isLoading && approved.length === 0 ? <div className="empty-state panel"><strong>Nothing is ready to publish</strong><p>Text posts arrive after copy approval. Media posts arrive after their image, video, or carousel is approved.</p></div> : null}
    <div className="publishing-list">{approved.map((request) => <PublishingCard key={request.id} request={request} busy={publish.isPending} error={publish.error?.message} onPublish={(platforms, dryRun) => publish.mutate({ id: request.items[0].id, platforms, dryRun })} />)}</div>
  </section>;
}

function PublishingCard({ request, busy, error, onPublish }: { request: ContentRequest; busy: boolean; error?: string; onPublish: (platforms: Platform[], dryRun: boolean) => void }) {
  const item = request.items[0];
  const approvedAsset = request.assets.find((asset) => asset.approvalStatus === "approved");
  const url = assetUrl(approvedAsset);
  const facebookAllowed = true;
  const instagramAllowed = needsMedia(request.format) && Boolean(approvedAsset);
  const [platforms, setPlatforms] = useState<Platform[]>(instagramAllowed ? ["facebook", "instagram"] : ["facebook"]);
  useEffect(() => { if (!instagramAllowed) setPlatforms((current) => current.filter((value) => value !== "instagram")); }, [instagramAllowed]);
  const dryRunPlatforms = useMemo(() => new Set((item.publishingRecords ?? []).filter((record) => record.mode === "DRY_RUN").map((record) => record.platform.toLowerCase() as Platform)), [item.publishingRecords]);
  const checkPassed = platforms.length > 0 && platforms.every((platform) => dryRunPlatforms.has(platform));
  const liveRecords = (item.publishingRecords ?? []).filter((record) => record.mode !== "DRY_RUN");
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

    {liveRecords.length ? <div className="publication-results" aria-live="polite">{liveRecords.map((record) => <p key={record.id}><strong>{record.platform === "FACEBOOK" ? "Facebook" : "Instagram"}</strong><span>{record.status.replaceAll("_", " ").toLowerCase()}</span>{record.platformUrl ? <a href={record.platformUrl} target="_blank" rel="noreferrer">View post</a> : null}</p>)}</div> : null}
    {error ? <div className="notice notice-error" role="alert">{error}</div> : null}
    <footer className="publishing-actions">
      <p>{checkPassed ? "Publishing check passed for the selected channels." : "Run the publishing check before publishing."}</p>
      {!checkPassed ? <button className="btn btn-primary" disabled={busy || platforms.length === 0} onClick={() => onPublish(platforms, true)}>{busy ? "Running check" : "Run publishing check"}</button> : <button className="btn btn-primary" disabled={busy} onClick={() => { if (confirm(`Publish this post to ${platforms.join(" and ")}?`)) onPublish(platforms, false); }}>{busy ? "Submitting" : "Publish to selected channels"}</button>}
    </footer>
  </article>;
}
