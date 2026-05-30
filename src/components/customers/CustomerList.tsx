import { useState } from "react";
import type { Customer } from "@/types/customer";

type CustomerListProps = {
  customers: Customer[];
  onDeleteCustomer?: (customerId: string) => void;
};

export default function CustomerList({ customers, onDeleteCustomer }: CustomerListProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

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
                        customer.active === false
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {customer.active === false ? "Inactive" : "Active"}
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
                      <button
                        type="button"
                        onClick={() => setConfirmingId(customer.id)}
                        className="rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-200"
                      >
                        Delete
                      </button>
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
    </div>
  );
}
