import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api, patch, post, upload } from "../api";
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
  reviewStatus: "UPLOADED" | "READY_FOR_REVIEW" | "UNDER_REVIEW" | "APPROVED_SOURCE" | "REJECTED" | "SUPERSEDED";
  reviewedBy?: { displayName: string } | null;
  reviewedAt?: string | null;
  approvedBy?: { displayName: string } | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  reviewNotes?: string | null;
  supersededAt?: string | null;
  linkedClaimCount: number;
  reviewHistory: Array<{ id: string; action: string; previousStatus: string; newStatus: string; createdAt: string; actor: { displayName: string } }>;
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

type KnowledgeExtraction = {
  id: string;
  status: "RUNNING" | "SUCCEEDED" | "FAILED" | "UNSUPPORTED";
  extractorName: string;
  extractorVersion: string;
  pageCount?: number | null;
  fragmentCount: number;
  characterCount: number;
  errorMessage?: string | null;
  completedAt?: string | null;
  createdAt: string;
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
  const canReview = permissions.includes("knowledge.review");
  const canApprove = permissions.includes("knowledge.approve");
  const canExtract = permissions.includes("knowledge.extract");

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
  const reviewVersion = useMutation({
    mutationFn: ({ documentId, versionId, action, body = {} }: { documentId: string; versionId: string; action: string; body?: Record<string, string> }) =>
      post<KnowledgeMutationResponse>("/api/knowledge/documents/" + encodeURIComponent(documentId) + "/versions/" + encodeURIComponent(versionId) + "/" + action, body),
    onSuccess: async (result) => {
      setNotice("Source review status updated.");
      await refresh(result.document.id);
    }
  });

  const documents = list.data?.documents ?? [];
  const selected = detail.data?.document ?? documents.find((item) => item.id === selectedId) ?? null;
  const error = list.error ?? detail.error ?? createDocument.error ?? replaceVersion.error ?? editDocument.error ?? lifecycle.error ?? reviewVersion.error;

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
          canReview={canReview}
          canApprove={canApprove}
          canExtract={canExtract}
          editing={editing}
          confirmingLifecycle={confirmLifecycle}
          busy={replaceVersion.isPending || editDocument.isPending || lifecycle.isPending || reviewVersion.isPending}
          onEdit={() => setEditing(true)}
          onCancelEdit={() => setEditing(false)}
          onSave={(body) => editDocument.mutate({ id: selected.id, body })}
          onReplace={(form) => replaceVersion.mutate({ id: selected.id, form })}
          onAskLifecycle={(action) => setConfirmLifecycle(action)}
          onCancelLifecycle={() => setConfirmLifecycle(null)}
          onLifecycle={(action) => lifecycle.mutate({ id: selected.id, action })}
          onReview={(versionId, action, body) => reviewVersion.mutate({ documentId: selected.id, versionId, action, body })}
        /> : null}
      </aside>
    </div>
    <ClaimsPanel permissions={permissions} selectedDocument={selected} onOpenDocument={(documentId) => setSelectedId(documentId)} />
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
  canReview: boolean;
  canApprove: boolean;
  canExtract: boolean;
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
  onReview: (versionId: string, action: string, body?: Record<string, string>) => void;
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
      <div><ScanBadge status={version.file.securityStatus} /><ReviewBadge status={version.reviewStatus} /><a href={version.file.downloadUrl}>Download</a></div>
      <SourceReviewActions version={version} active={document.lifecycleStatus === "ACTIVE"} canEdit={props.canEdit} canReview={props.canReview} canApprove={props.canApprove} busy={props.busy} onReview={props.onReview} />
      <VersionExtraction documentId={document.id} version={version} active={document.lifecycleStatus === "ACTIVE"} canExtract={props.canExtract} />
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

function VersionExtraction({ documentId, version, active, canExtract }: {
  documentId: string;
  version: KnowledgeVersion;
  active: boolean;
  canExtract: boolean;
}) {
  const qc = useQueryClient();
  const supported = ["txt", "csv", "pdf"].includes(version.file.fileExtension.toLowerCase());
  const queryKey = ["knowledge-extractions", version.id];
  const history = useQuery<{ extractions: KnowledgeExtraction[] }>({
    queryKey,
    queryFn: () => api("/api/knowledge/documents/" + encodeURIComponent(documentId) + "/versions/" + encodeURIComponent(version.id) + "/extractions")
  });
  const extract = useMutation({
    mutationFn: () => post<{ extraction: KnowledgeExtraction }>(
      "/api/knowledge/documents/" + encodeURIComponent(documentId) + "/versions/" + encodeURIComponent(version.id) + "/extractions",
      {}
    ),
    onSettled: () => qc.invalidateQueries({ queryKey })
  });
  const latest = history.data?.extractions[0];
  const unavailableReason = !active
    ? "Restore this document before extracting text."
    : version.file.securityStatus === "REJECTED"
      ? "Security-rejected files cannot be extracted."
      : !supported
        ? "Deterministic extraction supports TXT, CSV, and PDF files."
        : !canExtract
          ? "You do not have permission to extract source text."
          : null;
  const error = extract.error instanceof ApiError ? extract.error.message : extract.error ? "Extraction failed." : null;
  return <div className="knowledge-extraction">
    <div>
      <strong>Deterministic text</strong>
      {latest ? <small>{latest.status === "SUCCEEDED"
        ? latest.fragmentCount + " fragment" + (latest.fragmentCount === 1 ? "" : "s") + " · " + latest.characterCount.toLocaleString() + " characters"
        : latest.errorMessage || latest.status.toLowerCase()}</small> : <small>No extraction run for this immutable version.</small>}
    </div>
    {canExtract ? <button className="btn btn-secondary btn-compact" disabled={Boolean(unavailableReason) || extract.isPending} title={unavailableReason ?? undefined} onClick={() => extract.mutate()}>
      {extract.isPending ? "Extracting text" : latest?.status === "SUCCEEDED" ? "Extract again" : "Extract text"}
    </button> : null}
    {unavailableReason ? <small>{unavailableReason}</small> : null}
    {error ? <small role="alert">{error}</small> : null}
  </div>;
}

