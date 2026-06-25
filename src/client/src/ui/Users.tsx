import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, patch, post } from "../api";
import { Header } from "./Dashboard";

const roleOptions = ["OWNER_ADMIN", "MARKETING", "CONTENT_REVIEWER", "AUTOMATION_MAINTAINER", "COMMERCIAL_SALES", "OPERATIONS", "SUPPLIER_MANAGEMENT", "READ_ONLY_MANAGEMENT"];

export function Users() {
  const qc = useQueryClient();
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [passwordUser, setPasswordUser] = useState<any | null>(null);
  const { data } = useQuery({ queryKey: ["users"], queryFn: () => api<any>("/api/admin/users") });
  const refresh = () => qc.invalidateQueries({ queryKey: ["users"] });
  const create = useMutation({ mutationFn: (body: any) => post("/api/admin/users", body), onSuccess: refresh });
  const update = useMutation({ mutationFn: ({ id, body }: any) => patch(`/api/admin/users/${id}`, body), onSuccess: refresh });
  const resetPassword = useMutation({ mutationFn: ({ id, temporaryPassword }: any) => post(`/api/admin/users/${id}/reset-password`, { temporaryPassword }), onSuccess: refresh });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: refresh
  });

  return (
    <section>
      <Header title="User administration" subtitle="Create, edit, disable, delete, and reset passwords for internal platform users." />
      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <form className="panel p-5 space-y-3" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          create.mutate({
            username: String(form.get("username")),
            displayName: String(form.get("displayName")),
            email: String(form.get("email")),
            temporaryPassword: String(form.get("temporaryPassword")),
            roleKeys: [String(form.get("role"))]
          });
          event.currentTarget.reset();
        }}>
          <h2 className="font-black text-xl">Add user</h2>
          <Field name="username" label="Username" />
          <Field name="displayName" label="Display name" />
          <Field name="email" label="Email" required={false} />
          <Field name="temporaryPassword" label="Temporary password" type="password" />
          <label><span className="label">Role</span><select className="input" name="role">{roleOptions.map((r) => <option key={r}>{r}</option>)}</select></label>
          <button className="btn btn-primary">Create user</button>
          {create.error ? <p className="text-red-700 text-sm">{create.error.message}</p> : null}
        </form>

        <div className="panel p-5 overflow-x-auto">
          <table className="table">
            <thead><tr><th>User</th><th>Roles</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{data?.users?.map((user: any) => (
              <tr key={user.id}>
                <td><strong>{user.displayName}</strong><br /><span className="text-sm text-[var(--text-muted)]">{user.username}{user.email ? ` · ${user.email}` : ""}</span></td>
                <td>{user.roles?.join(", ")}</td>
                <td><span className={`badge ${user.status === "ACTIVE" ? "badge-ok" : "badge-fail"}`}>{user.status}</span></td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-secondary" onClick={() => setEditingUser(user)}>Edit</button>
                    <button className="btn btn-secondary" onClick={() => setPasswordUser(user)}>Change password</button>
                    <button className="btn btn-secondary" onClick={() => update.mutate({ id: user.id, body: { status: user.status === "ACTIVE" ? "DISABLED" : "ACTIVE" } })}>{user.status === "ACTIVE" ? "Disable" : "Reactivate"}</button>
                    <button className="btn btn-danger" onClick={() => {
                      if (confirm(`Delete user ${user.username}? This removes their login access and sessions.`)) remove.mutate(user.id);
                    }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table>
          {update.error ? <p className="mt-3 text-red-700 text-sm">{update.error.message}</p> : null}
          {remove.error ? <p className="mt-3 text-red-700 text-sm">{remove.error.message}</p> : null}
        </div>
      </div>

      {editingUser ? <EditUserPanel user={editingUser} onClose={() => setEditingUser(null)} update={update} /> : null}
      {passwordUser ? <PasswordPanel user={passwordUser} onClose={() => setPasswordUser(null)} resetPassword={resetPassword} /> : null}
    </section>
  );
}

function EditUserPanel({ user, onClose, update }: { user: any; onClose: () => void; update: any }) {
  return (
    <form className="panel p-5 mt-5 space-y-3" onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      update.mutate({
        id: user.id,
        body: {
          displayName: String(form.get("displayName")),
          email: String(form.get("email")) || null,
          status: String(form.get("status")),
          roleKeys: [String(form.get("role"))]
        }
      }, { onSuccess: onClose });
    }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-black text-xl">Edit user: {user.username}</h2>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field name="displayName" label="Display name" defaultValue={user.displayName} />
        <Field name="email" label="Email" defaultValue={user.email ?? ""} required={false} />
        <label><span className="label">Status</span><select className="input" name="status" defaultValue={user.status}><option>ACTIVE</option><option>DISABLED</option></select></label>
        <label><span className="label">Role</span><select className="input" name="role" defaultValue={user.roles?.[0] ?? "READ_ONLY_MANAGEMENT"}>{roleOptions.map((r) => <option key={r}>{r}</option>)}</select></label>
      </div>
      <button className="btn btn-primary">Save user changes</button>
    </form>
  );
}

function PasswordPanel({ user, onClose, resetPassword }: { user: any; onClose: () => void; resetPassword: any }) {
  return (
    <form className="panel p-5 mt-5 space-y-3" onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      resetPassword.mutate({ id: user.id, temporaryPassword: String(form.get("temporaryPassword")) }, { onSuccess: onClose });
    }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-black text-xl">Change password: {user.username}</h2>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Close</button>
      </div>
      <Field name="temporaryPassword" label="New temporary password" type="password" />
      <p className="text-sm text-[var(--text-muted)]">The user will be forced to change this password after login. Existing sessions are revoked.</p>
      <button className="btn btn-primary">Reset password</button>
      {resetPassword.error ? <p className="text-red-700 text-sm">{resetPassword.error.message}</p> : null}
    </form>
  );
}

function Field({ name, label, type = "text", defaultValue = "", required = true }: { name: string; label: string; type?: string; defaultValue?: string; required?: boolean }) {
  return <label><span className="label">{label}</span><input className="input" name={name} type={type} defaultValue={defaultValue} required={required} /></label>;
}
