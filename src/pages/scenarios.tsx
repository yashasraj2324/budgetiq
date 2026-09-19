"use client";

import { Shell } from "@/components/Shell";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API, apiError, apiFetch } from "@/lib/api";

interface ScenarioFilters {
  department_id?: number | null;
  category?: string | null;
  search?: string | null;
  status?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  scenario_type?: string | null;
}

interface Scenario {
  id: number;
  name: string;
  created_by: string;
  shared: boolean;
  filters: ScenarioFilters;
  updated_at?: string;
}

const emptyFilters: ScenarioFilters = {
  category: null,
  status: null,
  scenario_type: null,
};

export default function ScenariosPage() {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  useEffect(() => {
    void loadScenarios();
  }, []);

  async function loadScenarios() {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch(`${API}/scenarios`);
      if (!response.ok) {
        throw new Error(await apiError(response, "Failed to load scenarios"));
      }
      const payload = await response.json();
      const items = Array.isArray(payload) ? payload : (payload.items ?? []);
      setScenarios(items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load scenarios");
    } finally {
      setLoading(false);
    }
  }

  async function createScenario(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Scenario name is required.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const filters: ScenarioFilters = {
      ...emptyFilters,
      category: category.trim() || null,
      search: search.trim() || null,
    };

    try {
      const response = await apiFetch(`${API}/scenarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), filters, shared: false }),
      });
      if (!response.ok) {
        throw new Error(await apiError(response, "Failed to create scenario"));
      }
      setName("");
      setCategory("");
      setSearch("");
      setMessage("Scenario created.");
      await loadScenarios();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create scenario");
    } finally {
      setSaving(false);
    }
  }

  async function deleteScenario(id: number) {
    setError("");
    setMessage("");
    setConfirmDeleteId(null);
    const response = await apiFetch(`${API}/scenarios/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await apiError(response, "Failed to delete scenario"));
      return;
    }
    setScenarios((previous) => previous.filter((item) => item.id !== id));
    setMessage("Scenario deleted.");
  }

  async function duplicateScenario(id: number) {
    setError("");
    setMessage("");
    const response = await apiFetch(`${API}/scenarios/${id}/duplicate`, { method: "POST" });
    if (!response.ok) {
      setError(await apiError(response, "Failed to duplicate scenario"));
      return;
    }
    setMessage("Scenario duplicated.");
    await loadScenarios();
  }

  async function toggleShare(scenario: Scenario) {
    setError("");
    setMessage("");
    const response = await apiFetch(`${API}/scenarios/${scenario.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shared: !scenario.shared }),
    });
    if (!response.ok) {
      setError(await apiError(response, "Failed to update sharing"));
      return;
    }
    const updated = (await response.json()) as Scenario;
    setScenarios((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
    setMessage(updated.shared ? "Scenario shared organization-wide." : "Scenario set to private.");
  }

  async function saveName(scenario: Scenario) {
    if (!editName.trim()) {
      setError("Scenario name cannot be empty.");
      return;
    }

    setError("");
    setMessage("");
    const response = await apiFetch(`${API}/scenarios/${scenario.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });

    if (!response.ok) {
      setError(await apiError(response, "Failed to rename scenario"));
      return;
    }

    const updated = (await response.json()) as Scenario;
    setScenarios((previous) => previous.map((item) => (item.id === updated.id ? updated : item)));
    setEditingId(null);
    setEditName("");
    setMessage("Scenario updated.");
  }

  return (
    <Shell activePath="scenarios">
      <div className="flex flex-col w-full gap-space-xl max-w-5xl mx-auto">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Saved Scenarios</h1>
          <p className="font-body-sm text-on-surface-variant mt-1">
            Create and manage reusable planning filters for your team.
          </p>
        </div>

        <form onSubmit={createScenario} className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-space-lg grid grid-cols-1 md:grid-cols-4 gap-space-md">
          <label className="block text-sm text-on-surface md:col-span-2">
            Scenario name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              className="mt-1 w-full rounded border border-outline-variant px-3 py-2 bg-surface"
              placeholder="Q3 variance review"
            />
          </label>
          <label className="block text-sm text-on-surface">
            Category filter
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="mt-1 w-full rounded border border-outline-variant px-3 py-2 bg-surface"
              placeholder="variance"
            />
          </label>
          <label className="block text-sm text-on-surface">
            Search filter
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="mt-1 w-full rounded border border-outline-variant px-3 py-2 bg-surface"
              placeholder="marketing"
            />
          </label>
          <div className="md:col-span-4 flex justify-end">
            <button type="submit" disabled={saving} className="rounded bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-60">
              {saving ? "Creating..." : "Create scenario"}
            </button>
          </div>
        </form>

        {error && <p role="alert" className="text-error">{error}</p>}
        {message && <p role="status" className="text-primary-container">{message}</p>}

        <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant">
          {loading ? (
            <div className="p-8 text-center text-outline">Loading scenarios...</div>
          ) : scenarios.length === 0 ? (
            <div className="p-8 text-center text-outline">No scenarios saved yet.</div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="text-outline border-b border-outline-variant">
                  <th className="py-3 px-4 font-label-caps text-label-caps uppercase">Name</th>
                  <th className="py-3 px-4 font-label-caps text-label-caps uppercase">Access</th>
                  <th className="py-3 px-4 font-label-caps text-label-caps uppercase">Last Updated</th>
                  <th className="py-3 px-4 font-label-caps text-label-caps uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {scenarios.map((scenario) => (
                  <tr key={scenario.id} className="hover:bg-surface-container transition-colors">
                    <td className="py-3 px-4 font-body-md text-on-surface font-medium">
                      {editingId === scenario.id ? (
                        <div className="flex gap-2">
                          <input
                            value={editName}
                            onChange={(event) => setEditName(event.target.value)}
                            className="rounded border border-outline-variant px-2 py-1 bg-surface w-full"
                          />
                          <button onClick={() => void saveName(scenario)} className="text-primary">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-outline">Cancel</button>
                        </div>
                      ) : (
                        scenario.name
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-on-surface-variant">
                      {scenario.shared ? "Shared" : "Private"}
                    </td>
                    <td className="py-3 px-4 text-sm text-on-surface-variant">
                      {scenario.updated_at ? new Date(scenario.updated_at).toLocaleString() : "-"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            const params = new URLSearchParams();
                            const filters = scenario.filters ?? {};
                            if (filters.department_id) params.set("department_id", String(filters.department_id));
                            if (filters.category) params.set("category", filters.category);
                            if (filters.search) params.set("search", filters.search);
                            navigate(`/dashboard${params.toString() ? `?${params.toString()}` : ""}`);
                          }}
                          className="text-primary hover:underline transition-colors font-medium"
                          title="Open scenario on the dashboard"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(scenario.id);
                            setEditName(scenario.name);
                          }}
                          className="text-on-surface-variant hover:text-primary transition-colors"
                          title="Rename"
                        >
                          Rename
                        </button>
                        <button onClick={() => void toggleShare(scenario)} className="text-on-surface-variant hover:text-primary transition-colors" title="Share">
                          {scenario.shared ? "Make Private" : "Share"}
                        </button>
                        <button onClick={() => void duplicateScenario(scenario.id)} className="text-on-surface-variant hover:text-primary transition-colors" title="Duplicate">
                          Duplicate
                        </button>
                        {confirmDeleteId === scenario.id ? (
                          <button
                            onClick={() => void deleteScenario(scenario.id)}
                            className="text-error font-semibold transition-colors"
                            title="Click to confirm deletion"
                          >
                            Confirm?
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setConfirmDeleteId(scenario.id);
                              window.setTimeout(() => setConfirmDeleteId((current) => (current === scenario.id ? null : current)), 3000);
                            }}
                            className="text-on-surface-variant hover:text-error transition-colors"
                            title="Delete"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Shell>
  );
}
