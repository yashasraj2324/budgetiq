"use client";

import { Shell } from "@/components/Shell";

export default function BillingPage() {
  return (
    <Shell activePath="settings">
      <div className="max-w-2xl mx-auto w-full space-y-space-lg">
        <div>
          <h1 className="font-headline-lg text-on-surface">Billing</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Free design-partner pilot — billing is a stated gate, not an indefinite deferral.
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-space-lg space-y-space-sm">
          <p className="text-on-surface">
            Stripe checkout and subscription management are not enabled during the free pilot.
          </p>
          <p className="text-sm text-on-surface-variant">
            Gate: billing will be enabled before the paid pilot launch, target <strong>December 15, 2026</strong>.
            No plan/seat pricing is charged before that date, and enabling it is tracked as an explicit launch
            milestone rather than left silently deferred.
          </p>
          <p className="text-sm text-on-surface-variant">
            Core workflows (imports, dashboards, recommendations, approvals, and audit) run without billing configuration.
          </p>
        </div>
      </div>
    </Shell>
  );
}
