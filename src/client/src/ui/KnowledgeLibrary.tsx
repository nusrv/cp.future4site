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
    <ClaimsPanel permissions={permissions} selectedDocument={selected} />
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
  </div>;
}

type KnowledgeClaim = {
  id: string; stableKey: string; revision: number; claimType: string;
  status: "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "SUPERSEDED" | "EXPIRED";
  usageScope: "PUBLIC_SAFE" | "INTERNAL_ONLY" | "RESTRICTED";
  eligibleForFuturePublicUse: boolean;
  translations: Array<{ locale: string; wording: string; reviewStatus: "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" }>;
  sources: Array<{ documentVersion: { id: string; versionNumber: number; document: { title: string } } }>;
};

function ClaimsPanel({ permissions, selectedDocument }: { permissions: string[]; selectedDocument: KnowledgeDocument | null }) {
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
      sources: [{ documentVersionId: data.get("documentVersionId"), pageNumber: data.get("pageNumber") ? Number(data.get("pageNumber")) : undefined, sectionHeading: data.get("sectionHeading"), sourceExcerpt: data.get("sourceExcerpt") }],
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
    <label className="form-span-2"><span className="label">Short source excerpt</span><textarea className="input" name="sourceExcerpt" maxLength={3000} /></label>
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