function SourceReviewActions({ version, active, canEdit, canReview, canApprove, busy, onReview }: {
  version: KnowledgeVersion; active: boolean; canEdit: boolean; canReview: boolean; canApprove: boolean; busy: boolean;
  onReview: (versionId: string, action: string, body?: Record<string, string>) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  if (!active || version.file.securityStatus === "REJECTED") return null;
  return <div className="knowledge-review-actions">
    {canEdit && version.reviewStatus === "UPLOADED" ? <button className="btn btn-secondary btn-compact" disabled={busy} onClick={() => onReview(version.id, "submit-review")}>Submit source review</button> : null}
    {canReview && version.reviewStatus === "READY_FOR_REVIEW" ? <button className="btn btn-primary btn-compact" disabled={busy} onClick={() => onReview(version.id, "begin-review")}>Begin source review</button> : null}
    {canApprove && version.reviewStatus === "UNDER_REVIEW" ? <button className="btn btn-primary btn-compact" disabled={busy} onClick={() => onReview(version.id, "approve-source")}>Approve trusted source</button> : null}
    {canReview && version.reviewStatus === "UNDER_REVIEW" ? <button className="btn btn-secondary btn-compact" disabled={busy} onClick={() => setRejecting(true)}>Reject source</button> : null}
    {canReview && ["READY_FOR_REVIEW", "UNDER_REVIEW", "REJECTED"].includes(version.reviewStatus) ? <button className="btn btn-secondary btn-compact" disabled={busy} onClick={() => onReview(version.id, "return-uploaded")}>Return to uploaded</button> : null}
    {rejecting ? <div className="knowledge-inline-decision"><label><span className="label">Rejection reason</span><textarea className="input" value={reason} onChange={(event) => setReason(event.target.value)} /></label><button className="btn btn-secondary btn-compact" onClick={() => setRejecting(false)}>Cancel rejection</button><button className="btn btn-danger btn-compact" disabled={busy || reason.trim().length < 2} onClick={() => { onReview(version.id, "reject", { rejectionReason: reason }); setRejecting(false); }}>Confirm source rejection</button></div> : null}
    {version.reviewStatus === "APPROVED_SOURCE" ? <small>Trusted source only. Its statements still require separate claim approval.{version.supersededAt ? " This approved version has been superseded by a newer upload." : ""}</small> : null}
    {version.rejectionReason ? <small>Rejected: {version.rejectionReason}</small> : null}
    {version.linkedClaimCount ? <small>{version.linkedClaimCount} linked claim source record{version.linkedClaimCount === 1 ? "" : "s"}</small> : null}
    {version.reviewHistory.length ? <details className="source-review-history"><summary>View source review history</summary><ol>{version.reviewHistory.map((event) => <li key={event.id}><strong>{event.previousStatus.replaceAll("_", " ")} to {event.newStatus.replaceAll("_", " ")}</strong><span>{formatDateTime(event.createdAt)} · {event.actor.displayName}</span></li>)}</ol></details> : null}
  </div>;
}

type ClaimStatus = "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "SUPERSEDED" | "EXPIRED";
type ClaimActor = { id: string; displayName: string; username: string };
type ClaimTranslation = {
  locale: string; wording: string; reviewStatus: "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  reviewedBy?: ClaimActor | null; reviewedAt?: string | null; approvedBy?: ClaimActor | null; approvedAt?: string | null;
  reviewNotes?: string | null; rejectionReason?: string | null;
};
type ClaimSource = {
  id: string; pageNumber?: number | null; sectionHeading?: string | null; tableFigureReference?: string | null;
  sourceExcerpt?: string | null; sourceNotes?: string | null;
  documentVersion: {
    id: string; versionNumber: number; reviewStatus: KnowledgeVersion["reviewStatus"]; createdAt: string;
    document: { id: string; title: string; lifecycleStatus: KnowledgeDocument["lifecycleStatus"] };
    file: { originalName: string; downloadUrl: string };
  };
};
type KnowledgeClaim = {
  id: string; stableKey: string; revision: number; claimType: string; status: ClaimStatus;
  usageScope: "PUBLIC_SAFE" | "INTERNAL_ONLY" | "RESTRICTED"; requiredLocales: string[];
  effectiveAt?: string | null; expiresAt?: string | null; restrictions?: string | null; internalNotes?: string | null;
  rejectionReason?: string | null; reviewNotes?: string | null; createdAt: string; updatedAt: string;
  createdBy: ClaimActor; lastEditedBy: ClaimActor; reviewedBy?: ClaimActor | null; reviewedAt?: string | null;
  approvedBy?: ClaimActor | null; approvedAt?: string | null; eligibleForFuturePublicUse: boolean;
  translations: ClaimTranslation[]; sources: ClaimSource[];
  brands: Array<{ brandId: string; brand: { id: string; name: string } }>;
  products: Array<{ productId: string; product: { id: string; name: string } }>;
  packagingFormats: Array<{ packagingFormatId: string; packagingFormat: { id: string; label: string } }>;
  markets: Array<{ value: string }>; audiences: Array<{ value: string }>; objectives: Array<{ value: string }>;
  supersedes?: { id: string; revision: number; status: ClaimStatus } | null;
  supersededBy?: { id: string; revision: number; status: ClaimStatus } | null;
  replacesApproved?: { id: string; revision: number; status: ClaimStatus } | null;
  isLatestRevision?: boolean; isCurrentApproved?: boolean; isHistorical?: boolean; isEditable?: boolean;
};
type ClaimRevisionHistory = { stableKey: string; latestRevisionId: string | null; currentApprovedRevisionId: string | null; revisions: KnowledgeClaim[] };
type ClaimDetailResponse = {
  claim: KnowledgeClaim; revisionHistory: ClaimRevisionHistory;
  auditEvents: Array<{ id: string; action: string; summary: string; createdAt: string; actor?: ClaimActor | null }>;
};
type ClaimReferenceData = {
  brands: Array<{ id: string; name: string }>; products: Array<{ id: string; name: string }>; packagingFormats: Array<{ id: string; label: string }>;
};

function ClaimsPanel({ permissions, selectedDocument, onOpenDocument }: {
  permissions: string[]; selectedDocument: KnowledgeDocument | null; onOpenDocument: (documentId: string) => void;
}) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmRevision, setConfirmRevision] = useState(false);
  const [decision, setDecision] = useState<{ claimId: string; locale?: string } | null>(null);
  const [reason, setReason] = useState("");
  const claims = useQuery<{ claims: KnowledgeClaim[] }>({ queryKey: ["knowledge-claims"], queryFn: () => api("/api/knowledge/claims") });
  const detail = useQuery<ClaimDetailResponse>({
    queryKey: ["knowledge-claim", selectedClaimId],
    queryFn: () => api("/api/knowledge/claims/" + encodeURIComponent(selectedClaimId!)),
    enabled: Boolean(selectedClaimId)
  });
  const refs = useQuery<ClaimReferenceData>({ queryKey: ["knowledge-claim-reference-data"], queryFn: () => api("/api/knowledge/claim-reference-data") });
  const conceptualClaims = useMemo(() => {
    const grouped = new Map<string, KnowledgeClaim[]>();
    for (const claim of claims.data?.claims ?? []) grouped.set(claim.stableKey, [...(grouped.get(claim.stableKey) ?? []), claim]);
    return [...grouped.entries()].map(([stableKey, revisions]) => {
      const ordered = revisions.sort((a, b) => b.revision - a.revision);
      return { stableKey, revisions: ordered, latest: ordered[0], currentApproved: ordered.find((revision) => revision.status === "APPROVED") };
    }).sort((a, b) => a.stableKey.localeCompare(b.stableKey));
  }, [claims.data?.claims]);
  const refresh = async (claimId?: string) => {
    await qc.invalidateQueries({ queryKey: ["knowledge-claims"] });
    await qc.invalidateQueries({ queryKey: ["knowledge-claim", claimId ?? selectedClaimId] });
  };
  const create = useMutation({
    mutationFn: (body: unknown) => post<{ claim: KnowledgeClaim }>("/api/knowledge/claims", body),
    onSuccess: async (result) => { setShowCreate(false); setSelectedClaimId(result.claim.id); await refresh(result.claim.id); }
  });
  const transition = useMutation({
    mutationFn: ({ id, action, locale, body = {} }: { id: string; action: string; locale?: string; body?: Record<string, string> }) =>
      post<{ claim: KnowledgeClaim }>("/api/knowledge/claims/" + encodeURIComponent(id) + (locale ? "/translations/" + encodeURIComponent(locale) : "") + "/" + action, body),
    onSuccess: async (result) => { setDecision(null); setReason(""); await refresh(result.claim.id); }
  });
  const createRevision = useMutation({
    mutationFn: (claim: KnowledgeClaim) => post<{ claim: KnowledgeClaim }>("/api/knowledge/claims/" + encodeURIComponent(claim.id) + "/supersede", claimRevisionPayload(claim)),
    onSuccess: async (result) => { setConfirmRevision(false); setEditing(true); setSelectedClaimId(result.claim.id); await refresh(result.claim.id); }
  });
  const editDraft = useMutation({
    mutationFn: async ({ claim, metadata, translations }: { claim: KnowledgeClaim; metadata: Record<string, unknown>; translations: Array<{ locale: string; wording: string }> }) => {
      await patch("/api/knowledge/claims/" + encodeURIComponent(claim.id), metadata);
      for (const translation of translations) {
        await patch("/api/knowledge/claims/" + encodeURIComponent(claim.id) + "/translations/" + encodeURIComponent(translation.locale), translation);
      }
      return api<ClaimDetailResponse>("/api/knowledge/claims/" + encodeURIComponent(claim.id));
    },
    onSuccess: async (result) => { setEditing(false); await refresh(result.claim.id); }
  });
  const canCreate = permissions.includes("knowledge.claim.create");
  const canEdit = permissions.includes("knowledge.claim.edit");
  const canReview = permissions.includes("knowledge.claim.review");
  const canApprove = permissions.includes("knowledge.claim.approve");
  const approvedVersions = selectedDocument?.versions.filter((version) => version.reviewStatus === "APPROVED_SOURCE") ?? [];
  const selected = detail.data?.claim ?? null;
  const history = detail.data?.revisionHistory;
  const historyEntry = history?.revisions.find((revision) => revision.id === selected?.id);
  const isLatest = history?.latestRevisionId === selected?.id;
  const isEditable = Boolean(selected && historyEntry?.isEditable && canEdit);
  const canStartRevision = Boolean(selected && canCreate && isLatest && (
    selected.status === "REJECTED" || (selected.status === "APPROVED" && history?.currentApprovedRevisionId === selected.id)
  ));
  const error = claims.error ?? detail.error ?? refs.error ?? create.error ?? transition.error ?? createRevision.error ?? editDraft.error;
  return <section className="knowledge-claims">
    <div className="knowledge-section-heading"><div><h2>Approved claims</h2><p>Manual wording, immutable revisions, and source-level provenance.</p></div>{canCreate ? <button className="btn btn-primary" disabled={!approvedVersions.length} onClick={() => setShowCreate((value) => !value)}>{showCreate ? "Close claim form" : "Create manual claim"}</button> : null}</div>
    <div className="notice notice-info" role="note"><strong>Three separate decisions.</strong><span>Source trust, localized wording, and public-safe claim approval are reviewed independently. Claims remain disconnected from AI generation.</span></div>
    {canCreate && !approvedVersions.length ? <p className="knowledge-help">Select a document with an approved source version to create an initial claim.</p> : null}
    {showCreate && approvedVersions.length ? <ClaimCreateForm versions={approvedVersions} references={refs.data} pending={create.isPending} onSubmit={(body) => create.mutate(body)} /> : null}
    {error ? <div className="notice notice-error" role="alert">{formatApiError(error)}</div> : null}
    {claims.isLoading ? <div className="skeleton-block" /> : null}
    <div className="claim-history-workspace">
      <div className="claim-concept-list" aria-label="Knowledge claims">
        {conceptualClaims.map((group) => <button className={group.revisions.some((revision) => revision.id === selectedClaimId) ? "claim-concept-row selected" : "claim-concept-row"} key={group.stableKey} onClick={() => { setSelectedClaimId(group.latest.id); setEditing(false); setConfirmRevision(false); }}>
          <strong>{group.stableKey}</strong><span>{group.latest.claimType}</span><small>{group.revisions.length} revision{group.revisions.length === 1 ? "" : "s"} · {group.currentApproved ? "approved revision " + group.currentApproved.revision : "no approved revision"}</small>
        </button>)}
        {!claims.isLoading && !conceptualClaims.length ? <div className="knowledge-detail-empty"><strong>No manual claims</strong><p>Create the first claim from an approved source version.</p></div> : null}
      </div>
      <div className="claim-revision-detail">
        {!selectedClaimId ? <div className="knowledge-detail-empty"><strong>Select a claim</strong><p>Open a claim to inspect its current approved revision and complete history.</p></div> : null}
        {selectedClaimId && detail.isLoading ? <div className="skeleton-block knowledge-detail-skeleton" /> : null}
        {selected && history ? <>
          <header className="claim-detail-heading"><div><h3>{selected.stableKey}</h3><p>{selected.claimType}</p></div><div><ClaimBadge status={selected.status} />{selected.id === history.currentApprovedRevisionId ? <span className="status-badge status-ok">Current approved</span> : null}{selected.id === history.latestRevisionId ? <span className="status-badge status-neutral">Latest revision</span> : <span className="status-badge status-neutral">Historical revision</span>}</div></header>
          <nav className="claim-revision-tabs" aria-label="Claim revision history">{history.revisions.map((revision) => <button className={revision.id === selected.id ? "selected" : ""} key={revision.id} onClick={() => { setSelectedClaimId(revision.id); setEditing(false); setConfirmRevision(false); }}>
            <strong>Revision {revision.revision}</strong><ClaimBadge status={revision.status} /><small>{formatDate(revision.createdAt)}</small>
          </button>)}</nav>
          {editing && isEditable ? <ClaimDraftEditForm claim={selected} references={refs.data} pending={editDraft.isPending} onCancel={() => setEditing(false)} onSubmit={(metadata, translations) => editDraft.mutate({ claim: selected, metadata, translations })} /> : <ClaimRevisionDetail claim={selected} auditEvents={detail.data?.auditEvents ?? []} onOpenDocument={onOpenDocument} />}
          {!editing ? <div className="claim-primary-actions">
            {isEditable ? <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit draft revision</button> : null}
            {canEdit && selected.status === "DRAFT" && isLatest ? <button className="btn btn-secondary" disabled={transition.isPending} onClick={() => transition.mutate({ id: selected.id, action: "submit-review" })}>Submit claim review</button> : null}
            {canApprove && selected.status === "UNDER_REVIEW" && isLatest ? <button className="btn btn-primary" disabled={transition.isPending} onClick={() => transition.mutate({ id: selected.id, action: "approve" })}>Approve revision</button> : null}
            {canReview && selected.status === "UNDER_REVIEW" && isLatest ? <button className="btn btn-secondary" disabled={transition.isPending} onClick={() => setDecision({ claimId: selected.id })}>Reject revision</button> : null}
            {canStartRevision ? <button className="btn btn-secondary" onClick={() => setConfirmRevision(true)}>Create draft revision</button> : null}
          </div> : null}
          {!editing ? <p className="claim-action-reason">{claimActionUnavailableReason(selected, Boolean(isLatest), canEdit, canCreate)}</p> : null}
          {confirmRevision ? <div className="knowledge-inline-decision" role="alert"><p>Create revision {selected.revision + 1}? {history.currentApprovedRevisionId ? "The current approved revision remains active until this draft passes review and is approved." : "The rejected revision remains immutable while the new draft starts a separate review."}</p><button className="btn btn-secondary btn-compact" onClick={() => setConfirmRevision(false)}>Cancel revision</button><button className="btn btn-primary btn-compact" disabled={createRevision.isPending} onClick={() => createRevision.mutate(selected)}>{createRevision.isPending ? "Creating revision" : "Create draft revision"}</button></div> : null}
          <ClaimLocaleActions claim={selected} isLatest={Boolean(isLatest)} canEdit={canEdit} canReview={canReview} canApprove={canApprove} onTransition={(locale, action) => transition.mutate({ id: selected.id, locale, action })} onReject={(locale) => setDecision({ claimId: selected.id, locale })} />
        </> : null}
      </div>
    </div>
    {decision ? <div className="knowledge-inline-decision"><label><span className="label">Rejection reason</span><textarea className="input" value={reason} onChange={(event) => setReason(event.target.value)} /></label><button className="btn btn-secondary btn-compact" onClick={() => setDecision(null)}>Cancel rejection</button><button className="btn btn-danger btn-compact" disabled={reason.trim().length < 2 || transition.isPending} onClick={() => transition.mutate({ id: decision.claimId, locale: decision.locale, action: "reject", body: { rejectionReason: reason } })}>Confirm rejection</button></div> : null}
  </section>;
}

