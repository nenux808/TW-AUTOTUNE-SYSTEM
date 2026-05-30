"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  onCustomerAdded: (customerId?: string) => void;
};

export default function CustomerForm({ onCustomerAdded }: Props) {
  const supabase = createClient();

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    address: "",
    customer_type: "individual",
    notes: "",
    status: "active",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (!form.full_name.trim() || !form.phone.trim()) {
      setMessage("Customer name and phone number are required.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.from("customers").insert({
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      customer_type: form.customer_type,
      notes: form.notes.trim() || null,
      status: form.status,
    }).select("id").single();

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setForm({
      full_name: "",
      phone: "",
      email: "",
      address: "",
      customer_type: "individual",
      notes: "",
      status: "active",
    });

    setMessage("Customer added successfully.");
    onCustomerAdded(data?.id);
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-medium text-red-600">New Customer</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">Add customer</h2>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-slate-700">Full name *</label>
          <input
            value={form.full_name}
            onChange={(e) => updateField("full_name", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
            placeholder="Customer full name"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Phone *</label>
          <input
            value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
            placeholder="04xx xxx xxx"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Email</label>
          <input
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
            placeholder="customer@email.com"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Customer type</label>
          <select
            value={form.customer_type}
            onChange={(e) => updateField("customer_type", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
          >
            <option value="individual">Individual</option>
            <option value="student">Student</option>
            <option value="business">Business</option>
            <option value="fleet">Fleet</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="text-sm font-medium text-slate-700">Address</label>
          <input
            value={form.address}
            onChange={(e) => updateField("address", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
            placeholder="Customer address"
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-sm font-medium text-slate-700">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
            placeholder="Special notes, customer preferences, warnings, etc."
          />
        </div>
      </div>

      {message && (
        <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 rounded-xl bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
      >
        {loading ? "Saving..." : "Add Customer"}
      </button>
    </form>
  );
}

