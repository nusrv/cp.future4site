import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, patch, post } from "../api";
import { Header } from "./Dashboard";

const roleOptions = ["OWNER_ADMIN", "MARKETING", "CONTENT_REVIEWER", "AUTOMATION_MAINTAINER", "COMMERCIAL_SALES", "OPERATIONS", "SUPPLIER_MANAGEMENT", "READ_ONLY_MANAGEMENT"];

export function Users() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["users"], queryFn: () => api<any>("/api/admin/users") });
  const create = useMutation({ mutationFn: (body: any) => post("/api/admin/users", body), onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }) });
  const update = useMutation({ mutationFn: ({ id, body }: any) => patch(`/api/admin/users/${id}`, body), onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }) });
  return (
    <section>
      <Header title="User administration" subtitle="Create internal users, assign roles, disable access, and preserve audit history." />
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
          <Field name="email" label="Email" />
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
                <td><strong>{user.displayName}</strong><br /><span className="text-sm text-[var(--text-muted)]">{user.username}</span></td>
                <td>{user.roles?.join(", ")}</td>
                <td><span className={`badge ${user.status === "ACTIVE" ? "badge-ok" : "badge-fail"}`}>{user.status}</span></td>
                <td><button className="btn btn-secondary" onClick={() => update.mutate({ id: user.id, body: { status: user.status === "ACTIVE" ? "DISABLED" : "ACTIVE" } })}>{user.status === "ACTIVE" ? "Disable" : "Reactivate"}</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Field({ name, label, type = "text" }: { name: string; label: string; type?: string }) {
  return <label><span className="label">{label}</span><input className="input" name={name} type={type} required /></label>;
}

