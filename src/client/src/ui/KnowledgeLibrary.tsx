import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, patch, post, upload } from "../api";
import { Header } from "./Dashboard";

type KnowledgeFile = {
  originalName: string;
  mimeType: string;
  fileExtension: string;
  sizeBytes: number;
  checksumSummary: string;
  securityStatus: "PENDING" | "CLEAN" | "REJECTED" | "SCAN_UNAVAILABLE";
  downloadUrl: string;
};

type KnowledgeVersion = {
  id: string;
  versionNumber: number;
  versionLabel?: string | null;
  reviewStatus: "UPLOADED" | "READY_FOR_REVIEW" | "SUPERSEDED";
  supersedesVersionId?: string | null;
  createdAt: string;
  uploadedBy: { displayName: string; username: string };
  file: KnowledgeFile;
};

type KnowledgeDocument = {
  id: string;
  title: string;
  category: string;
  sourceType: string;
  locale: string;
  market?: string | null;
  notes?: string | null;
  lifecycleStatus: "ACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
  createdBy: { displayName: string; username: string };
  currentVersion: KnowledgeVersion | null;
  versions: KnowledgeVersion[];
};

type KnowledgeListResponse = { documents: KnowledgeDocument[] };
type KnowledgeDetailResponse = {
  document: KnowledgeDocument;
  auditEvents: Array<{
    id: string;
    action: string;
    summary: string;
    createdAt: string;
    actor?: { displayName: string; username: string } | null;
  }>;
};
type KnowledgeMutationResponse = {
  document: KnowledgeDocument;
  warnings?: Array<{ code: string; message: string }>;
};

type Filters = {
  search: string;
  category: string;
  locale: string;
  market: string;
  lifecycle: "ACTIVE" | "ARCHIVED" | "ALL";
  fileType: string;
  uploadedFrom: string;
  uploadedTo: string;
};

const initialFilters: Filters = {
  search: "",
  category: "",
  locale: "",
  market: "",
  lifecycle: "ACTIVE",
  fileType: "",
  uploadedFrom: "",
  uploadedTo: ""
};

const acceptedExtensions = new Set(["pdf", "txt", "csv", "png", "jpg", "jpeg", "webp"]);
const maxUploadBytes = 25 * 1024 * 1024;

