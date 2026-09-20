// Shared constants for the BudgetIQ API gateway.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id, accept",
};

export const DEV_TOKEN_DISABLED = ""; // dev-mode bearer tokens are no longer accepted
export const ADMIN_ROLES = new Set(["admin", "CFO", "VP Finance"]);
export const APPROVER_ROLES = new Set(["admin", "CFO", "VP Finance", "Finance Manager", "Controller"]);
export const SUPPORTED_ROLES = [
  "finance_user", "Budget Analyst", "Finance Manager", "Controller", "VP Finance", "CFO", "admin",
];

export const PREFIX = "/functions/v1/api";
