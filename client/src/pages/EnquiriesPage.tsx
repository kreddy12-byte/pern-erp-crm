import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/http";
import {
  createCustomer,
  createEnquiry,
  listCustomers,
  listEnquiries,
  listProducts,
  type Customer,
  type Enquiry,
  type Product,
} from "../api/erpApi";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";
import { Alert, EmptyState, Panel, StatusBadge, TableWrap } from "../components/ui";

type LineDraft = {
  key: string;
  productId: string;
  quantity: string;
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString();
}

export function EnquiriesPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const canCreate = user?.role === "SALES_USER";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [selectedEnquiryId, setSelectedEnquiryId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [customerMode, setCustomerMode] = useState<"existing" | "new">("existing");
  const [customerId, setCustomerId] = useState("");
  const [newCustomer, setNewCustomer] = useState({
    companyName: "",
    contactPerson: "",
    mobile: "",
    email: "",
    city: "",
  });
  const [enquiryDate, setEnquiryDate] = useState(todayIsoDate());
  const [requiredDate, setRequiredDate] = useState(todayIsoDate());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([
    { key: crypto.randomUUID(), productId: "", quantity: "1" },
  ]);

  const selectedEnquiry = useMemo(
    () => enquiries.find((enquiry) => enquiry.id === selectedEnquiryId) ?? null,
    [enquiries, selectedEnquiryId]
  );

  async function loadData() {
    setLoading(true);
    setPageError(null);
    try {
      const [customerRows, productRows, enquiryRows] = await Promise.all([
        listCustomers(),
        listProducts(),
        listEnquiries(),
      ]);
      setCustomers(customerRows);
      setProducts(productRows);
      setEnquiries(enquiryRows);
      if (customerRows.length > 0 && !customerId) {
        setCustomerId(customerRows[0].id);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setPageError(error instanceof Error ? error.message : "Failed to load enquiries");
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
      { key: crypto.randomUUID(), productId: "", quantity: "1" },
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

  function availableProductsFor(lineKey: string): Product[] {
    const selectedElsewhere = new Set(
      lines.filter((line) => line.key !== lineKey && line.productId).map((l) => l.productId)
    );
    return products.filter((product) => !selectedElsewhere.has(product.id));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreate) {
      setFormError("Only sales users can create enquiries.");
      return;
    }

    setFormError(null);
    setSuccessMessage(null);
    setSubmitting(true);

    try {
      let resolvedCustomerId = customerId;

      if (customerMode === "new") {
        const created = await createCustomer(newCustomer);
        resolvedCustomerId = created.id;
        setCustomers((current) =>
          [...current, created].sort((a, b) => a.companyName.localeCompare(b.companyName))
        );
        setCustomerMode("existing");
        setCustomerId(created.id);
      }

      if (!resolvedCustomerId) {
        throw new Error("Please select or create a customer.");
      }

      const items = lines.map((line) => {
        const quantity = Number(line.quantity);
        if (!line.productId) {
          throw new Error("Each line must include a product.");
        }
        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new Error("Quantities must be positive whole numbers.");
        }
        return { productId: line.productId, quantity };
      });

      const productIds = items.map((item) => item.productId);
      if (new Set(productIds).size !== productIds.length) {
        throw new Error("Duplicate products are not allowed.");
      }

      const enquiry = await createEnquiry({
        customerId: resolvedCustomerId,
        enquiryDate,
        requiredDate,
        notes: notes.trim() || undefined,
        items,
      });

      setEnquiries((current) => [enquiry, ...current]);
      setSelectedEnquiryId(enquiry.id);
      setSuccessMessage(`Enquiry ${enquiry.enquiryNumber} created.`);
      setNotes("");
      setLines([{ key: crypto.randomUUID(), productId: "", quantity: "1" }]);
      setNewCustomer({
        companyName: "",
        contactPerson: "",
        mobile: "",
        email: "",
        city: "",
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setFormError(error instanceof Error ? error.message : "Unable to create enquiry");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell
      title="Enquiries"
      description="Capture customer demand with products, dates, and notes."
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
          <Panel title="Enquiry list">
            {loading ? (
              <p className="text-sm text-slate-500">Loading enquiries...</p>
            ) : pageError ? (
              <Alert>{pageError}</Alert>
            ) : enquiries.length === 0 ? (
              <EmptyState
                title="No enquiries yet"
                body="Create an enquiry to start the sales workflow."
              />
            ) : (
              <TableWrap>
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Number</th>
                      <th>Customer</th>
                      <th>Enquiry date</th>
                      <th>Required</th>
                      <th>Status</th>
                      <th>Items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enquiries.map((enquiry) => (
                      <tr
                        key={enquiry.id}
                        className={selectedEnquiryId === enquiry.id ? "is-selected" : undefined}
                        onClick={() => setSelectedEnquiryId(enquiry.id)}
                      >
                        <td className="font-medium">{enquiry.enquiryNumber}</td>
                        <td>{enquiry.customer.companyName}</td>
                        <td>{formatDate(enquiry.enquiryDate)}</td>
                        <td>{formatDate(enquiry.requiredDate)}</td>
                        <td>
                          <StatusBadge status={enquiry.status} />
                        </td>
                        <td>{enquiry.items.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Panel>

          {selectedEnquiry ? (
            <Panel title={`Enquiry detail — ${selectedEnquiry.enquiryNumber}`}>
              <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <dt className="text-slate-500">Customer</dt>
                  <dd className="font-medium text-slate-900">
                    {selectedEnquiry.customer.companyName}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Contact</dt>
                  <dd className="text-slate-800">
                    {selectedEnquiry.customer.contactPerson} ·{" "}
                    {selectedEnquiry.customer.mobile}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Status</dt>
                  <dd>
                    <StatusBadge status={selectedEnquiry.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Notes</dt>
                  <dd className="text-slate-800">{selectedEnquiry.notes || "—"}</dd>
                </div>
              </dl>

              <TableWrap>
                <table className="erp-table mt-5">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Code</th>
                      <th>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEnquiry.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.product.productName}</td>
                        <td className="text-slate-600">{item.product.productCode}</td>
                        <td>
                          {item.quantity} {item.product.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Panel>
          ) : null}
        </section>

        <section className="lg:col-span-2">
          <Panel title="Create enquiry">
            {!canCreate ? (
              <p className="text-sm text-slate-600">
                Signed in as ADMIN — create is restricted to SALES_USER. You can still
                view all enquiries.
              </p>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="flex gap-4 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      checked={customerMode === "existing"}
                      onChange={() => setCustomerMode("existing")}
                    />
                    Existing customer
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      checked={customerMode === "new"}
                      onChange={() => setCustomerMode("new")}
                    />
                    New customer
                  </label>
                </div>

                {customerMode === "existing" ? (
                  <div>
                    <label className="erp-label">Customer</label>
                    <select
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      className="erp-input"
                      required
                    >
                      <option value="">Select customer</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.companyName}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {(
                      [
                        ["companyName", "Company name"],
                        ["contactPerson", "Contact person"],
                        ["mobile", "Mobile"],
                        ["email", "Email"],
                        ["city", "City"],
                      ] as const
                    ).map(([field, label]) => (
                      <div key={field}>
                        <label className="erp-label">{label}</label>
                        <input
                          value={newCustomer[field]}
                          onChange={(e) =>
                            setNewCustomer((current) => ({
                              ...current,
                              [field]: e.target.value,
                            }))
                          }
                          className="erp-input"
                          required
                        />
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="erp-label">Enquiry date</label>
                    <input
                      type="date"
                      value={enquiryDate}
                      onChange={(e) => setEnquiryDate(e.target.value)}
                      className="erp-input"
                      required
                    />
                  </div>
                  <div>
                    <label className="erp-label">Required date</label>
                    <input
                      type="date"
                      value={requiredDate}
                      onChange={(e) => setRequiredDate(e.target.value)}
                      className="erp-input"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="erp-label">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="erp-input"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-slate-800">Products</h3>
                    <button
                      type="button"
                      onClick={addLine}
                      className="text-sm text-slate-700 hover:text-slate-900"
                    >
                      Add product
                    </button>
                  </div>

                  {lines.map((line) => (
                    <div key={line.key} className="grid grid-cols-[1fr_90px_auto] gap-2">
                      <select
                        value={line.productId}
                        onChange={(e) =>
                          updateLine(line.key, { productId: e.target.value })
                        }
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
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.key, { quantity: e.target.value })
                        }
                        className="erp-input"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => removeLine(line.key)}
                        className="rounded-md border border-slate-300 px-2 text-sm text-slate-600 hover:bg-slate-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                {formError ? <Alert>{formError}</Alert> : null}
                {successMessage ? (
                  <Alert tone="success">{successMessage}</Alert>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {submitting ? "Saving..." : "Create enquiry"}
                </button>
              </form>
            )}
          </Panel>
        </section>
      </div>
    </AppShell>
  );
}
