"use client";

import { Shell } from "@/components/Shell";

export default function BillingPage() {
  return (
    <Shell activePath="settings">
      <div className="max-w-2xl mx-auto w-full space-y-space-lg">
        <div>
          <h1 className="font-headline-lg text-on-surface">Billing</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Billing is deferred for this milestone.
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-space-lg space-y-space-sm">
          <p className="text-on-surface">
            Stripe checkout and subscription management are intentionally disabled in the pilot release.
          </p>
          <p className="text-sm text-on-surface-variant">
            Core workflows (onboarding, imports, dashboards, recommendations, approvals, and audit) run without billing configuration.
          </p>
        </div>
      </div>
    </Shell>
  );
}
