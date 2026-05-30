"use client";

import type { Vehicle } from "@/types/vehicle";

type Props = {
  vehicles: Vehicle[];
};

export default function VehicleList({ vehicles }: Props) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-red-600">Vehicle Records</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Vehicles</h2>
        </div>

        <div className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
          {vehicles.length} total
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[900px] border-collapse text-left text-sm">
          <thead className="bg-slate-950 text-white">
            <tr>
              <th className="px-4 py-3">Registration</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Year</th>
              <th className="px-4 py-3">Odometer</th>
              <th className="px-4 py-3">Fuel</th>
              <th className="px-4 py-3">Type</th>
            </tr>
          </thead>

          <tbody>
            {vehicles.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  No vehicles yet. Add a customer vehicle from the form.
                </td>
              </tr>
            ) : (
              vehicles.map((vehicle) => (
                <tr key={vehicle.id} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-bold uppercase text-slate-900">
                    {vehicle.registration}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {vehicle.customers?.full_name || "-"}
                    <div className="text-xs text-slate-500">
                      {vehicle.customers?.phone || ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {[vehicle.make, vehicle.model].filter(Boolean).join(" ") || "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{vehicle.year || "-"}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {vehicle.odometer ? `${vehicle.odometer.toLocaleString()} km` : "-"}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-700">
                    {vehicle.fuel_type || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-700">
                      {vehicle.vehicle_type || "standard"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
