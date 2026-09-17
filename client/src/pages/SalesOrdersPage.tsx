import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/http";
import {
  confirmSalesOrder,
  dispatchSalesOrder,
  listInventory,
  listSalesOrders,
  type InventoryRow,
  type SalesOrder,
} from "../api/erpApi";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { Alert, EmptyState, Panel, StatusBadge, TableWrap } from "../components/ui";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString();
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SalesOrdersPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const canConfirm = user?.role === "ADMIN";
  const canDispatch = user?.role === "ADMIN";

  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showDispatchForm, setShowDispatchForm] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchDate, setDispatchDate] = useState(todayIsoDate());
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [driverName, setDriverName] = useState("");

  const selected = useMemo(
    () => orders.find((order) => order.id === selectedId) ?? null,
    [orders, selectedId]
  );

  async function loadData(preferredId?: string) {
    setLoading(true);
    setPageError(null);
    try {
      const [orderRows, inventoryRows] = await Promise.all([
        listSalesOrders(),
        listInventory(),
      ]);
      setOrders(orderRows);
      setInventory(inventoryRows);
      if (preferredId) {
        setSelectedId(preferredId);
      } else if (!selectedId && orderRows.length > 0) {
        setSelectedId(orderRows[0].id);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setPageError(error instanceof Error ? error.message : "Failed to load sales orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConfirm() {
    if (!selected || !canConfirm) return;
    setConfirming(true);
    setActionError(null);
    setSuccessMessage(null);
    try {
      const updated = await confirmSalesOrder(selected.id);
      setSuccessMessage(`Sales order ${updated.orderNumber} confirmed and inventory reserved.`);
      await loadData(updated.id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setActionError(error instanceof Error ? error.message : "Unable to confirm sales order");
    } finally {
      setConfirming(false);
    }
  }

  async function handleDispatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !canDispatch) return;

    setDispatching(true);
    setActionError(null);
    setSuccessMessage(null);
    try {
      if (!vehicleNumber.trim() || !driverName.trim()) {
        throw new Error("Vehicle number and driver name are required.");
      }

      const dispatch = await dispatchSalesOrder(selected.id, {
        dispatchDate,
        vehicleNumber: vehicleNumber.trim(),
        driverName: driverName.trim(),
      });

      setSuccessMessage(
        `Dispatch ${dispatch.dispatchNumber} created. Order is now DISPATCHED.`
      );
      setShowDispatchForm(false);
      setVehicleNumber("");
      setDriverName("");
      await loadData(selected.id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setActionError(error instanceof Error ? error.message : "Unable to dispatch");
    } finally {
      setDispatching(false);
    }
  }

  return (
    <AppShell
      title="Sales Orders"
      description="Confirm orders, reserve inventory, and dispatch shipments."
      actions={
        <button
          type="button"
          onClick={() => void loadData()}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <section className="space-y-4 lg:col-span-3">
          <Panel title="Orders">
            {loading ? (
              <p className="text-sm text-slate-500">Loading sales orders...</p>
            ) : pageError ? (
              <Alert>{pageError}</Alert>
            ) : orders.length === 0 ? (
              <EmptyState
                title="No sales orders yet"
                body="Convert an accepted quotation to create a sales order."
              />
            ) : (
              <TableWrap>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer</th>
                      <th>Quotation</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr
                        key={order.id}
                        className={selectedId === order.id ? "is-selected" : undefined}
                        onClick={() => {
                          setSelectedId(order.id);
                          setShowDispatchForm(false);
                        }}
                      >
                        <td className="font-medium">{order.orderNumber}</td>
                        <td>{order.customer.companyName}</td>
                        <td>{order.quotation.quotationNumber}</td>
                        <td>{formatDate(order.orderDate)}</td>
                        <td>
                          <StatusBadge status={order.status} />
                        </td>
                        <td>{order.totalAmount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Panel>

          {selected ? (
            <Panel title={`Order detail — ${selected.orderNumber}`}>
              <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <dt className="text-slate-500">Customer</dt>
                  <dd className="font-medium text-slate-900">
                    {selected.customer.companyName}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Traceability</dt>
                  <dd className="text-slate-800">
                    {selected.quotation.enquiry.enquiryNumber} →{" "}
                    {selected.quotation.quotationNumber} → {selected.orderNumber}
                    {selected.dispatch
                      ? ` → ${selected.dispatch.dispatchNumber}`
                      : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Status</dt>
                  <dd>
                    <StatusBadge status={selected.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Total</dt>
                  <dd className="font-medium text-slate-900">{selected.totalAmount}</dd>
                </div>
              </dl>

              <TableWrap>
                <table className="erp-table mt-5">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Available</th>
                      <th>Price</th>
                      <th>Line</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.product.productCode}</td>
                        <td>{item.quantity}</td>
                        <td>{item.product.inventory?.availableQuantity ?? "—"}</td>
                        <td>{item.unitPrice}</td>
                        <td>{item.lineAmount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>

              {selected.dispatch ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                  <p className="font-medium text-slate-900">
                    Dispatch {selected.dispatch.dispatchNumber}
                  </p>
                  <p className="mt-1">
                    Date: {formatDate(selected.dispatch.dispatchDate)} · Vehicle:{" "}
                    {selected.dispatch.vehicleNumber} · Driver:{" "}
                    {selected.dispatch.driverName}
                  </p>
                </div>
              ) : null}

              {actionError ? <Alert>{actionError}</Alert> : null}
              {successMessage ? (
                <Alert tone="success">{successMessage}</Alert>
              ) : null}

              {canConfirm && selected.status === "PENDING" ? (
                <button
                  type="button"
                  disabled={confirming}
                  onClick={() => void handleConfirm()}
                  className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {confirming ? "Confirming..." : "Confirm & reserve inventory"}
                </button>
              ) : null}

              {canDispatch && selected.status === "CONFIRMED" && !selected.dispatch ? (
                <button
                  type="button"
                  onClick={() => setShowDispatchForm((value) => !value)}
                  className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 sm:ml-3"
                >
                  {showDispatchForm ? "Hide dispatch form" : "Dispatch"}
                </button>
              ) : null}

              {!canConfirm && !canDispatch ? (
                <p className="mt-4 text-sm text-slate-500">
                  Confirmation and dispatch are restricted to ADMIN.
                </p>
              ) : null}

              {showDispatchForm && selected.status === "CONFIRMED" ? (
                <form
                  className="mt-4 space-y-3 rounded-lg border border-slate-200 p-4"
                  onSubmit={handleDispatch}
                >
                  <h3 className="text-sm font-medium text-slate-900">
                    Dispatch {selected.orderNumber}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Full order quantities will be dispatched. Physical and reserved
                    inventory both decrease.
                  </p>
                  <ul className="text-sm text-slate-700">
                    {selected.items.map((item) => (
                      <li key={item.id}>
                        {item.product.productCode} × {item.quantity}
                      </li>
                    ))}
                  </ul>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="erp-label">Dispatch date</label>
                      <input
                        type="date"
                        value={dispatchDate}
                        onChange={(e) => setDispatchDate(e.target.value)}
                        className="erp-input"
                        required
                      />
                    </div>
                    <div>
                      <label className="erp-label">Vehicle number</label>
                      <input
                        value={vehicleNumber}
                        onChange={(e) => setVehicleNumber(e.target.value)}
                        className="erp-input"
                        required
                      />
                    </div>
                    <div>
                      <label className="erp-label">Driver name</label>
                      <input
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        className="erp-input"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={dispatching}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {dispatching ? "Dispatching..." : "Confirm dispatch"}
                  </button>
                </form>
              ) : null}
            </Panel>
          ) : null}
        </section>

        <section className="lg:col-span-2">
          <Panel title="Inventory">
            <p className="text-xs text-slate-500">Available = Physical − Reserved</p>
            <TableWrap>
              <table className="erp-table mt-4">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Physical</th>
                    <th>Reserved</th>
                    <th>Available</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory.map((row) => (
                    <tr key={row.id}>
                      <td>{row.product.productCode}</td>
                      <td>{row.physicalQuantity}</td>
                      <td>{row.reservedQuantity}</td>
                      <td className="font-medium">{row.availableQuantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Panel>
        </section>
      </div>
    </AppShell>
  );
}
