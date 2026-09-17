import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/http";
import { listDispatches, type DispatchRecord } from "../api/erpApi";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { Alert, EmptyState, Panel, TableWrap } from "../components/ui";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString();
}

export function DispatchesPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [dispatches, setDispatches] = useState<DispatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const rows = await listDispatches();
        setDispatches(rows);
        if (rows.length > 0) {
          setSelectedId(rows[0].id);
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          logout();
          navigate("/login", { replace: true });
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load dispatches");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [logout, navigate]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const rows = await listDispatches();
      setDispatches(rows);
      if (rows.length > 0 && !selectedId) {
        setSelectedId(rows[0].id);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load dispatches");
    } finally {
      setLoading(false);
    }
  }

  const selected = dispatches.find((row) => row.id === selectedId) ?? null;

  return (
    <AppShell
      title="Dispatches"
      description="Outbound shipments linked to confirmed sales orders."
      actions={
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <Panel title="Dispatch list">
            {loading ? (
              <p className="text-sm text-slate-500">Loading...</p>
            ) : error ? (
              <Alert>{error}</Alert>
            ) : dispatches.length === 0 ? (
              <EmptyState
                title="No dispatches yet"
                body="Dispatch a confirmed sales order to record a shipment."
              />
            ) : (
              <TableWrap>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Dispatch</th>
                      <th>Sales Order</th>
                      <th>Customer</th>
                      <th>Date</th>
                      <th>Vehicle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dispatches.map((row) => (
                      <tr
                        key={row.id}
                        className={selectedId === row.id ? "is-selected" : undefined}
                        onClick={() => setSelectedId(row.id)}
                      >
                        <td className="font-medium">{row.dispatchNumber}</td>
                        <td>{row.salesOrder.orderNumber}</td>
                        <td>{row.salesOrder.customer.companyName}</td>
                        <td>{formatDate(row.dispatchDate)}</td>
                        <td>{row.vehicleNumber}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Panel>
        </section>

        <section className="lg:col-span-2">
          <Panel title="Dispatch detail">
            {!selected ? (
              <p className="text-sm text-slate-500">Select a dispatch.</p>
            ) : (
              <div className="space-y-3 text-sm text-slate-700">
                <p>
                  <span className="font-medium text-slate-900">Number:</span>{" "}
                  {selected.dispatchNumber}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Order:</span>{" "}
                  {selected.salesOrder.orderNumber}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Customer:</span>{" "}
                  {selected.salesOrder.customer.companyName}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Driver:</span>{" "}
                  {selected.driverName}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Vehicle:</span>{" "}
                  {selected.vehicleNumber}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Date:</span>{" "}
                  {formatDate(selected.dispatchDate)}
                </p>
                <div>
                  <p className="font-medium text-slate-900">Products</p>
                  <ul className="mt-1 list-disc pl-5">
                    {selected.salesOrder.items.map((item) => (
                      <li key={item.id}>
                        {item.product.productCode} × {item.quantity}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </Panel>
        </section>
      </div>
    </AppShell>
  );
}
