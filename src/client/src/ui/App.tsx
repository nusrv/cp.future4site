import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, post } from "../api";
import { Dashboard } from "./Dashboard";
import { Users } from "./Users";
import { MarketingStudio } from "./MarketingStudio";
import { MediaLibrary } from "./MediaLibrary";
import { AutomationJobs } from "./AutomationJobs";
import { Operations } from "./Operations";
import { Publishing } from "./Publishing";
import { Audit } from "./Audit";

type MeResponse = { user: null | { id: string; username: string; displayName: string; roles: string[]; permissions: string[]; mustChangePassword: boolean } };

export function App() {
  const { data, isLoading } = useQuery({ queryKey: ["me"], queryFn: () => api<MeResponse>("/api/auth/me"), retry: false });
  if (isLoading) return <div className="min-h-[100dvh] grid place-items-center">Loading secure workspace</div>;
  if (!data?.user) return <Login />;
  return <Shell user={data.user} />;
}

function Login() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const login = useMutation({
    mutationFn: (body: { username: string; password: string }) => post("/api/auth/login", body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      navigate("/");
    }
  });
  return (
    <main className="min-h-[100dvh] grid place-items-center px-4">
      <section className="panel w-full max-w-md p-8">
        <div className="brand-mark mb-5">FF</div>
        <h1 className="text-3xl font-black tracking-tight">Future Foresight Admin</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Internal staff access only. No public registration.</p>
        <form
          className="mt-7 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            login.mutate({ username: String(form.get("username")), password: String(form.get("password")) });
          }}
        >
          <label><span className="label">Username</span><input className="input" name="username" autoComplete="username" /></label>
          <label><span className="label">Password</span><input className="input" name="password" type="password" autoComplete="current-password" /></label>
          {login.error ? <p className="text-sm text-red-700">{login.error.message}</p> : null}
          <button className="btn btn-primary w-full" disabled={login.isPending}>Sign in</button>
        </form>
      </section>
    </main>
  );
}

function Shell({ user }: { user: NonNullable<MeResponse["user"]> }) {
  const qc = useQueryClient();
  const logout = useMutation({ mutationFn: () => post("/api/auth/logout", {}), onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }) });
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="flex items-center gap-3 mb-8">
          <div className="brand-mark">FF</div>
          <div>
            <div className="font-black">Future Foresight</div>
            <div className="text-xs text-[var(--text-muted)]">Internal management</div>
          </div>
        </div>
        <nav>
          <NavLink className="nav-link" to="/">Dashboard</NavLink>
          <NavLink className="nav-link" to="/marketing">Content</NavLink>
          <NavLink className="nav-link" to="/media-library">Media library</NavLink>
          <NavLink className="nav-link" to="/publishing">Publishing</NavLink>
          <NavLink className="nav-link" to="/automation">Automation Jobs</NavLink>
          <NavLink className="nav-link" to="/operations">Operations</NavLink>
          <NavLink className="nav-link" to="/users">Users</NavLink>
          <NavLink className="nav-link" to="/audit">Audit</NavLink>
        </nav>
        <div className="mt-8 card">
          <div className="text-sm font-bold">{user.displayName}</div>
          <div className="text-xs text-[var(--text-muted)] break-all">{user.roles.join(", ")}</div>
          <button className="btn btn-secondary mt-3 w-full" onClick={() => logout.mutate()}>Logout</button>
        </div>
      </aside>
      <main className="main">
        {user.mustChangePassword ? <div className="card mb-4 border-yellow-300">Password change is required after bootstrap or admin reset.</div> : null}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/marketing" element={<MarketingStudio />} />
          <Route path="/media-library" element={<MediaLibrary />} />
          <Route path="/publishing" element={<Publishing />} />
          <Route path="/automation" element={<AutomationJobs />} />
          <Route path="/operations" element={<Operations />} />
          <Route path="/users" element={<Users />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

