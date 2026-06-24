import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import { Header } from "./Dashboard";

export function Audit() {
  const { data, error } = useQuery({ queryKey: ["audit"], queryFn: () => api<any>("/api/audit"), retry: false });
  return (
    <section>
      <Header title="Audit log" subtitle="Security-sensitive actions, approvals, automation events, and administration changes." />
      {error ? <div className="panel p-5 text-red-700">{error.message}</div> : <div className="panel p-5 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Time</th><th>Action</th><th>Entity</th><th>Summary</th></tr></thead>
          <tbody>{data?.events?.map((event: any) => <tr key={event.id}><td>{new Date(event.createdAt).toLocaleString()}</td><td>{event.action}</td><td>{event.entityType}</td><td>{event.summary}</td></tr>)}</tbody>
        </table>
      </div>}
    </section>
  );
}

