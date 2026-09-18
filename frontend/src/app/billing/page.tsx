"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { API, apiError, apiFetch } from "@/lib/api";

interface Billing { status: string; plan: string; customer_id?: string | null; }
interface Invoice { id: string; status: string; amount_paid: number; currency: string; hosted_invoice_url?: string; }

export default function BillingPage() {
  const [billing, setBilling] = useState<Billing | null>(null);
  const [message, setMessage] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  useEffect(() => {
    apiFetch(`${API}/billing`).then(async (response) => {
      if (!response.ok) throw new Error(await apiError(response, "Unable to load billing"));
      setBilling(await response.json());
    }).catch((error: Error) => setMessage(error.message));
    apiFetch(`${API}/billing/invoices`).then(async (response) => {
      if (response.ok) setInvoices((await response.json()).data ?? []);
    }).catch(() => undefined);
  }, []);
  async function checkout() {
    setMessage("");
    const response = await apiFetch(`${API}/billing/checkout?success_url=${encodeURIComponent(window.location.origin + "/billing")}&cancel_url=${encodeURIComponent(window.location.href)}`, { method: "POST" });
    if (!response.ok) { setMessage(await apiError(response)); return; }
    const result = await response.json();
    if (result.url) window.location.assign(result.url);
  }
  async function portal() {
    const response = await apiFetch(`${API}/billing/portal?return_url=${encodeURIComponent(window.location.href)}`, { method: "POST" });
    if (!response.ok) { setMessage(await apiError(response)); return; }
    const result = await response.json();
    if (result.url) window.location.assign(result.url);
  }
  return <Shell activePath="settings"><div className="max-w-2xl mx-auto w-full space-y-space-lg">
    <div><h1 className="font-headline-lg text-on-surface">Billing</h1><p className="text-sm text-on-surface-variant mt-1">Manage the organization subscription through Stripe.</p></div>
    {message && <p role="alert" className="text-error">{message}</p>}
    {billing && <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-space-lg space-y-space-md">
      <div className="flex justify-between"><span>Plan</span><strong>{billing.plan}</strong></div>
      <div className="flex justify-between"><span>Status</span><strong>{billing.status}</strong></div>
      {billing.customer_id ? <button onClick={portal} className="w-full rounded bg-primary-container text-on-primary py-2 font-semibold">Open Stripe billing portal</button> :
        <button onClick={checkout} className="w-full rounded bg-primary-container text-on-primary py-2 font-semibold">Start subscription</button>}
      {invoices.length > 0 && <div className="border-t border-outline-variant pt-space-md"><h2 className="font-semibold mb-2">Invoices</h2>{invoices.map((invoice) => <div key={invoice.id} className="flex justify-between py-2 text-sm"><span>{invoice.status}</span><span>{(invoice.amount_paid / 100).toFixed(2)} {invoice.currency.toUpperCase()} {invoice.hosted_invoice_url && <a className="text-primary ml-2 underline" href={invoice.hosted_invoice_url}>View</a>}</span></div>)}</div>}
    </div>}
  </div></Shell>;
}