/* Retired Phase 1B checkpoint panel. Kept outside compilation only to avoid rewriting synced-drive bytes during this patch series.
function LegacyClaimsPanel({ permissions, selectedDocument }: { permissions: string[]; selectedDocument: KnowledgeDocument | null }) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [decision, setDecision] = useState<{ claimId: string; action: "reject"; locale?: string } | null>(null);
  const [reason, setReason] = useState("");
  const claims = useQuery<{ claims: KnowledgeClaim[] }>({ queryKey: ["knowledge-claims"], queryFn: () => api("/api/knowledge/claims") });
  const refs = useQuery<{ brands: Array<{ id: string; name: string }>; products: Array<{ id: string; name: string }>; packagingFormats: Array<{ id: string; label: string }> }>({
    queryKey: ["knowledge-claim-reference-data"], queryFn: () => api("/api/knowledge/claim-reference-data")
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["knowledge-claims"] });
  const create = useMutation({
    mutationFn: (body: unknown) => post("/api/knowledge/claims", body),
    onSuccess: async () => { setShowCreate(false); await refresh(); }
  });
  const transition = useMutation({
    mutationFn: ({ id, action, locale, body = {} }: { id: string; action: string; locale?: string; body?: Record<string, string> }) =>
      post("/api/knowledge/claims/" + encodeURIComponent(id) + (locale ? "/translations/" + encodeURIComponent(locale) : "") + "/" + action, body),
    onSuccess: async () => { setDecision(null); setReason(""); await refresh(); }
  });
  const canCreate = permissions.includes("knowledge.claim.create");
  const canEdit = permissions.includes("knowledge.claim.edit");
  const canReview = permissions.includes("knowledge.claim.review");
  const canApprove = permissions.includes("knowledge.claim.approve");
  const approvedVersions = selectedDocument?.versions.filter((version) => version.reviewStatus === "APPROVED_SOURCE") ?? [];
  const error = claims.error ?? refs.error ?? create.error ?? transition.error;
  return <section className="knowledge-claims">
    <div className="knowledge-section-heading"><div><h2>Approved claims</h2><p>Manual wording with version-level provenance and locale-specific review.</p></div>{canCreate ? <button className="btn btn-primary" disabled={!approvedVersions.length} onClick={() => setShowCreate((value) => !value)}>{showCreate ? "Close claim form" : "Create manual claim"}</button> : null}</div>
    <div className="notice notice-info" role="note"><strong>Three separate decisions.</strong><span>A trusted source does not approve its statements. Each locale is reviewed independently. Approved public-safe claims are not connected to AI generation yet.</span></div>
    {canCreate && !approvedVersions.length ? <p className="knowledge-help">Select a document with an approved source version to create a claim.</p> : null}
    {showCreate && approvedVersions.length ? <ClaimCreateForm versions={approvedVersions} references={refs.data} pending={create.isPending} onSubmit={(body) => create.mutate(body)} /> : null}
    {error ? <div className="notice notice-error" role="alert">{error.message}</div> : null}
    {claims.isLoading ? <div className="skeleton-block" /> : null}
    <div className="knowledge-claim-list">{claims.data?.claims.map((claim) => <article className="knowledge-claim-row" key={claim.id}>
      <header><div><strong>{claim.stableKey} <span>revision {claim.revision}</span></strong><p>{claim.claimType}</p></div><div><ClaimBadge status={claim.status} /><span className="status-badge status-neutral">{claim.usageScope.replaceAll("_", " ")}</span></div></header>
      <div className="knowledge-translation-list">{claim.translations.map((translation) => <div key={translation.locale} lang={translation.locale} dir={translation.locale.toLowerCase().startsWith("ar") ? "rtl" : "ltr"}><strong>{translation.locale.toUpperCase()} · {translation.reviewStatus.replaceAll("_", " ")}</strong><p>{translation.wording}</p><div className="knowledge-review-actions">
        {canEdit && ["DRAFT", "REJECTED"].includes(translation.reviewStatus) ? <button className="btn btn-secondary btn-compact" onClick={() => transition.mutate({ id: claim.id, locale: translation.locale, action: "submit-review" })}>Submit {translation.locale.toUpperCase()} wording</button> : null}
        {canApprove && translation.reviewStatus === "UNDER_REVIEW" ? <button className="btn btn-primary btn-compact" onClick={() => transition.mutate({ id: claim.id, locale: translation.locale, action: "approve" })}>Approve {translation.locale.toUpperCase()} wording</button> : null}
        {canReview && translation.reviewStatus === "UNDER_REVIEW" ? <button className="btn btn-secondary btn-compact" onClick={() => setDecision({ claimId: claim.id, locale: translation.locale, action: "reject" })}>Reject {translation.locale.toUpperCase()} wording</button> : null}
      </div></div>)}</div>
      <footer><span>Source: {claim.sources.map((source) => source.documentVersion.document.title + " v" + source.documentVersion.versionNumber).join(", ")}</span><div className="knowledge-review-actions">
        {canEdit && ["DRAFT", "REJECTED"].includes(claim.status) ? <button className="btn btn-secondary btn-compact" onClick={() => transition.mutate({ id: claim.id, action: "submit-review" })}>Submit claim review</button> : null}
        {canApprove && claim.status === "UNDER_REVIEW" ? <button className="btn btn-primary btn-compact" onClick={() => transition.mutate({ id: claim.id, action: "approve" })}>Approve claim</button> : null}
        {canReview && claim.status === "UNDER_REVIEW" ? <button className="btn btn-secondary btn-compact" onClick={() => setDecision({ claimId: claim.id, action: "reject" })}>Reject claim</button> : null}
      </div></footer>
    </article>)}</div>
    {decision ? <div className="knowledge-inline-decision"><label><span className="label">Rejection reason</span><textarea className="input" value={reason} onChange={(event) => setReason(event.target.value)} /></label><button className="btn btn-secondary btn-compact" onClick={() => setDecision(null)}>Cancel rejection</button><button className="btn btn-danger btn-compact" disabled={reason.trim().length < 2 || transition.isPending} onClick={() => transition.mutate({ id: decision.claimId, locale: decision.locale, action: "reject", body: { rejectionReason: reason } })}>Confirm rejection</button></div> : null}
  </section>;
}

*/
function ClaimRevisionDetail({ claim, auditEvents, onOpenDocument }: {
  claim: KnowledgeClaim; auditEvents: ClaimDetailResponse["auditEvents"]; onOpenDocument: (documentId: string) => void;
}) {
  return <div className="claim-detail-sections">
    <section><h4>Revision record</h4><dl className="knowledge-metadata">
      <div><dt>Revision</dt><dd>{claim.revision}</dd></div><div><dt>Usage scope</dt><dd>{claim.usageScope.replaceAll("_", " ")}</dd></div>
      <div><dt>Created</dt><dd>{formatDateTime(claim.createdAt)} by {claim.createdBy.displayName}</dd></div><div><dt>Last edited</dt><dd>{formatDateTime(claim.updatedAt)} by {claim.lastEditedBy.displayName}</dd></div>
      <div><dt>Reviewed</dt><dd>{claim.reviewedAt ? formatDateTime(claim.reviewedAt) + (claim.reviewedBy ? " by " + claim.reviewedBy.displayName : "") : "Not reviewed"}</dd></div>
      <div><dt>Approved</dt><dd>{claim.approvedAt ? formatDateTime(claim.approvedAt) + (claim.approvedBy ? " by " + claim.approvedBy.displayName : "") : "Not approved"}</dd></div>
      <div><dt>Effective</dt><dd>{claim.effectiveAt ? formatDateTime(claim.effectiveAt) : "Immediately after approval"}</dd></div><div><dt>Expires</dt><dd>{claim.expiresAt ? formatDateTime(claim.expiresAt) : "No expiration"}</dd></div>
      <div className="knowledge-wide"><dt>Restrictions</dt><dd>{claim.restrictions || "None recorded"}</dd></div>
      <div className="knowledge-wide"><dt>Internal notes</dt><dd>{claim.internalNotes || "None recorded"}</dd></div>
      {claim.rejectionReason ? <div className="knowledge-wide"><dt>Rejection reason</dt><dd>{claim.rejectionReason}</dd></div> : null}
    </dl></section>
    <section><h4>Localized wording</h4><div className="knowledge-translation-list">{claim.translations.map((translation) => <div key={translation.locale} lang={translation.locale} dir={translation.locale.toLowerCase().startsWith("ar") ? "rtl" : "ltr"}>
      <strong>{translation.locale.toUpperCase()} · {translation.reviewStatus.replaceAll("_", " ")}</strong><p>{translation.wording}</p>
      <small>{translation.approvedAt ? "Approved " + formatDateTime(translation.approvedAt) + (translation.approvedBy ? " by " + translation.approvedBy.displayName : "") : translation.reviewedAt ? "Reviewed " + formatDateTime(translation.reviewedAt) + (translation.reviewedBy ? " by " + translation.reviewedBy.displayName : "") : "No review decision"}</small>
      {translation.rejectionReason ? <small>Rejected: {translation.rejectionReason}</small> : null}
    </div>)}</div></section>
    <section><h4>Applicability</h4><dl className="knowledge-metadata">
      <div><dt>Brands</dt><dd>{claim.brands.map((item) => item.brand.name).join(", ") || "None"}</dd></div>
      <div><dt>Products</dt><dd>{claim.products.map((item) => item.product.name).join(", ") || "None"}</dd></div>
      <div><dt>Packaging</dt><dd>{claim.packagingFormats.map((item) => item.packagingFormat.label).join(", ") || "None"}</dd></div>
      <div><dt>Markets</dt><dd>{claim.markets.map((item) => item.value).join(", ") || "None"}</dd></div>
      <div><dt>Audiences</dt><dd>{claim.audiences.map((item) => item.value).join(", ") || "None"}</dd></div>
      <div><dt>Objectives</dt><dd>{claim.objectives.map((item) => item.value).join(", ") || "None"}</dd></div>
    </dl></section>
    <section><h4>Source provenance</h4><ol className="claim-source-list">{claim.sources.map((source) => <li key={source.id}><div><strong>{source.documentVersion.document.title} · version {source.documentVersion.versionNumber}</strong><span>{source.documentVersion.file.originalName}</span><small>{source.pageNumber ? "Page " + source.pageNumber : "Page not specified"}{source.sectionHeading ? " · " + source.sectionHeading : ""}{source.tableFigureReference ? " · " + source.tableFigureReference : ""}</small>{source.sourceExcerpt ? <blockquote>{source.sourceExcerpt}</blockquote> : null}{source.sourceNotes ? <small>Source notes: {source.sourceNotes}</small> : null}</div><div><button className="btn btn-secondary btn-compact" onClick={() => onOpenDocument(source.documentVersion.document.id)}>Open source document</button><a className="btn btn-secondary btn-compact" href={source.documentVersion.file.downloadUrl}>Download source version</a></div></li>)}</ol></section>
    <section><h4>Revision activity</h4>{auditEvents.length ? <ol className="knowledge-audit-list">{auditEvents.map((event) => <li key={event.id}><strong>{event.summary}</strong><span>{formatDateTime(event.createdAt)}{event.actor ? " · " + event.actor.displayName : ""}</span></li>)}</ol> : <p className="knowledge-help">No audit events recorded for this revision.</p>}</section>
  </div>;
}