export function KnowledgeLibrary({ permissions }: { permissions: string[] }) {
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmLifecycle, setConfirmLifecycle] = useState<"archive" | "restore" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const canUpload = permissions.includes("knowledge.upload");
  const canEdit = permissions.includes("knowledge.edit");
  const canArchive = permissions.includes("knowledge.archive");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    return params.toString();
  }, [filters]);
  const list = useQuery<KnowledgeListResponse>({
    queryKey: ["knowledge-documents", queryString],
    queryFn: () => api<KnowledgeListResponse>("/api/knowledge/documents?" + queryString)
  });
  const detail = useQuery<KnowledgeDetailResponse>({
    queryKey: ["knowledge-document", selectedId],
    queryFn: () => api<KnowledgeDetailResponse>("/api/knowledge/documents/" + encodeURIComponent(selectedId!)),
    enabled: Boolean(selectedId)
  });
  const refresh = async (documentId?: string) => {
    await qc.invalidateQueries({ queryKey: ["knowledge-documents"] });
    await qc.invalidateQueries({ queryKey: ["knowledge-document", documentId ?? selectedId] });
  };
  const createDocument = useMutation({
    mutationFn: (form: FormData) => upload<KnowledgeMutationResponse>("/api/knowledge/documents", form),
    onSuccess: async (result) => {
      setShowUpload(false);
      setSelectedId(result.document.id);
      setNotice(result.warnings?.[0]?.message ?? "Document uploaded to the private Knowledge Library.");
      await refresh(result.document.id);
    }
  });
  const replaceVersion = useMutation({
    mutationFn: ({ id, form }: { id: string; form: FormData }) => upload<KnowledgeMutationResponse>("/api/knowledge/documents/" + encodeURIComponent(id) + "/versions", form),
    onSuccess: async (result) => {
      setNotice(result.warnings?.[0]?.message ?? "Replacement version uploaded. The previous version remains available.");
      await refresh(result.document.id);
    }
  });
  const editDocument = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, string> }) => patch<KnowledgeMutationResponse>("/api/knowledge/documents/" + encodeURIComponent(id), body),
    onSuccess: async (result) => {
      setEditing(false);
      setNotice("Document metadata updated.");
      await refresh(result.document.id);
    }
  });
  const lifecycle = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "archive" | "restore" }) => post<KnowledgeMutationResponse>("/api/knowledge/documents/" + encodeURIComponent(id) + "/" + action, {}),
    onSuccess: async (result) => {
      setConfirmLifecycle(null);
      setNotice(result.document.lifecycleStatus === "ARCHIVED" ? "Document archived. All versions remain stored." : "Document restored to the active library.");
      setSelectedId(null);
      await refresh(result.document.id);
    }
  });

  const documents = list.data?.documents ?? [];
  const selected = detail.data?.document ?? documents.find((item) => item.id === selectedId) ?? null;
  const error = list.error ?? detail.error ?? createDocument.error ?? replaceVersion.error ?? editDocument.error ?? lifecycle.error;

  return <section>
    <div className="page-heading-row">
      <Header title="Knowledge Library" subtitle="Manage private source documents and their immutable file versions." />
      {canUpload ? <button className="btn btn-primary" onClick={() => setShowUpload((value) => !value)}>{showUpload ? "Close upload form" : "Upload document"}</button> : null}
    </div>

    <div className="notice notice-info knowledge-ai-notice" role="note">
      <strong>Private source library only.</strong>
      <span>Documents in the Knowledge Library are not yet available to AI content generation.</span>
    </div>

    {showUpload ? <UploadDocumentForm pending={createDocument.isPending} onSubmit={(form) => createDocument.mutate(form)} /> : null}
    {notice ? <div className="notice notice-info" role="status"><span>{notice}</span><button className="btn btn-secondary btn-compact" onClick={() => setNotice(null)}>Dismiss message</button></div> : null}
    {error ? <div className="notice notice-error" role="alert">{error.message}</div> : null}

    <KnowledgeFilters value={filters} onChange={setFilters} />

    <div className="knowledge-workspace">
      <div className="knowledge-list-panel">
        <div className="knowledge-list-summary"><strong>{documents.length} documents</strong><span>{filters.lifecycle === "ACTIVE" ? "Active library" : filters.lifecycle === "ARCHIVED" ? "Archive" : "All lifecycle states"}</span></div>
        {list.isLoading ? <KnowledgeRowsSkeleton /> : null}
        {!list.isLoading && documents.length ? <div className="knowledge-table-wrap"><table className="table knowledge-table">
          <thead><tr><th>Document</th><th>Current file</th><th>Locale</th><th>Status</th><th><span className="sr-only">Open</span></th></tr></thead>
          <tbody>{documents.map((document) => <tr className={selectedId === document.id ? "selected" : ""} key={document.id}>
            <td><strong>{document.title}</strong><small>{document.category} · updated {formatDate(document.updatedAt)}</small></td>
            <td>{document.currentVersion ? <><span>v{document.currentVersion.versionNumber} · {document.currentVersion.file.fileExtension.toUpperCase()}</span><small>{formatBytes(document.currentVersion.file.sizeBytes)} · {scanLabel(document.currentVersion.file.securityStatus)}</small></> : "No file"}</td>
            <td><span>{document.locale}</span><small>{document.market || "All markets"}</small></td>
            <td><LifecycleBadge status={document.lifecycleStatus} /></td>
            <td><button className="btn btn-secondary btn-compact" onClick={() => { setSelectedId(document.id); setEditing(false); setConfirmLifecycle(null); }}>Open details</button></td>
          </tr>)}</tbody>
        </table></div> : null}
        {!list.isLoading && !documents.length ? <div className="empty-state knowledge-empty"><strong>No documents match these filters</strong><p>{filters.lifecycle === "ACTIVE" ? "Upload a private source document or adjust the filters." : "No archived documents were found."}</p></div> : null}
      </div>

      <aside className="knowledge-detail-panel" aria-label="Knowledge document details">
        {!selectedId ? <div className="knowledge-detail-empty"><strong>Select a document</strong><p>Open a row to review metadata, versions, scan state, downloads, and audit activity.</p></div> : null}
        {selectedId && detail.isLoading ? <div className="skeleton-block knowledge-detail-skeleton" /> : null}
        {selected ? <DocumentDetail
          document={selected}
          auditEvents={detail.data?.auditEvents ?? []}
          canUpload={canUpload}
          canEdit={canEdit}
          canArchive={canArchive}
          editing={editing}
          confirmingLifecycle={confirmLifecycle}
          busy={replaceVersion.isPending || editDocument.isPending || lifecycle.isPending}
          onEdit={() => setEditing(true)}
          onCancelEdit={() => setEditing(false)}
          onSave={(body) => editDocument.mutate({ id: selected.id, body })}
          onReplace={(form) => replaceVersion.mutate({ id: selected.id, form })}
          onAskLifecycle={(action) => setConfirmLifecycle(action)}
          onCancelLifecycle={() => setConfirmLifecycle(null)}
          onLifecycle={(action) => lifecycle.mutate({ id: selected.id, action })}
        /> : null}
      </aside>
    </div>
  </section>;
}

