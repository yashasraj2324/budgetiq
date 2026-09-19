"use client";

import { Link } from "react-router-dom";
import { Shell } from "@/components/Shell";
import { API } from "@/lib/api";

export default function IntegrationsPage() {
  const copyExample = async () => {
    const example =
      `curl "${API}/budget-lines" \\\n` +
      `  -H "X-API-Key: biq_your_key_here" \\\n` +
      `  -H "Accept: application/json"`;
    try {
      await navigator.clipboard.writeText(example);
    } catch {
      // clipboard unavailable — the snippet stays visible on the page
    }
  };

  return (
    <Shell activePath="integrations">
      <div className="flex flex-col w-full gap-space-xl max-w-5xl mx-auto">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Data Integrations</h1>
          <p className="font-body-sm text-on-surface-variant mt-1">
            Bring budget data into BudgetIQ through CSV import, manual entry, or the programmatic API.
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-space-lg space-y-space-md">
          <h2 className="font-headline-md text-headline-md text-on-surface">Supported now</h2>
          <ul className="list-disc list-inside text-sm text-on-surface-variant space-y-1">
            <li>CSV import of budget lines and monthly spend entries from <code>/import</code></li>
            <li>Manual budget line creation and policy edits in workspace settings</li>
            <li>Single spend-entry recording per budget line to drive anomalies and forecasts</li>
            <li>Tenant-scoped import validation with row-level error reporting</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Link to="/import" className="rounded bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
              Import budget data
            </Link>
            <Link to="/settings" className="rounded border border-outline-variant px-4 py-2 text-sm hover:bg-surface-container-low">
              Open manual settings
            </Link>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-space-lg space-y-space-md">
          <h2 className="font-headline-md text-headline-md text-on-surface">Programmatic API access</h2>
          <p className="text-sm text-on-surface-variant">
            External tools and finance systems can read and write workspace data using an API key
            created in <Link to="/settings" className="text-primary hover:underline">Workspace Settings → API keys</Link>.
            The key is sent as an <code>X-API-Key</code> header and is limited to the scopes you grant.
          </p>
          <div className="flex items-start gap-2">
            <pre className="flex-1 overflow-x-auto rounded-lg border border-outline-variant bg-surface p-3 text-xs font-mono text-on-surface">
{`curl "${API}/budget-lines" \\
  -H "X-API-Key: biq_your_key_here" \\
  -H "Accept: application/json"`}
            </pre>
            <button
              onClick={() => void copyExample()}
              className="rounded border border-outline-variant px-3 py-1.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
            >
              Copy
            </button>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-on-surface mb-1">Available scopes</h3>
            <p className="text-xs text-on-surface-variant">
              budgets:read/write, recommendations:read/write, approvals:read/write, reports:read,
              organization:read/write, scenarios:read/write, api_keys:manage, or * for all.
            </p>
          </div>
        </div>
      </div>
    </Shell>
  );
}
