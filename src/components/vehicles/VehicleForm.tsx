"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Customer } from "@/types/customer";

type Props = {
  customers: Customer[];
  onVehicleAdded: (vehicleId?: string, customerId?: string) => void; initialCustomerId?: string;
};

export default function VehicleForm({ customers, onVehicleAdded, initialCustomerId }: Props) {
  const supabase = createClient();

  const [form, setForm] = useState({
    customer_id: initialCustomerId || "",
    registration: "",
    make: "",
    model: "",
    year: "",
    vin: "",
    engine_number: "",
    odometer: "",
    fuel_type: "",
    transmission: "",
    colour: "",
    vehicle_type: "standard",
    notes: "",
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

    if (!form.customer_id || !form.registration.trim()) {
      setMessage("Customer and registration number are required.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.from("vehicles").insert({
      customer_id: form.customer_id,
      registration: form.registration.trim().toUpperCase(),
      make: form.make.trim() || null,
      model: form.model.trim() || null,
      year: form.year ? Number(form.year) : null,
      vin: form.vin.trim() || null,
      engine_number: form.engine_number.trim() || null,
      odometer: form.odometer ? Number(form.odometer) : null,
      fuel_type: form.fuel_type || null,
      transmission: form.transmission || null,
      colour: form.colour.trim() || null,
      vehicle_type: form.vehicle_type,
      notes: form.notes.trim() || null,
    }).select("id").single();

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setForm({
      customer_id: initialCustomerId || "",
      registration: "",
      make: "",
      model: "",
      year: "",
      vin: "",
      engine_number: "",
      odometer: "",
      fuel_type: "",
      transmission: "",
      colour: "",
      vehicle_type: "standard",
      notes: "",
    });

    setMessage("Vehicle added successfully.");
    onVehicleAdded(data?.id, form.customer_id);
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-medium text-red-600">New Vehicle</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">Add vehicle</h2>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="text-sm font-medium text-slate-700">Customer *</label>
          <select
            value={form.customer_id}
            onChange={(e) => updateField("customer_id", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
          >
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.full_name} - {customer.phone}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Registration *</label>
          <input
            value={form.registration}
            onChange={(e) => updateField("registration", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 uppercase outline-none focus:border-red-500"
            placeholder="ABC123"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Vehicle type</label>
          <select
            value={form.vehicle_type}
            onChange={(e) => updateField("vehicle_type", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
          >
            <option value="standard">Standard</option>
            <option value="4x4">4X4</option>
            <option value="commercial">Commercial</option>
            <option value="hybrid">Hybrid</option>
            <option value="electric">Electric</option>
            <option value="performance">Performance</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Make</label>
          <input
            value={form.make}
            onChange={(e) => updateField("make", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
            placeholder="Toyota"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Model</label>
          <input
            value={form.model}
            onChange={(e) => updateField("model", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
            placeholder="Hilux"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Year</label>
          <input
            type="number"
            value={form.year}
            onChange={(e) => updateField("year", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
            placeholder="2018"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Odometer</label>
          <input
            type="number"
            value={form.odometer}
            onChange={(e) => updateField("odometer", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
            placeholder="142500"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Fuel type</label>
          <select
            value={form.fuel_type}
            onChange={(e) => updateField("fuel_type", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
          >
            <option value="">Select fuel</option>
            <option value="petrol">Petrol</option>
            <option value="diesel">Diesel</option>
            <option value="hybrid">Hybrid</option>
            <option value="electric">Electric</option>
            <option value="lpg">LPG</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Transmission</label>
          <select
            value={form.transmission}
            onChange={(e) => updateField("transmission", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
          >
            <option value="">Select transmission</option>
            <option value="automatic">Automatic</option>
            <option value="manual">Manual</option>
            <option value="cvt">CVT</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">VIN</label>
          <input
            value={form.vin}
            onChange={(e) => updateField("vin", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
            placeholder="VIN number"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Engine number</label>
          <input
            value={form.engine_number}
            onChange={(e) => updateField("engine_number", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
            placeholder="Engine number"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Colour</label>
          <input
            value={form.colour}
            onChange={(e) => updateField("colour", e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
            placeholder="White"
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-sm font-medium text-slate-700">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
            className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
            placeholder="Vehicle notes, known issues, customer requests..."
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
        {loading ? "Saving..." : "Add Vehicle"}
      </button>
    </form>
  );
}