function ClaimLocaleActions({ claim, isLatest, canEdit, canReview, canApprove, onTransition, onReject }: {
  claim: KnowledgeClaim; isLatest: boolean; canEdit: boolean; canReview: boolean; canApprove: boolean;
  onTransition: (locale: string, action: string) => void; onReject: (locale: string) => void;
}) {
  return <section className="claim-locale-actions"><h4>Localized wording review</h4>{claim.translations.map((translation) => <div className="claim-locale-action" key={translation.locale}><span><strong>{translation.locale.toUpperCase()}</strong><small>{translation.reviewStatus.replaceAll("_", " ")}</small></span><div>
    {canEdit && claim.status === "DRAFT" && isLatest && translation.reviewStatus === "DRAFT" ? <button className="btn btn-secondary btn-compact" onClick={() => onTransition(translation.locale, "submit-review")}>Submit {translation.locale.toUpperCase()} wording</button> : null}
    {canApprove && ["DRAFT", "UNDER_REVIEW"].includes(claim.status) && isLatest && translation.reviewStatus === "UNDER_REVIEW" ? <button className="btn btn-primary btn-compact" onClick={() => onTransition(translation.locale, "approve")}>Approve {translation.locale.toUpperCase()} wording</button> : null}
    {canReview && ["DRAFT", "UNDER_REVIEW"].includes(claim.status) && isLatest && translation.reviewStatus === "UNDER_REVIEW" ? <button className="btn btn-secondary btn-compact" onClick={() => onReject(translation.locale)}>Reject {translation.locale.toUpperCase()} wording</button> : null}
    {!isLatest || ["APPROVED", "REJECTED", "SUPERSEDED", "EXPIRED"].includes(claim.status) ? <small>Read-only historical wording</small> : null}
  </div></div>)}</section>;
}

