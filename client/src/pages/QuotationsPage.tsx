import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError } from "../api/http";
import {
  convertQuotation,
  createQuotation,
  listEnquiries,
  listProducts,
  listQuotations,
  updateQuotationStatus,
  type Enquiry,
  type Product,
  type Quotation,
  type QuotationStatus,
} from "../api/erpApi";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { Alert, EmptyState, Panel, StatusBadge, TableWrap } from "../components/ui";

type LineDraft = {
  key: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  discountPercent: string;
  gstPercent: string;
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString();
}

function previewLineAmount(line: LineDraft): number {
  const quantity = Number(line.quantity);
  const unitPrice = Number(line.unitPrice);
  const discountPercent = Number(line.discountPercent);
  const gstPercent = Number(line.gstPercent);
  if (
    ![quantity, unitPrice, discountPercent, gstPercent].every((n) =>
      Number.isFinite(n)
    )
  ) {
    return 0;
  }
  const base = quantity * unitPrice;
  const taxable = base - (base * discountPercent) / 100;
  return taxable + (taxable * gstPercent) / 100;
}

function nextStatuses(status: QuotationStatus): QuotationStatus[] {
  if (status === "DRAFT") return ["SENT"];
  if (status === "SENT") return ["ACCEPTED", "REJECTED"];
  return [];
}

