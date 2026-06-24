import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { api, post } from "../api";
import { Header } from "./Dashboard";

export function Operations() {
  const qc = useQueryClient();
  const orgs = useQuery({ queryKey: ["orgs"], queryFn: () => api<any>("/api/organizations") });
  const leads = useQuery({ queryKey: ["leads"], queryFn: () => api<any>("/api/leads") });
  const suppliers = useQuery({ queryKey: ["suppliers"], queryFn: () => api<any>("/api/suppliers"), retry: false });
  const createLead = useMutation({ mutationFn: (body: any) => post("/api/leads", body), onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); qc.invalidateQueries({ queryKey: ["orgs"] }); } });
  return (
    <section>
      <Header title="Operations" subtitle="Manage synthetic leads, organizations, contacts, tasks, supplier restrictions, and commercial records." />
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <form className="panel p-5 space-y-3" onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          createLead.mutate({
            organizationName: String(form.get("organizationName")),
            contactName: String(form.get("contactName")),
            email: String(form.get("email")),
            phone: String(form.get("phone")),
            product: String(form.get("product")),
            message: String(form.get("message"))
          });
          event.currentTarget.reset();
        }}>
          <h2 className="font-black text-xl">Create synthetic lead</h2>
          <Input name="organizationName" label="Organization" />
          <Input name="contactName" label="Contact" />
          <Input name="email" label="Email" defaultValue="contact@example.com" />
          <Input name="phone" label="Phone" defaultValue="+962700000000" />
          <Input name="product" label="Product" defaultValue="Refined Sunflower Oil" />
          <label><span className="label">Message</span><textarea className="input" name="message" /></label>
          <button className="btn btn-primary">Create lead</button>
        </form>
        <div className="space-y-5">
          <Panel title="Leads">
            <table className="table"><tbody>{leads.data?.leads?.map((lead: any) => <tr key={lead.id}><td>{lead.organization?.legalName}</td><td>{lead.leadType}</td><td><span className="badge">{lead.status}</span></td></tr>)}</tbody></table>
          </Panel>
          <Panel title="Organizations">
            <table className="table"><tbody>{orgs.data?.organizations?.map((org: any) => <tr key={org.id}><td>{org.legalName}</td><td>{org.country}</td><td>{org.roles?.map((r: any) => r.role).join(", ")}</td></tr>)}</tbody></table>
          </Panel>
          <Panel title="Restricted suppliers">
            {suppliers.error ? <div className="text-sm text-red-700">Supplier data is restricted for this role.</div> : <table className="table"><tbody>{suppliers.data?.suppliers?.map((supplier: any) => <tr key={supplier.id}><td>{supplier.organization.legalName}</td><td>{supplier.productOffered}</td><td><span className="badge badge-dry">restricted</span></td></tr>)}</tbody></table>}
          </Panel>
        </div>
      </div>
    </section>
  );
}

function Input(props: { name: string; label: string; defaultValue?: string }) {
  return <label><span className="label">{props.label}</span><input className="input" name={props.name} defaultValue={props.defaultValue} required /></label>;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <div className="panel p-5 overflow-x-auto"><h2 className="font-black text-xl mb-3">{title}</h2>{children}</div>;
}
