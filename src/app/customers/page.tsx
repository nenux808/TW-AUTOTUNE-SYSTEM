"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CustomerForm from "@/components/customers/CustomerForm";
import CustomerList from "@/components/customers/CustomerList";
import type { Customer } from "@/types/customer";

export default function CustomersPage() {
  const supabase = createClient();
  const router = useRouter();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadCustomers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setCustomers(data);
    }

    setLoading(false);
  }


  async function deleteCustomer(customerId: string) {
    setMessage("");

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", customerId);

    if (error) {
      setMessage(
        "Could not delete customer. This customer may have linked vehicles, jobs, invoices, or payments. Use inactive/archive later for business records."
      );
      return;
    }

    setMessage("Customer deleted successfully.");
    await loadCustomers();
  }
  useEffect(() => {
    loadCustomers();
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-red-600">TW AUTO TUNE</p>
            <h1 className="text-3xl font-bold text-slate-900">Customers</h1>
            <p className="mt-1 text-slate-600">
              Add and manage customer records for jobs, vehicles and invoices.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to Dashboard
          </Link>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            {message}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <CustomerForm onCustomerAdded={(customerId) => {
            loadCustomers();

            if (customerId) {
              router.push(`/vehicles?customer_id=${customerId}`);
            }
          }} />

          {loading ? (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              Loading customers...
            </div>
          ) : (
            <CustomerList customers={customers} onDeleteCustomer={deleteCustomer} />
          )}
        </div>
      </div>
    </main>
  );
}