export function QuotationsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const canCreate = user?.role === "SALES_USER";
  const canUpdateStatus = user?.role === "ADMIN";
  const canConvert = user?.role === "SALES_USER";
  const [converting, setConverting] = useState(false);

  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);

  const [enquiryId, setEnquiryId] = useState("");
  const [validUntil, setValidUntil] = useState(todayIsoDate());
  const [lines, setLines] = useState<LineDraft[]>([
    {
      key: crypto.randomUUID(),
      productId: "",
      quantity: "1",
      unitPrice: "",
      discountPercent: "0",
      gstPercent: "18",
    },
  ]);

  const selected = useMemo(
    () => quotations.find((row) => row.id === selectedId) ?? null,
    [quotations, selectedId]
  );

  const selectedEnquiry = useMemo(
    () => enquiries.find((row) => row.id === enquiryId) ?? null,
    [enquiries, enquiryId]
  );

  const previewTotal = useMemo(
    () => lines.reduce((sum, line) => sum + previewLineAmount(line), 0),
    [lines]
  );

  async function loadData() {
    setLoading(true);
    setPageError(null);
    try {
      const [enquiryRows, productRows, quotationRows] = await Promise.all([
        listEnquiries(),
        listProducts(),
        listQuotations(),
      ]);
      setEnquiries(enquiryRows);
      setProducts(productRows);
      setQuotations(quotationRows);
      if (enquiryRows.length > 0 && !enquiryId) {
        setEnquiryId(enquiryRows[0].id);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setPageError(error instanceof Error ? error.message : "Failed to load quotations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addLine() {
    setLines((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        productId: "",
        quantity: "1",
        unitPrice: "",
        discountPercent: "0",
        gstPercent: "18",
      },
    ]);
  }

  function removeLine(key: string) {
    setLines((current) =>
      current.length === 1 ? current : current.filter((line) => line.key !== key)
    );
  }

  function updateLine(key: string, patch: Partial<LineDraft>) {
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  }

  function onProductChange(key: string, productId: string) {
    const product = products.find((row) => row.id === productId);
    updateLine(key, {
      productId,
      unitPrice: product ? product.basePrice : "",
    });
  }

  function availableProductsFor(lineKey: string): Product[] {
    const selectedElsewhere = new Set(
      lines.filter((line) => line.key !== lineKey && line.productId).map((l) => l.productId)
    );
    return products.filter((product) => !selectedElsewhere.has(product.id));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate) {
      setFormError("Only sales users can create quotations.");
      return;
    }

    setFormError(null);
    setSuccessMessage(null);
    setSubmitting(true);

    try {
      if (!enquiryId) {
        throw new Error("Select an enquiry.");
      }

      const items = lines.map((line) => {
        const quantity = Number(line.quantity);
        const unitPrice = Number(line.unitPrice);
        const discountPercent = Number(line.discountPercent);
        const gstPercent = Number(line.gstPercent);

        if (!line.productId) {
          throw new Error("Each line must include a product.");
        }
        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new Error("Quantities must be positive whole numbers.");
        }
        if (!Number.isFinite(unitPrice) || unitPrice < 0) {
          throw new Error("Unit price must be zero or greater.");
        }
        if (
          !Number.isFinite(discountPercent) ||
          discountPercent < 0 ||
          discountPercent > 100
        ) {
          throw new Error("Discount must be between 0 and 100.");
        }
        if (!Number.isFinite(gstPercent) || gstPercent < 0) {
          throw new Error("GST must be zero or greater.");
        }

        return {
          productId: line.productId,
          quantity,
          unitPrice,
          discountPercent,
          gstPercent,
        };
      });

      const quotation = await createQuotation({
        enquiryId,
        validUntil,
        items,
      });

      setQuotations((current) => [quotation, ...current]);
      setSelectedId(quotation.id);
      setSuccessMessage(
        `Quotation ${quotation.quotationNumber} created. Backend grand total: ${quotation.grandTotal}`
      );
      setLines([
        {
          key: crypto.randomUUID(),
          productId: "",
          quantity: "1",
          unitPrice: "",
          discountPercent: "0",
          gstPercent: "18",
        },
      ]);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setFormError(error instanceof Error ? error.message : "Unable to create quotation");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(status: QuotationStatus) {
    if (!selected || !canUpdateStatus) return;
    setStatusBusy(true);
    setFormError(null);
    try {
      const updated = await updateQuotationStatus(selected.id, status);
      setQuotations((current) =>
        current.map((row) => (row.id === updated.id ? updated : row))
      );
      setSuccessMessage(`Status updated to ${updated.status}.`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setFormError(error instanceof Error ? error.message : "Unable to update status");
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleConvert() {
    if (!selected || !canConvert) return;
    setConverting(true);
    setFormError(null);
    setSuccessMessage(null);
    try {
      const order = await convertQuotation(selected.id);
      setQuotations((current) =>
        current.map((row) =>
          row.id === selected.id
            ? {
                ...row,
                salesOrder: {
                  id: order.id,
                  orderNumber: order.orderNumber,
                  status: order.status,
                },
              }
            : row
        )
      );
      setSuccessMessage(
        `Converted to sales order ${order.orderNumber}. Opening Sales Orders...`
      );
      navigate(`/app/sales-orders`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setFormError(error instanceof Error ? error.message : "Unable to convert quotation");
    } finally {
      setConverting(false);
    }
  }

  return (
    <AppShell
      title="Quotations"
      description="Price enquiry lines with discount and GST, then track acceptance."
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
          <Panel title="Quotation list">
            {loading ? (
              <p className="text-sm text-slate-500">Loading quotations...</p>
            ) : pageError ? (
              <Alert>{pageError}</Alert>
            ) : quotations.length === 0 ? (
              <EmptyState
                title="No quotations yet"
                body="Create a quotation from an existing enquiry."
              />
            ) : (
              <TableWrap>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Number</th>
                      <th>Customer</th>
                      <th>Enquiry</th>
                      <th>Valid until</th>
                      <th>Status</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotations.map((quotation) => (
                      <tr
                        key={quotation.id}
                        className={selectedId === quotation.id ? "is-selected" : undefined}
                        onClick={() => setSelectedId(quotation.id)}
                      >
                        <td className="font-medium">{quotation.quotationNumber}</td>
                        <td>{quotation.customer.companyName}</td>
                        <td>{quotation.enquiry.enquiryNumber}</td>
                        <td>{formatDate(quotation.validUntil)}</td>
                        <td>
                          <StatusBadge status={quotation.status} />
                        </td>
                        <td>{quotation.grandTotal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Panel>

          {selected ? (
            <Panel title={`Quotation detail — ${selected.quotationNumber}`}>
              <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <dt className="text-slate-500">Customer</dt>
                  <dd className="font-medium text-slate-900">
                    {selected.customer.companyName}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Enquiry</dt>
                  <dd className="text-slate-800">{selected.enquiry.enquiryNumber}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Status</dt>
                  <dd>
                    <StatusBadge status={selected.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Grand total (backend)</dt>
                  <dd className="font-medium text-slate-900">{selected.grandTotal}</dd>
                </div>
              </dl>

              <TableWrap>
                <table className="erp-table mt-5">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Disc%</th>
                      <th>GST%</th>
                      <th>Line</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.product.productCode}</td>
                        <td>{item.quantity}</td>
                        <td>{item.unitPrice}</td>
                        <td>{item.discountPercent}</td>
                        <td>{item.gstPercent}</td>
                        <td>{item.lineAmount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>

              {canUpdateStatus ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {nextStatuses(selected.status).map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={statusBusy}
                      onClick={() => void handleStatusChange(status)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Mark {status}
                    </button>
                  ))}
                  {nextStatuses(selected.status).length === 0 ? (
                    <p className="text-sm text-slate-500">No further transitions.</p>
                  ) : null}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  Status updates are restricted to ADMIN.
                </p>
              )}

              {selected.salesOrder ? (
                <p className="mt-4 text-sm text-slate-700">
                  Linked sales order:{" "}
                  <Link
                    to="/app/sales-orders"
                    className="font-medium text-slate-900 underline"
                  >
                    {selected.salesOrder.orderNumber}
                  </Link>{" "}
                  (<StatusBadge status={selected.salesOrder.status} />)
                </p>
              ) : null}

              {canConvert && selected.status === "ACCEPTED" && !selected.salesOrder ? (
                <button
                  type="button"
                  disabled={converting}
                  onClick={() => void handleConvert()}
                  className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {converting ? "Converting..." : "Convert to Sales Order"}
                </button>
              ) : null}

              {formError ? <Alert>{formError}</Alert> : null}
              {successMessage ? (
                <Alert tone="success">{successMessage}</Alert>
              ) : null}
            </Panel>
          ) : null}
        </section>

        <section className="lg:col-span-2">
          <Panel title="Create quotation">
            {!canCreate ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Signed in as ADMIN — create is restricted to SALES_USER. You can view
                  quotations and update status.
                </p>
                {formError ? <Alert>{formError}</Alert> : null}
                {successMessage ? (
                  <Alert tone="success">{successMessage}</Alert>
                ) : null}
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="erp-label">Enquiry</label>
                  <select
                    value={enquiryId}
                    onChange={(e) => setEnquiryId(e.target.value)}
                    className="erp-input"
                    required
                  >
                    <option value="">Select enquiry</option>
                    {enquiries.map((enquiry) => (
                      <option key={enquiry.id} value={enquiry.id}>
                        {enquiry.enquiryNumber} — {enquiry.customer.companyName}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedEnquiry ? (
                  <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <p>
                      <span className="font-medium">Customer:</span>{" "}
                      {selectedEnquiry.customer.companyName}
                    </p>
                    <p className="mt-1">
                      <span className="font-medium">Enquiry items:</span>{" "}
                      {selectedEnquiry.items
                        .map(
                          (item) =>
                            `${item.product.productCode} × ${item.quantity}`
                        )
                        .join(", ")}
                    </p>
                  </div>
                ) : null}

                <div>
                  <label className="erp-label">Valid until</label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="erp-input"
                    required
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-slate-800">Line items</h3>
                    <button
                      type="button"
                      onClick={addLine}
                      className="text-sm text-slate-700 hover:text-slate-900"
                    >
                      Add product
                    </button>
                  </div>

                  {lines.map((line) => (
                    <div
                      key={line.key}
                      className="space-y-2 rounded-md border border-slate-200 p-3"
                    >
                      <select
                        value={line.productId}
                        onChange={(e) => onProductChange(line.key, e.target.value)}
                        className="erp-input"
                        required
                      >
                        <option value="">Select product</option>
                        {availableProductsFor(line.key).map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.productCode} — {product.productName}
                          </option>
                        ))}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(line.key, { quantity: e.target.value })
                          }
                          className="erp-input"
                          placeholder="Qty"
                          required
                        />
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.unitPrice}
                          onChange={(e) =>
                            updateLine(line.key, { unitPrice: e.target.value })
                          }
                          className="erp-input"
                          placeholder="Unit price"
                          required
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step="0.01"
                          value={line.discountPercent}
                          onChange={(e) =>
                            updateLine(line.key, { discountPercent: e.target.value })
                          }
                          className="erp-input"
                          placeholder="Discount %"
                          required
                        />
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.gstPercent}
                          onChange={(e) =>
                            updateLine(line.key, { gstPercent: e.target.value })
                          }
                          className="erp-input"
                          placeholder="GST %"
                          required
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>
                          Preview line: {previewLineAmount(line).toFixed(2)} (UI only)
                        </span>
                        <button
                          type="button"
                          onClick={() => removeLine(line.key)}
                          className="text-slate-600 hover:text-slate-900"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-sm text-slate-600">
                  Preview grand total: {previewTotal.toFixed(2)} — backend recalculates
                  and is authoritative.
                </p>

                {formError ? <Alert>{formError}</Alert> : null}
                {successMessage ? (
                  <Alert tone="success">{successMessage}</Alert>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {submitting ? "Saving..." : "Create quotation"}
                </button>
              </form>
            )}
          </Panel>
        </section>
      </div>
    </AppShell>
  );
}