function KnowledgeFilters({ value, onChange }: { value: Filters; onChange: (filters: Filters) => void }) {
  const set = (field: keyof Filters, next: string) => onChange({ ...value, [field]: next });
  return <div className="knowledge-filters" aria-label="Knowledge Library filters">
    <label className="knowledge-search"><span className="label">Search</span><input className="input" type="search" value={value.search} onChange={(event) => set("search", event.target.value)} placeholder="Title, category, source, or market" /></label>
    <label><span className="label">Lifecycle</span><select className="input" value={value.lifecycle} onChange={(event) => set("lifecycle", event.target.value)}><option value="ACTIVE">Active</option><option value="ARCHIVED">Archived</option><option value="ALL">All</option></select></label>
    <label><span className="label">Category</span><input className="input" value={value.category} onChange={(event) => set("category", event.target.value)} placeholder="Catalogue" /></label>
    <label><span className="label">Locale</span><input className="input" value={value.locale} onChange={(event) => set("locale", event.target.value)} placeholder="en" /></label>
    <label><span className="label">Market</span><input className="input" value={value.market} onChange={(event) => set("market", event.target.value)} placeholder="Gulf/MENA" /></label>
    <label><span className="label">File type</span><select className="input" value={value.fileType} onChange={(event) => set("fileType", event.target.value)}><option value="">All types</option>{["pdf", "txt", "csv", "png", "jpg", "jpeg", "webp"].map((type) => <option value={type} key={type}>{type.toUpperCase()}</option>)}</select></label>
    <label><span className="label">Uploaded after</span><input className="input" type="date" value={value.uploadedFrom} onChange={(event) => set("uploadedFrom", event.target.value)} /></label>
    <label><span className="label">Uploaded before</span><input className="input" type="date" value={value.uploadedTo} onChange={(event) => set("uploadedTo", event.target.value)} /></label>
    <button className="btn btn-secondary btn-compact" onClick={() => onChange(initialFilters)}>Clear filters</button>
  </div>;
}

function UploadDocumentForm({ pending, onSubmit }: { pending: boolean; onSubmit: (form: FormData) => void }) {
  const [validationError, setValidationError] = useState<string | null>(null);
  return <form className="knowledge-upload-form" onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File)) return;
    const issue = validateClientFile(file);
    if (issue) {
      setValidationError(issue);
      return;
    }
    setValidationError(null);
    onSubmit(form);
  }}>
    <div className="form-heading"><h2>Upload private source document</h2><p>PDF, TXT, CSV, PNG, JPEG, or WebP. Maximum 25 MB.</p></div>
    <label className="form-span-2"><span className="label">File</span><input className="input" type="file" name="file" required accept=".pdf,.txt,.csv,.png,.jpg,.jpeg,.webp,application/pdf,text/plain,text/csv,image/png,image/jpeg,image/webp" /></label>
    <RequiredInput name="title" label="Title" />
    <RequiredInput name="category" label="Category" placeholder="Product catalogue" />
    <RequiredInput name="sourceType" label="Source type" placeholder="Internal catalogue" />
    <RequiredInput name="locale" label="Locale" defaultValue="en" />
    <label><span className="label">Market</span><input className="input" name="market" placeholder="Optional" /></label>
    <label><span className="label">Version label</span><input className="input" name="versionLabel" placeholder="Optional, for example July 2026" /></label>
    <label className="form-span-2"><span className="label">Notes</span><textarea className="input" name="notes" maxLength={5000} /></label>
    {validationError ? <div className="notice notice-error form-span-2" role="alert">{validationError}</div> : null}
    <div className="form-actions form-span-2"><button className="btn btn-primary" disabled={pending}>{pending ? "Uploading document" : "Upload document"}</button></div>
  </form>;
}

