import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/index";
import SignupPage from "./pages/signup";
import ResetPasswordPage from "./pages/reset-password";
import OnboardingPage from "./pages/onboarding";
import OnboardingDataPage from "./pages/onboarding/data";
import OnboardingPoliciesPage from "./pages/onboarding/policies";
import OnboardingPrioritiesPage from "./pages/onboarding/priorities";
import DashboardPage from "./pages/dashboard";
import RecommendationsPage from "./pages/recommendations";
import RecommendationDetailPage from "./pages/recommendations/[id]";
import ApprovalsPage from "./pages/approvals";
import SignalsPage from "./pages/signals";
import ReportsPage from "./pages/reports";
import AuditPage from "./pages/audit";
import ScenariosPage from "./pages/scenarios";
import SettingsPage from "./pages/settings";
import GovernancePage from "./pages/governance";
import IntegrationsPage from "./pages/integrations";
import BillingPage from "./pages/billing";
import BudgetLineDetailPage from "./pages/budget-lines/[id]";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/onboarding/data" element={<OnboardingDataPage />} />
        <Route path="/onboarding/policies" element={<OnboardingPoliciesPage />} />
        <Route path="/onboarding/priorities" element={<OnboardingPrioritiesPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
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
    </BrowserRouter>
  );
}
