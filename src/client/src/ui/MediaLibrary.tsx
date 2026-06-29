import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, remove, upload } from "../api";
import { Header } from "./Dashboard";

export type LibraryImage = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  approvalStatus: string;
  createdAt: string;
  previewUrl: string;
  storageType: "stored" | "generated";
  selection: { fileId: string } | { assetId: string };
  usageCount: number;
  canDelete: boolean;
  uses: Array<{ assetId: string; requestId: string; topic: string; requestStatus: string; approvalStatus: string }>;
};

type MediaResponse = { images: LibraryImage[] };

function uploadImage(file: File) {
  const body = new FormData();
  body.append("file", file);
  return upload<{ image: LibraryImage }>("/api/media/images", body);
}

export function MediaLibrary() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const query = useQuery<MediaResponse>({ queryKey: ["media-library"], queryFn: () => api<MediaResponse>("/api/media/images") });
  const addImage = useMutation({ mutationFn: uploadImage, onSuccess: () => qc.invalidateQueries({ queryKey: ["media-library"] }) });
  const deleteImage = useMutation({ mutationFn: (id: string) => remove(`/api/media/images/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["media-library"] }) });
  const images = query.data?.images ?? [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? images.filter((image) => image.originalName.toLowerCase().includes(term) || image.uses.some((usage) => usage.topic.toLowerCase().includes(term))) : images;
  }, [images, search]);
  const error = query.error ?? addImage.error ?? deleteImage.error;

  return <section>
    <div className="page-heading-row">
      <Header title="Media library" subtitle="Upload approved working images once, then reuse them across content requests." />
      <label className={`btn btn-primary file-button ${addImage.isPending ? "disabled" : ""}`}>
        {addImage.isPending ? "Uploading image" : "Add image"}
        <input type="file" accept="image/png,image/jpeg,image/webp" disabled={addImage.isPending} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) addImage.mutate(file); event.currentTarget.value = ""; }} />
      </label>
    </div>

    <div className="media-toolbar">
      <label><span className="label">Search images or post usage</span><input className="input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by file name or content request" /></label>
      <p>{images.length} {images.length === 1 ? "image" : "images"} / {images.filter((image) => image.usageCount > 0).length} in use</p>
    </div>

    {error ? <div className="notice notice-error" role="alert">{error.message}</div> : null}
    {query.isLoading ? <MediaLibrarySkeleton /> : null}
    {!query.isLoading && filtered.length ? <div className="media-library-grid">
      {filtered.map((image) => <article className="media-library-item" key={image.id}>
        <div className="media-library-preview"><img src={image.previewUrl} alt={image.originalName} loading="lazy" /></div>
        <div className="media-library-info">
          <strong title={image.originalName}>{image.originalName}</strong>
          <small>{image.storageType === "generated" ? "Generated asset" : formatBytes(image.sizeBytes)} / {new Date(image.createdAt).toLocaleDateString()}</small>
          <span className={`media-usage ${image.usageCount ? "in-use" : "unused"}`}>{image.usageCount ? `Used by ${image.usageCount} ${image.usageCount === 1 ? "post" : "posts"}` : "Not used"}</span>
          {image.uses.length ? <ul className="media-use-list">{image.uses.slice(0, 3).map((usage) => <li key={usage.assetId}><Link to={`/marketing?request=${encodeURIComponent(usage.requestId)}`}>{usage.topic}</Link></li>)}</ul> : null}
        </div>
        <footer className="media-library-actions">
          {image.storageType === "stored" ? <button className="btn btn-quiet-danger btn-compact" disabled={deleteImage.isPending || !image.canDelete} title={image.canDelete ? "Permanently delete this unused image" : "Replace this image on every linked post before deleting it"} onClick={() => { if (window.confirm(`Permanently delete ${image.originalName}? This cannot be undone.`)) deleteImage.mutate(image.id); }}>Delete image</button> : <span className="media-generated-label">Generated image</span>}
        </footer>
      </article>)}
    </div> : null}
    {!query.isLoading && !filtered.length ? <div className="empty-state media-library-empty"><strong>{images.length ? "No images match your search" : "No images in the library"}</strong><p>{images.length ? "Try another file name or content request." : "Add a PNG, JPEG, or WebP image here, or upload one while reviewing a post."}</p></div> : null}
  </section>;
}

export function MediaLibraryPicker({ busy, onSelect, onClose }: { busy: boolean; onSelect: (selection: LibraryImage["selection"]) => Promise<void>; onClose: () => void }) {
  const query = useQuery<MediaResponse>({ queryKey: ["media-library"], queryFn: () => api<MediaResponse>("/api/media/images") });
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const images = query.data?.images ?? [];

  return <section className="media-picker" aria-label="Choose an image from the media library">
    <div className="media-picker-header"><div><h3>Choose from media library</h3><p>Select an existing image. The original file remains available for other posts.</p></div><button className="btn btn-secondary btn-compact" onClick={onClose}>Close library</button></div>
    {query.error ? <div className="notice notice-error" role="alert">{query.error.message}</div> : null}
    {query.isLoading ? <MediaLibrarySkeleton compact /> : null}
    {!query.isLoading && images.length ? <div className="media-picker-grid">{images.map((image) => <button className="media-choice" key={image.id} disabled={busy || selectingId !== null} onClick={() => { setSelectingId(image.id); void onSelect(image.selection).then(onClose).catch(() => setSelectingId(null)); }}>
      <img src={image.previewUrl} alt="" loading="lazy" />
      <span><strong>{image.originalName}</strong><small>{selectingId === image.id ? "Selecting image" : image.usageCount ? `Used by ${image.usageCount} ${image.usageCount === 1 ? "post" : "posts"}` : "Available"}</small></span>
    </button>)}</div> : null}
    {!query.isLoading && !images.length ? <div className="empty-state"><strong>The media library is empty</strong><p>Add an image in the Media library, or upload your image directly to this post.</p><Link className="btn btn-secondary" to="/media-library">Open media library</Link></div> : null}
  </section>;
}

function MediaLibrarySkeleton({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? "media-picker-grid" : "media-library-grid"} aria-label="Loading media library">{Array.from({ length: compact ? 4 : 8 }, (_, index) => <div className="media-skeleton skeleton-block" key={index} />)}</div>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