function DocumentDetail(props: {
  document: KnowledgeDocument;
  auditEvents: KnowledgeDetailResponse["auditEvents"];
  canUpload: boolean;
  canEdit: boolean;
  canArchive: boolean;
  editing: boolean;
  confirmingLifecycle: "archive" | "restore" | null;
  busy: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSave: (body: Record<string, string>) => void;
  onReplace: (form: FormData) => void;
  onAskLifecycle: (action: "archive" | "restore") => void;
  onCancelLifecycle: () => void;
  onLifecycle: (action: "archive" | "restore") => void;
}) {
  const document = props.document;
  const current = document.currentVersion;
  return <div>
    <header className="knowledge-detail-header"><div><span className="detail-type">{document.category}</span><h2>{document.title}</h2><p>{document.sourceType} · {document.locale}{document.market ? " · " + document.market : ""}</p></div><LifecycleBadge status={document.lifecycleStatus} /></header>
    <div className="notice notice-info knowledge-ai-notice"><span>Documents in the Knowledge Library are not yet available to AI content generation.</span></div>

    {props.editing ? <MetadataForm document={document} busy={props.busy} onCancel={props.onCancelEdit} onSave={props.onSave} /> : <section className="knowledge-section">
      <div className="knowledge-section-heading"><h3>Metadata</h3>{props.canEdit ? <button className="btn btn-secondary btn-compact" onClick={props.onEdit}>Edit metadata</button> : null}</div>
      <dl className="knowledge-metadata"><div><dt>Category</dt><dd>{document.category}</dd></div><div><dt>Source type</dt><dd>{document.sourceType}</dd></div><div><dt>Locale</dt><dd>{document.locale}</dd></div><div><dt>Market</dt><dd>{document.market || "All markets"}</dd></div><div className="knowledge-wide"><dt>Notes</dt><dd>{document.notes || "No notes"}</dd></div></dl>
    </section>}

    {current ? <section className="knowledge-section"><div className="knowledge-section-heading"><h3>Current version</h3><a className="btn btn-secondary btn-compact" href={current.file.downloadUrl}>Download file</a></div>
      <dl className="knowledge-metadata"><div><dt>Version</dt><dd>v{current.versionNumber}{current.versionLabel ? " · " + current.versionLabel : ""}</dd></div><div><dt>File</dt><dd>{current.file.originalName}</dd></div><div><dt>Type and size</dt><dd>{current.file.fileExtension.toUpperCase()} · {formatBytes(current.file.sizeBytes)}</dd></div><div><dt>Scan status</dt><dd><ScanBadge status={current.file.securityStatus} /></dd></div><div><dt>Checksum</dt><dd><code>{current.file.checksumSummary}…</code></dd></div><div><dt>Uploaded</dt><dd>{formatDateTime(current.createdAt)} by {current.uploadedBy.displayName}</dd></div></dl>
    </section> : null}

    {props.canUpload && document.lifecycleStatus === "ACTIVE" ? <ReplacementForm busy={props.busy} onSubmit={props.onReplace} /> : null}

    <section className="knowledge-section"><h3>Version timeline</h3><ol className="knowledge-version-list">{document.versions.map((version) => <li key={version.id}>
      <div><strong>Version {version.versionNumber}{version.versionLabel ? " · " + version.versionLabel : ""}</strong><span>{version.file.originalName}</span><small>{formatDateTime(version.createdAt)} · {version.uploadedBy.displayName}</small></div>
      <div><ScanBadge status={version.file.securityStatus} /><span className="status-badge status-neutral">{version.reviewStatus === "SUPERSEDED" ? "Superseded" : "Uploaded"}</span><a href={version.file.downloadUrl}>Download</a></div>
    </li>)}</ol></section>

    {props.auditEvents.length ? <section className="knowledge-section"><h3>Recent activity</h3><ol className="knowledge-audit-list">{props.auditEvents.slice(0, 10).map((event) => <li key={event.id}><strong>{event.summary}</strong><span>{formatDateTime(event.createdAt)}{event.actor ? " · " + event.actor.displayName : ""}</span></li>)}</ol></section> : null}

    {props.canArchive ? <section className="knowledge-section knowledge-lifecycle-section"><h3>{document.lifecycleStatus === "ACTIVE" ? "Archive document" : "Restore document"}</h3>
      {props.confirmingLifecycle ? <div className="knowledge-confirmation" role="alert"><p>{props.confirmingLifecycle === "archive" ? "Archive this document? Every uploaded version will remain stored and available to authorized users." : "Restore this document to the active Knowledge Library?"}</p><div><button className="btn btn-secondary btn-compact" disabled={props.busy} onClick={props.onCancelLifecycle}>Cancel</button><button className={props.confirmingLifecycle === "archive" ? "btn btn-danger btn-compact" : "btn btn-primary btn-compact"} disabled={props.busy} onClick={() => props.onLifecycle(props.confirmingLifecycle!)}>{props.busy ? "Saving lifecycle" : props.confirmingLifecycle === "archive" ? "Archive document" : "Restore document"}</button></div></div> : <button className={document.lifecycleStatus === "ACTIVE" ? "btn btn-quiet-danger" : "btn btn-secondary"} onClick={() => props.onAskLifecycle(document.lifecycleStatus === "ACTIVE" ? "archive" : "restore")}>{document.lifecycleStatus === "ACTIVE" ? "Archive document" : "Restore document"}</button>}
    </section> : null}
  </div>;
}

