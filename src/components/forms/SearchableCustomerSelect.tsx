"use client";

import { useMemo, useState } from "react";

type Customer = {
  id: string;
  full_name: string;
  phone: string | null;
  email?: string | null;
};

type SearchableCustomerSelectProps = {
  customers: Customer[];
  value: string;
  onChange: (customerId: string) => void;
  placeholder?: string;
};

export default function SearchableCustomerSelect({
  customers,
  value,
  onChange,
  placeholder = "Search customer name or phone...",
}: SearchableCustomerSelectProps) {
  const selectedCustomer = customers.find((customer) => customer.id === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filteredCustomers = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) return customers.slice(0, 8);

    return customers
      .filter((customer) => {
        const searchable = [
          customer.full_name,
          customer.phone,
          customer.email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(search);
      })
      .slice(0, 12);
  }, [customers, query]);

  function selectCustomer(customer: Customer) {
    onChange(customer.id);
    setQuery("");
    setOpen(false);
  }

  function clearCustomer() {
    onChange("");
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative">
      {selectedCustomer ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3">
          <div>
            <p className="font-semibold text-slate-900">
              {selectedCustomer.full_name}
            </p>
            <p className="text-xs text-slate-500">
              {selectedCustomer.phone || "No phone"}
              {selectedCustomer.email ? ` • ${selectedCustomer.email}` : ""}
            </p>
          </div>

          <button
            type="button"
            onClick={clearCustomer}
            className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-red-100 hover:text-red-700"
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
            placeholder={placeholder}
          />

          {open && (
            <div className="absolute z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
              {filteredCustomers.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">
                  No matching customers found.
                </p>
              ) : (
                filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => selectCustomer(customer)}
                    className="block w-full border-b border-slate-100 p-3 text-left hover:bg-red-50"
                  >
                    <p className="font-semibold text-slate-900">
                      {customer.full_name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {customer.phone}
                      {customer.email ? ` • ${customer.email}` : ""}
                    </p>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

