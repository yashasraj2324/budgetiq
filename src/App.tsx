import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { bootstrapEnterAnalytics } from "@enter-pro/analytics-sdk";

// Single app-entry bootstrap for Enter Analytics (page/session events auto-tracked).
bootstrapEnterAnalytics();

// Route-level code splitting: each page loads on demand instead of one 1.4 MB
// bundle up front.
const LoginPage = lazy(() => import("./pages/index"));
const SignupPage = lazy(() => import("./pages/signup"));
const ResetPasswordPage = lazy(() => import("./pages/reset-password"));
const AcceptInvitationPage = lazy(() => import("./pages/accept-invitation"));
const OnboardingPage = lazy(() => import("./pages/onboarding"));
const OnboardingDataPage = lazy(() => import("./pages/onboarding/data"));
const OnboardingPoliciesPage = lazy(() => import("./pages/onboarding/policies"));
const OnboardingPrioritiesPage = lazy(() => import("./pages/onboarding/priorities"));
const DashboardPage = lazy(() => import("./pages/dashboard"));
const ImportPage = lazy(() => import("./pages/import"));
const RecommendationsPage = lazy(() => import("./pages/recommendations"));
const RecommendationDetailPage = lazy(() => import("./pages/recommendations/[id]"));
const ApprovalsPage = lazy(() => import("./pages/approvals"));
const SignalsPage = lazy(() => import("./pages/signals"));
const ReportsPage = lazy(() => import("./pages/reports"));
const AuditPage = lazy(() => import("./pages/audit"));
const ScenariosPage = lazy(() => import("./pages/scenarios"));
const SettingsPage = lazy(() => import("./pages/settings"));
const GovernancePage = lazy(() => import("./pages/governance"));
const IntegrationsPage = lazy(() => import("./pages/integrations"));
const BillingPage = lazy(() => import("./pages/billing"));
const BudgetLineDetailPage = lazy(() => import("./pages/budget-lines/[id]"));

function RouteFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center text-outline font-body-md">
      Loading…
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/onboarding/data" element={<OnboardingDataPage />} />
          <Route path="/onboarding/policies" element={<OnboardingPoliciesPage />} />
          <Route path="/onboarding/priorities" element={<OnboardingPrioritiesPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/recommendations" element={<RecommendationsPage />} />
          <Route path="/recommendations/:id" element={<RecommendationDetailPage />} />
          <Route path="/approvals" element={<ApprovalsPage />} />
          <Route path="/signals" element={<SignalsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/audit" element={<AuditPage />} />
          <Route path="/scenarios" element={<ScenariosPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/governance" element={<GovernancePage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/budget-lines/:id" element={<BudgetLineDetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
