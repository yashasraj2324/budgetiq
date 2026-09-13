"use client";
import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-space-lg">
      <div className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-xl shadow-sm p-space-xl">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center justify-center text-center mb-space-xl">
          <div className="flex items-center gap-space-xs mb-space-sm">
            <span className="material-symbols-outlined text-outline text-[24px]">account_balance</span>
            <span className="font-headline-xl text-headline-xl text-on-surface tracking-tight">BudgetIQ</span>
            <span className="w-2 h-2 rounded-full bg-primary-container mt-1.5"></span>
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface">Request Access</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Join your organization's Ledger Workspace
          </p>
        </div>

        {/* Signup Form */}
        <form className="space-y-space-md" onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-2 gap-space-md">
            <div className="space-y-1">
              <label className="block font-body-sm text-body-sm font-semibold text-on-surface">
                First Name
              </label>
              <input
                type="text"
                className="w-full h-10 px-space-md bg-surface-container-low border border-outline-variant rounded hover:bg-surface-container transition-colors focus:outline-none focus:border-primary-container font-body-md text-on-surface"
                placeholder="Alex"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="block font-body-sm text-body-sm font-semibold text-on-surface">
                Last Name
              </label>
              <input
                type="text"
                className="w-full h-10 px-space-md bg-surface-container-low border border-outline-variant rounded hover:bg-surface-container transition-colors focus:outline-none focus:border-primary-container font-body-md text-on-surface"
                placeholder="Rivera"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block font-body-sm text-body-sm font-semibold text-on-surface">
              Work Email
            </label>
            <input
              type="email"
              className="w-full h-10 px-space-md bg-surface-container-low border border-outline-variant rounded hover:bg-surface-container transition-colors focus:outline-none focus:border-primary-container font-body-md text-on-surface"
              placeholder="alex.rivera@company.com"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block font-body-sm text-body-sm font-semibold text-on-surface">
              Department Code
            </label>
            <input
              type="text"
              className="w-full h-10 px-space-md bg-surface-container-low border border-outline-variant rounded hover:bg-surface-container transition-colors focus:outline-none focus:border-primary-container font-body-md text-on-surface uppercase"
              placeholder="e.g. MKT-7200"
            />
          </div>

          <div className="space-y-1">
            <label className="block font-body-sm text-body-sm font-semibold text-on-surface">
              Password
            </label>
            <input
              type="password"
              className="w-full h-10 px-space-md bg-surface-container-low border border-outline-variant rounded hover:bg-surface-container transition-colors focus:outline-none focus:border-primary-container font-body-md text-on-surface"
              placeholder="Create a secure password"
              required
            />
          </div>

          <Link href="/onboarding" className="w-full">
            <div
              className="w-full h-10 bg-primary-container hover:bg-primary active:bg-on-primary-fixed-variant text-on-primary font-body-md text-body-md font-semibold rounded shadow-sm transition-colors duration-150 flex items-center justify-center gap-space-xs mt-space-lg"
            >
              <span>Submit Request</span>
              <span className="material-symbols-outlined text-[18px]">person_add</span>
            </div></Link>
        </form>

        {/* Footer */}
        <div className="mt-space-xl pt-space-md border-t border-outline-variant text-center">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Already have an account?{" "}
            <Link href="/" className="text-primary font-semibold hover:underline">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
