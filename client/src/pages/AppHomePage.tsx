import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AppShell } from "../components/AppShell";

const STEPS = [
  { title: "Enquiry", detail: "Capture customer demand with products and dates." },
  { title: "Quotation", detail: "Price lines with discount/GST; accept to proceed." },
  { title: "Sales Order", detail: "Convert an accepted quotation to a pending order." },
  { title: "Reservation", detail: "Admin confirms the order and reserves stock." },
  { title: "Dispatch", detail: "Ship confirmed orders and consume inventory." },
] as const;

export function AppHomePage() {
  const { user } = useAuth();

  return (
    <AppShell
      title="Overview"
      description="End-to-end sales operations from enquiry through dispatch."
    >
      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm xl:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">Workflow</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Step {index + 1}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{step.title}</p>
                <p className="mt-1 text-sm text-slate-500">{step.detail}</p>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              to="/app/enquiries"
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              Open Enquiries
            </Link>
            <Link
              to="/app/quotations"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Quotations
            </Link>
            <Link
              to="/app/sales-orders"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Sales Orders
            </Link>
            <Link
              to="/app/inventory"
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
            >
              Inventory
            </Link>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Signed in</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-slate-500">Name</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{user?.name}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Email</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{user?.email}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Role</dt>
              <dd className="mt-0.5">
                <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-700">
                  {user?.role}
                </span>
              </dd>
            </div>
          </dl>
          <p className="mt-5 text-sm text-slate-500">
            {user?.role === "ADMIN"
              ? "You can update quotation status, confirm sales orders, and process dispatch."
              : "You can create customers, enquiries, quotations, and convert accepted quotations."}
          </p>
        </section>
      </div>
    </AppShell>
  );
}
