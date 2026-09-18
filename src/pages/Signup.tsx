import { Link } from "react-router-dom";

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

        <div className="space-y-space-md">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Account provisioning is managed by your organization's configured provider.
            This private-beta shell does not create accounts or collect passwords.
          </div>
          <Link to="/" className="w-full h-10 bg-primary-container hover:bg-primary text-on-primary font-body-md font-semibold rounded flex items-center justify-center gap-space-xs mt-space-lg">
            Return to sign in
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-space-xl pt-space-md border-t border-outline-variant text-center">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Already have an account?{" "}
            <Link to="/" className="text-primary font-semibold hover:underline">
              Sign in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