function ClaimDraftEditForm({ claim, references, pending, onCancel, onSubmit }: {
  claim: KnowledgeClaim; references?: ClaimReferenceData; pending: boolean; onCancel: () => void;
  onSubmit: (metadata: Record<string, unknown>, translations: Array<{ locale: string; wording: string }>) => void;
}) {
  const [validationError, setValidationError] = useState<string | null>(null);
  return <form className="knowledge-upload-form claim-edit-form" onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const applicability = {
      brandIds: data.getAll("brandIds").map(String), productIds: data.getAll("productIds").map(String),
      packagingFormatIds: data.getAll("packagingFormatIds").map(String),
      markets: splitValues(String(data.get("markets") || "")), audiences: splitValues(String(data.get("audiences") || "")), objectives: splitValues(String(data.get("objectives") || ""))
    };
    if (!Object.values(applicability).some((items) => items.length)) { setValidationError("Set at least one brand, product, packaging, market, audience, or objective."); return; }
    const sources = claim.sources.map((source, index) => ({
      documentVersionId: source.documentVersion.id,
      pageNumber: data.get("sourcePage" + index) ? Number(data.get("sourcePage" + index)) : undefined,
      sectionHeading: String(data.get("sourceSection" + index) || ""),
      tableFigureReference: String(data.get("sourceReference" + index) || ""),
      sourceExcerpt: String(data.get("sourceExcerpt" + index) || ""),
      sourceNotes: String(data.get("sourceNotes" + index) || "")
    }));
    const sourceChanged = JSON.stringify(sources) !== JSON.stringify(claim.sources.map((source) => ({
      documentVersionId: source.documentVersion.id, pageNumber: source.pageNumber ?? undefined,
      sectionHeading: source.sectionHeading || "", tableFigureReference: source.tableFigureReference || "",
      sourceExcerpt: source.sourceExcerpt || "", sourceNotes: source.sourceNotes || ""
    })));
    const translations = claim.translations.map((translation) => ({ locale: translation.locale, wording: String(data.get("wording-" + translation.locale) || "").trim() })).filter((translation) => translation.wording && translation.wording !== claim.translations.find((current) => current.locale === translation.locale)?.wording);
    setValidationError(null);
    onSubmit({
      claimType: data.get("claimType"), usageScope: data.get("usageScope"), requiredLocales: claim.requiredLocales,
      effectiveAt: data.get("effectiveAt") || null, expiresAt: data.get("expiresAt") || null,
      restrictions: String(data.get("restrictions") || "") || null, internalNotes: String(data.get("internalNotes") || "") || null,
      applicability, ...(sourceChanged ? { sources } : {})
    }, translations);
  }}>
    <div className="form-heading"><h4>Edit draft revision {claim.revision}</h4><p>Only wording still in DRAFT can be edited. Reviewed locales remain locked.</p></div>
    <RequiredInput name="claimType" label="Claim type" defaultValue={claim.claimType} />
    <label><span className="label">Usage scope</span><select className="input" name="usageScope" defaultValue={claim.usageScope}><option value="INTERNAL_ONLY">Internal only</option><option value="RESTRICTED">Restricted</option><option value="PUBLIC_SAFE">Public safe</option></select></label>
    <label><span className="label">Effective date</span><input className="input" type="date" name="effectiveAt" defaultValue={dateInputValue(claim.effectiveAt)} /></label>
    <label><span className="label">Expiration date</span><input className="input" type="date" name="expiresAt" defaultValue={dateInputValue(claim.expiresAt)} /></label>
    {claim.translations.map((translation) => <label className="form-span-2" key={translation.locale} dir={translation.locale.toLowerCase().startsWith("ar") ? "rtl" : "ltr"}><span className="label">{translation.locale.toUpperCase()} wording - {translation.reviewStatus.replaceAll("_", " ")}</span><textarea className="input" name={"wording-" + translation.locale} required disabled={translation.reviewStatus !== "DRAFT"} defaultValue={translation.wording} />{translation.reviewStatus !== "DRAFT" ? <small>Reviewed wording is locked. Create a new claim revision to change it.</small> : null}</label>)}
    <MultiSelect name="brandIds" label="Brands" options={references?.brands.map((item) => ({ id: item.id, label: item.name })) ?? []} selected={claim.brands.map((item) => item.brandId)} />
    <MultiSelect name="productIds" label="Products" options={references?.products.map((item) => ({ id: item.id, label: item.name })) ?? []} selected={claim.products.map((item) => item.productId)} />
    <MultiSelect name="packagingFormatIds" label="Packaging formats" options={references?.packagingFormats.map((item) => ({ id: item.id, label: item.label })) ?? []} selected={claim.packagingFormats.map((item) => item.packagingFormatId)} />
    <label><span className="label">Markets</span><input className="input" name="markets" defaultValue={claim.markets.map((item) => item.value).join(", ")} placeholder="Comma-separated" /></label>
    <label><span className="label">Audiences</span><input className="input" name="audiences" defaultValue={claim.audiences.map((item) => item.value).join(", ")} placeholder="Comma-separated" /></label>
    <label><span className="label">Objectives</span><input className="input" name="objectives" defaultValue={claim.objectives.map((item) => item.value).join(", ")} placeholder="Comma-separated" /></label>
    {claim.sources.map((source, index) => <fieldset className="claim-source-editor form-span-2" key={source.id}><legend>{source.documentVersion.document.title} · version {source.documentVersion.versionNumber}</legend>
      <label><span className="label">Page</span><input className="input" type="number" min="1" name={"sourcePage" + index} defaultValue={source.pageNumber ?? ""} /></label>
      <label><span className="label">Section</span><input className="input" name={"sourceSection" + index} defaultValue={source.sectionHeading || ""} /></label>
      <label><span className="label">Table or figure</span><input className="input" name={"sourceReference" + index} defaultValue={source.tableFigureReference || ""} /></label>
      <label><span className="label">Source notes</span><input className="input" name={"sourceNotes" + index} defaultValue={source.sourceNotes || ""} /></label>
      <label className="form-span-2"><span className="label">Short excerpt</span><textarea className="input" name={"sourceExcerpt" + index} defaultValue={source.sourceExcerpt || ""} /></label>
    </fieldset>)}
    <label className="form-span-2"><span className="label">Restrictions</span><textarea className="input" name="restrictions" defaultValue={claim.restrictions || ""} /></label>
    <label className="form-span-2"><span className="label">Internal notes</span><textarea className="input" name="internalNotes" defaultValue={claim.internalNotes || ""} /></label>
    {validationError ? <div className="notice notice-error form-span-2" role="alert">{validationError}</div> : null}
    <div className="form-actions form-span-2"><button type="button" className="btn btn-secondary" disabled={pending} onClick={onCancel}>Cancel editing</button><button className="btn btn-primary" disabled={pending}>{pending ? "Saving draft" : "Save draft revision"}</button></div>
  </form>;
}

