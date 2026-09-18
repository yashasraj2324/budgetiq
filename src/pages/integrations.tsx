"use client";

import { Link } from "react-router-dom";
import { Shell } from "@/components/Shell";

export default function IntegrationsPage() {
  return (
    <Shell activePath="integrations">
      <div className="flex flex-col w-full gap-space-xl max-w-5xl mx-auto">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Data Integrations</h1>
          <p className="font-body-sm text-on-surface-variant mt-1">
            BudgetIQ currently supports CSV import and manual data entry for pilot onboarding.
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-space-lg space-y-space-md">
          <h2 className="font-headline-md text-headline-md text-on-surface">Supported now</h2>
          <ul className="list-disc list-inside text-sm text-on-surface-variant space-y-1">
            <li>CSV import through onboarding and <code>/api/budget-lines/import</code></li>
            <li>Manual budget line creation and policy edits in workspace settings</li>
            <li>Tenant-scoped import validation with row-level error reporting</li>
          </ul>
          <div className="flex flex-wrap gap-2">
            <Link to="/onboarding/data" className="rounded bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
              Go to CSV import
            </Link>
            <Link to="/settings" className="rounded border border-outline-variant px-4 py-2 text-sm hover:bg-surface-container-low">
              Open manual settings
            </Link>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-space-lg">
          <h2 className="font-headline-md text-headline-md text-on-surface mb-2">Deferred connectors</h2>
          <p className="text-sm text-on-surface-variant">
            ERP and FP&A direct connectors are deferred for this milestone. No connector setup is available in this pilot build.
          </p>
        </div>
      </div>
    </Shell>
  );
}