function MetadataForm({ document, busy, onCancel, onSave }: { document: KnowledgeDocument; busy: boolean; onCancel: () => void; onSave: (body: Record<string, string>) => void }) {
  return <form className="knowledge-edit-form" onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSave(Object.fromEntries(["title", "category", "sourceType", "locale", "market", "notes"].map((name) => [name, String(form.get(name) ?? "")])));
  }}>
    <h3>Edit metadata</h3>
    <RequiredInput name="title" label="Title" defaultValue={document.title} />
    <RequiredInput name="category" label="Category" defaultValue={document.category} />
    <RequiredInput name="sourceType" label="Source type" defaultValue={document.sourceType} />
    <RequiredInput name="locale" label="Locale" defaultValue={document.locale} />
    <label><span className="label">Market</span><input className="input" name="market" defaultValue={document.market || ""} /></label>
    <label className="knowledge-wide"><span className="label">Notes</span><textarea className="input" name="notes" maxLength={5000} defaultValue={document.notes || ""} /></label>
    <div className="form-actions knowledge-wide"><button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>Cancel editing</button><button className="btn btn-primary" disabled={busy}>{busy ? "Saving metadata" : "Save metadata"}</button></div>
  </form>;
}

function ReplacementForm({ busy, onSubmit }: { busy: boolean; onSubmit: (form: FormData) => void }) {
  const [validationError, setValidationError] = useState<string | null>(null);
  return <section className="knowledge-section"><h3>Upload replacement version</h3><p className="knowledge-help">The current file remains in the version timeline and is never overwritten.</p><form className="knowledge-replacement-form" onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File)) return;
    const issue = validateClientFile(file);
    if (issue) {
      setValidationError(issue);
      return;
    }
    setValidationError(null);
    onSubmit(form);
    event.currentTarget.reset();
  }}><label><span className="label">Replacement file</span><input className="input" type="file" name="file" required accept=".pdf,.txt,.csv,.png,.jpg,.jpeg,.webp" /></label><label><span className="label">Version label</span><input className="input" name="versionLabel" placeholder="Optional" /></label><button className="btn btn-secondary" disabled={busy}>{busy ? "Uploading replacement" : "Upload replacement"}</button>{validationError ? <div className="notice notice-error knowledge-wide" role="alert">{validationError}</div> : null}</form></section>;
}

function RequiredInput({ name, label, defaultValue, placeholder }: { name: string; label: string; defaultValue?: string; placeholder?: string }) {
  return <label><span className="label">{label}</span><input className="input" name={name} required defaultValue={defaultValue} placeholder={placeholder} /></label>;
}

function LifecycleBadge({ status }: { status: KnowledgeDocument["lifecycleStatus"] }) {
  return <span className={"status-badge " + (status === "ACTIVE" ? "status-ok" : "status-neutral")}>{status === "ACTIVE" ? "Active" : "Archived"}</span>;
}

function ScanBadge({ status }: { status: KnowledgeFile["securityStatus"] }) {
  const tone = status === "CLEAN" ? "status-ok" : status === "REJECTED" ? "status-fail" : "status-waiting";
  return <span className={"status-badge " + tone}>{scanLabel(status)}</span>;
}

function scanLabel(status: KnowledgeFile["securityStatus"]) {
  return ({ PENDING: "Scan pending", CLEAN: "Clean", REJECTED: "Rejected", SCAN_UNAVAILABLE: "Scanner unavailable" } as const)[status];
}

function validateClientFile(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!acceptedExtensions.has(extension)) return "Choose a PDF, TXT, CSV, PNG, JPEG, or WebP file.";
  if (file.size > maxUploadBytes) return "File exceeds the 25 MB upload limit.";
  return null;
}

function KnowledgeRowsSkeleton() {
  return <div className="knowledge-list-skeleton" aria-label="Loading Knowledge Library">{Array.from({ length: 6 }, (_, index) => <div className="skeleton-block" key={index} />)}</div>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}