function MultiSelect({ name, label, options, selected }: { name: string; label: string; options: Array<{ id: string; label: string }>; selected: string[] }) {
  return <label><span className="label">{label}</span><select className="input claim-multi-select" name={name} multiple defaultValue={selected}>{options.map((option) => <option value={option.id} key={option.id}>{option.label}</option>)}</select></label>;
}

function claimRevisionPayload(claim: KnowledgeClaim) {
  return {
    stableKey: claim.stableKey, claimType: claim.claimType, usageScope: claim.usageScope, requiredLocales: claim.requiredLocales,
    effectiveAt: claim.effectiveAt || undefined, expiresAt: claim.expiresAt || undefined,
    restrictions: claim.restrictions || "", internalNotes: claim.internalNotes || "",
    translations: claim.translations.map((translation) => ({ locale: translation.locale, wording: translation.wording })),
    sources: claim.sources.map((source) => ({
      documentVersionId: source.documentVersion.id, pageNumber: source.pageNumber ?? undefined,
      sectionHeading: source.sectionHeading || "", tableFigureReference: source.tableFigureReference || "",
      sourceExcerpt: source.sourceExcerpt || "", sourceNotes: source.sourceNotes || ""
    })),
    applicability: {
      brandIds: claim.brands.map((item) => item.brandId), productIds: claim.products.map((item) => item.productId),
      packagingFormatIds: claim.packagingFormats.map((item) => item.packagingFormatId),
      markets: claim.markets.map((item) => item.value), audiences: claim.audiences.map((item) => item.value), objectives: claim.objectives.map((item) => item.value)
    }
  };
}
function claimActionUnavailableReason(claim: KnowledgeClaim, isLatest: boolean, canEdit: boolean, canCreate: boolean) {
  if (!isLatest) return "Historical revisions are read-only.";
  if (claim.status === "SUPERSEDED") return "This revision was replaced and is permanently read-only.";
  if (claim.status === "EXPIRED") return "Expired revisions remain available for audit and cannot be edited.";
  if (claim.status === "REJECTED") return canCreate ? "Create a new draft revision to make corrections. Rejected wording remains immutable." : "This rejected revision is read-only.";
  if (claim.status === "APPROVED") return canCreate ? "Create a draft revision to propose changes without altering the approved record." : "Approved revisions are read-only.";
  if (claim.status === "UNDER_REVIEW") return "This revision is locked while reviewers decide it.";
  if (claim.status === "DRAFT" && !canEdit) return "You do not have permission to edit this draft.";
  return "";
}
function formatApiError(error: Error) {
  if (!(error instanceof ApiError)) return error.message;
  if (error.status === 401) return "Your session has expired. Sign in again to continue.";
  if (error.status === 403) return "You do not have permission to perform this action.";
  if (error.status === 404) return "The requested claim, revision, or source no longer exists.";
  if (error.status === 409) return error.message || "The record changed before this action completed. Refresh and try again.";
  if (error.status === 422) return "Approval requirements are incomplete: " + error.message;
  return error.message;
}
function splitValues(value: string) { return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))]; }
function dateInputValue(value?: string | null) { return value ? new Date(value).toISOString().slice(0, 10) : ""; }

