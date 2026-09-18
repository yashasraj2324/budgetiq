import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/Login";
import SignupPage from "./pages/Signup";
import ResetPasswordPage from "./pages/ResetPassword";
import OnboardingPage from "./pages/Onboarding";
import OnboardingDataPage from "./pages/OnboardingData";
import OnboardingPrioritiesPage from "./pages/OnboardingPriorities";
import OnboardingPoliciesPage from "./pages/OnboardingPolicies";
import DashboardPage from "./pages/Dashboard";
import BudgetLineDetailPage from "./pages/BudgetLineDetail";
import SignalsPage from "./pages/Signals";
import RecommendationsPage from "./pages/Recommendations";
import RecommendationDetailPage from "./pages/RecommendationDetail";
import ApprovalsPage from "./pages/Approvals";
import AuditPage from "./pages/Audit";
import ReportsPage from "./pages/Reports";
import SettingsPage from "./pages/Settings";
import GovernancePage from "./pages/Governance";
import ScenariosPage from "./pages/Scenarios";
import IntegrationsPage from "./pages/Integrations";
import BillingPage from "./pages/Billing";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/onboarding/data" element={<OnboardingDataPage />} />
        <Route path="/onboarding/priorities" element={<OnboardingPrioritiesPage />} />
        <Route path="/onboarding/policies" element={<OnboardingPoliciesPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/budget-lines/:id" element={<BudgetLineDetailPage />} />
        <Route path="/signals" element={<SignalsPage />} />
        <Route path="/recommendations" element={<RecommendationsPage />} />
        <Route path="/recommendations/:id" element={<RecommendationDetailPage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/governance" element={<GovernancePage />} />
        <Route path="/scenarios" element={<ScenariosPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
