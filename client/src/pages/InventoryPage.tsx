import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/http";
import { listInventory, type InventoryRow } from "../api/erpApi";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { Alert, EmptyState, Panel, TableWrap } from "../components/ui";

export function InventoryPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setRows(await listInventory());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell
      title="Inventory"
      description="Available quantity is Physical − Reserved and is never stored separately."
      actions={
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      }
    >
      <Panel title="Stock levels">
        {loading ? (
          <p className="text-sm text-slate-500">Loading inventory...</p>
        ) : error ? (
          <Alert>{error}</Alert>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No inventory rows"
            body="Seed products or create catalog records to populate stock."
          />
        ) : (
          <TableWrap>
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Product</th>
                  <th>Category</th>
                  <th className="text-right">Physical</th>
                  <th className="text-right">Reserved</th>
                  <th className="text-right">Available</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="cursor-default">
                    <td className="font-medium">{row.product.productCode}</td>
                    <td>{row.product.productName}</td>
                    <td className="text-slate-500">{row.product.category}</td>
                    <td className="text-right tabular-nums">{row.physicalQuantity}</td>
                    <td className="text-right tabular-nums">{row.reservedQuantity}</td>
                    <td className="text-right font-semibold tabular-nums text-slate-900">
                      {row.availableQuantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Panel>
    </AppShell>
  );
}