function ClaimCreateForm({ versions, references, pending, onSubmit }: {
  versions: KnowledgeVersion[];
  references?: { brands: Array<{ id: string; name: string }>; products: Array<{ id: string; name: string }>; packagingFormats: Array<{ id: string; label: string }> };
  pending: boolean; onSubmit: (body: unknown) => void;
}) {
  return <form className="knowledge-upload-form" onSubmit={(event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const english = String(data.get("english") || "").trim();
    const arabic = String(data.get("arabic") || "").trim();
    const translations = [{ locale: "en", wording: english }, ...(arabic ? [{ locale: "ar", wording: arabic }] : [])];
    const applicability = {
      brandIds: data.get("brandId") ? [String(data.get("brandId"))] : [],
      productIds: data.get("productId") ? [String(data.get("productId"))] : [],
      packagingFormatIds: data.get("packagingFormatId") ? [String(data.get("packagingFormatId"))] : [],
      markets: data.get("market") ? [String(data.get("market"))] : [],
      audiences: data.get("audience") ? [String(data.get("audience"))] : [],
      objectives: data.get("objective") ? [String(data.get("objective"))] : []
    };
    onSubmit({
      stableKey: data.get("stableKey"), claimType: data.get("claimType"), usageScope: data.get("usageScope"),
      requiredLocales: translations.map((item) => item.locale), translations,
      effectiveAt: data.get("effectiveAt") || undefined, expiresAt: data.get("expiresAt") || undefined,
      restrictions: data.get("restrictions"), internalNotes: data.get("internalNotes"),
      sources: [{
        documentVersionId: data.get("documentVersionId"), pageNumber: data.get("pageNumber") ? Number(data.get("pageNumber")) : undefined,
        sectionHeading: data.get("sectionHeading"), tableFigureReference: data.get("tableFigureReference"),
        sourceExcerpt: data.get("sourceExcerpt"), sourceNotes: data.get("sourceNotes")
      }],
      applicability
    });
  }}>
    <div className="form-heading"><h3>Create claim from approved source</h3><p>Enter only wording verified against the selected immutable version.</p></div>
    <RequiredInput name="stableKey" label="Stable claim key" placeholder="future-oils.product.fact" />
    <RequiredInput name="claimType" label="Claim type" placeholder="Product specification" />
    <label><span className="label">Usage scope</span><select className="input" name="usageScope" required><option value="INTERNAL_ONLY">Internal only</option><option value="RESTRICTED">Restricted</option><option value="PUBLIC_SAFE">Public safe</option></select></label>
    <label><span className="label">Approved source version</span><select className="input" name="documentVersionId" required>{versions.map((version) => <option value={version.id} key={version.id}>Version {version.versionNumber} · {version.file.originalName}</option>)}</select></label>
    <label className="form-span-2"><span className="label">English wording</span><textarea className="input" name="english" required /></label>
    <label className="form-span-2"><span className="label">Arabic wording (optional)</span><textarea className="input" name="arabic" dir="rtl" /></label>
    <label><span className="label">Brand</span><select className="input" name="brandId"><option value="">Not brand-specific</option>{references?.brands.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
    <label><span className="label">Product</span><select className="input" name="productId"><option value="">Not product-specific</option>{references?.products.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
    <label><span className="label">Packaging format</span><select className="input" name="packagingFormatId"><option value="">Not packaging-specific</option>{references?.packagingFormats.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
    <label><span className="label">Market</span><input className="input" name="market" placeholder="Optional" /></label>
    <label><span className="label">Audience</span><input className="input" name="audience" placeholder="Optional" /></label>
    <label><span className="label">Content objective</span><input className="input" name="objective" placeholder="Optional" /></label>
    <label><span className="label">Page number</span><input className="input" name="pageNumber" type="number" min="1" /></label>
    <label><span className="label">Section or heading</span><input className="input" name="sectionHeading" /></label>
    <label><span className="label">Table or figure</span><input className="input" name="tableFigureReference" /></label>
    <label><span className="label">Source notes</span><input className="input" name="sourceNotes" /></label>
    <label><span className="label">Effective date</span><input className="input" name="effectiveAt" type="date" /></label>
    <label><span className="label">Expiration date</span><input className="input" name="expiresAt" type="date" /></label>
    <label className="form-span-2"><span className="label">Short source excerpt</span><textarea className="input" name="sourceExcerpt" maxLength={3000} /></label>
    <label className="form-span-2"><span className="label">Restrictions</span><textarea className="input" name="restrictions" maxLength={5000} /></label>
    <label className="form-span-2"><span className="label">Internal notes</span><textarea className="input" name="internalNotes" maxLength={5000} /></label>
    <div className="form-actions form-span-2"><button className="btn btn-primary" disabled={pending}>{pending ? "Creating claim" : "Create draft claim"}</button></div>
  </form>;
}

function ReviewBadge({ status }: { status: KnowledgeVersion["reviewStatus"] }) {
  const tone = status === "APPROVED_SOURCE" ? "status-ok" : status === "REJECTED" ? "status-fail" : status === "UNDER_REVIEW" || status === "READY_FOR_REVIEW" ? "status-waiting" : "status-neutral";
  return <span className={"status-badge " + tone}>{status.replaceAll("_", " ")}</span>;
}
function ClaimBadge({ status }: { status: KnowledgeClaim["status"] }) {
  const tone = status === "APPROVED" ? "status-ok" : status === "REJECTED" || status === "EXPIRED" ? "status-fail" : status === "UNDER_REVIEW" ? "status-waiting" : "status-neutral";
  return <span className={"status-badge " + tone}>{status.replaceAll("_", " ")}</span>;
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
