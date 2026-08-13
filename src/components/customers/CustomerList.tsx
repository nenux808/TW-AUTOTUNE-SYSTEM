import { useState } from "react";
import type { Customer } from "@/types/customer";

type CustomerListProps = {
  customers: Customer[];
  onDeleteCustomer?: (customerId: string) => void;
  onUpdateCustomer: (
    customerId: string,
    updates: Pick<
      Customer,
      "full_name" | "phone" | "email" | "address" | "customer_type" | "notes" | "status"
    >
  ) => Promise<string | null>;
};

type EditForm = {
  full_name: string;
  phone: string;
  email: string;
  address: string;
  customer_type: string;
  notes: string;
  status: string;
};

export default function CustomerList({
  customers,
  onDeleteCustomer,
  onUpdateCustomer,
}: CustomerListProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");

  function startEditing(customer: Customer) {
    setEditingCustomer(customer);
    setEditForm({
      full_name: customer.full_name,
      phone: customer.phone,
      email: customer.email ?? "",
      address: customer.address ?? "",
      customer_type: customer.customer_type || "individual",
      notes: customer.notes ?? "",
      status: customer.status || "active",
    });
    setEditError("");
    setConfirmingId(null);
  }

  function closeEditor() {
    if (saving) return;
    setEditingCustomer(null);
    setEditForm(null);
    setEditError("");
  }

  function updateEditField(field: keyof EditForm, value: string) {
    setEditForm((current) => current ? { ...current, [field]: value } : current);
  }

  async function saveCustomer(event: React.FormEvent) {
    event.preventDefault();
    if (!editingCustomer || !editForm) return;

    if (!editForm.full_name.trim() || !editForm.phone.trim()) {
      setEditError("Customer name and phone number are required.");
      return;
    }

    setSaving(true);
    setEditError("");

    const error = await onUpdateCustomer(editingCustomer.id, {
      full_name: editForm.full_name.trim(),
      phone: editForm.phone.trim(),
      email: editForm.email.trim() || null,
      address: editForm.address.trim() || null,
      customer_type: editForm.customer_type,
      notes: editForm.notes.trim() || null,
      status: editForm.status,
    });

    setSaving(false);
    if (error) {
      setEditError(error);
      return;
    }

    setEditingCustomer(null);
    setEditForm(null);
  }

  if (customers.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">No customers yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-red-600">Customer Records</p>
          <h2 className="text-2xl font-bold text-slate-900">Customers</h2>
        </div>

        <span className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
          {customers.length} total
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-950 text-white">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>

          <tbody>
            {customers.map((customer) => {
              const isConfirming = confirmingId === customer.id;

              return (
                <tr key={customer.id} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {customer.full_name}
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    {customer.phone || "-"}
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    {customer.email || "-"}
                  </td>

                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {customer.customer_type || "Individual"}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        customer.active === false || customer.status === "inactive"
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {customer.active === false || customer.status === "inactive" ? "Inactive" : "Active"}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    {isConfirming ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteCustomer?.(customer.id);
                            setConfirmingId(null);
                          }}
                          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                        >
                          Confirm
                        </button>

                        <button
                          type="button"
                          onClick={() => setConfirmingId(null)}
                          className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEditing(customer)}
                          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmingId(customer.id)}
                          className="rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-200"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Delete is only allowed when the customer has no linked protected records such as jobs or invoices.
      </p>

      {editingCustomer && editForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-customer-title"
        >
          <form
            onSubmit={saveCustomer}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-red-600">Customer record</p>
                <h3 id="edit-customer-title" className="text-2xl font-bold text-slate-900">
                  Edit customer
                </h3>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                disabled={saving}
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                aria-label="Close edit customer form"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium text-slate-700">
                Full name *
                <input
                  value={editForm.full_name}
                  onChange={(event) => updateEditField("full_name", event.target.value)}
                  required
                  autoFocus
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-red-500"
                />
              </label>

              <label className="text-sm font-medium text-slate-700">
                Phone *
                <input
                  value={editForm.phone}
                  onChange={(event) => updateEditField("phone", event.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-red-500"
                />
              </label>

              <label className="text-sm font-medium text-slate-700">
                Email
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(event) => updateEditField("email", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-red-500"
                />
              </label>

              <label className="text-sm font-medium text-slate-700">
                Customer type
                <select
                  value={editForm.customer_type}
                  onChange={(event) => updateEditField("customer_type", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-red-500"
                >
                  <option value="individual">Individual</option>
                  <option value="student">Student</option>
                  <option value="business">Business</option>
                  <option value="fleet">Fleet</option>
                </select>
              </label>

              <label className="text-sm font-medium text-slate-700 md:col-span-2">
                Address
                <input
                  value={editForm.address}
                  onChange={(event) => updateEditField("address", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-red-500"
                />
              </label>

              <label className="text-sm font-medium text-slate-700">
                Status
                <select
                  value={editForm.status}
                  onChange={(event) => updateEditField("status", event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-red-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>

              <label className="text-sm font-medium text-slate-700 md:col-span-2">
                Notes
                <textarea
                  value={editForm.notes}
                  onChange={(event) => updateEditField("notes", event.target.value)}
                  className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-red-500"
                />
              </label>
            </div>

            {editError && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {editError}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeEditor}
                disabled={saving}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}