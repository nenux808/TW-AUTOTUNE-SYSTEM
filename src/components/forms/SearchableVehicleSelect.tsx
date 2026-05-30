"use client";

import { useMemo, useState } from "react";

type Vehicle = {
  id: string;
  customer_id: string;
  registration: string;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  odometer?: number | null;
};

type SearchableVehicleSelectProps = {
  vehicles: Vehicle[];
  value: string;
  onChange: (vehicleId: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export default function SearchableVehicleSelect({
  vehicles,
  value,
  onChange,
  disabled = false,
  placeholder = "Search registration, make, or model...",
}: SearchableVehicleSelectProps) {
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === value);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filteredVehicles = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) return vehicles.slice(0, 8);

    return vehicles
      .filter((vehicle) => {
        const searchable = [
          vehicle.registration,
          vehicle.make,
          vehicle.model,
          vehicle.year,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(search);
      })
      .slice(0, 12);
  }, [vehicles, query]);

  function selectVehicle(vehicle: Vehicle) {
    onChange(vehicle.id);
    setQuery("");
    setOpen(false);
  }

  function clearVehicle() {
    onChange("");
    setQuery("");
    setOpen(false);
  }

  if (disabled) {
    return (
      <div className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-400">
        Select customer first
      </div>
    );
  }

  return (
    <div className="relative">
      {selectedVehicle ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3">
          <div>
            <p className="font-semibold uppercase text-slate-900">
              {selectedVehicle.registration}
            </p>
            <p className="text-xs text-slate-500">
              {[selectedVehicle.make, selectedVehicle.model, selectedVehicle.year]
                .filter(Boolean)
                .join(" ") || "Vehicle details not added"}
              {selectedVehicle.odometer
                ? ` • ${Number(selectedVehicle.odometer).toLocaleString()} km`
                : ""}
            </p>
          </div>

          <button
            type="button"
            onClick={clearVehicle}
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
            className="w-full rounded-xl border border-slate-300 px-4 py-3 uppercase outline-none focus:border-red-500"
            placeholder={placeholder}
          />

          {open && (
            <div className="absolute z-50 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
              {filteredVehicles.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">
                  No matching vehicles found.
                </p>
              ) : (
                filteredVehicles.map((vehicle) => (
                  <button
                    key={vehicle.id}
                    type="button"
                    onClick={() => selectVehicle(vehicle)}
                    className="block w-full border-b border-slate-100 p-3 text-left hover:bg-red-50"
                  >
                    <p className="font-semibold uppercase text-slate-900">
                      {vehicle.registration}
                    </p>
                    <p className="text-xs text-slate-500">
                      {[vehicle.make, vehicle.model, vehicle.year]
                        .filter(Boolean)
                        .join(" ") || "Vehicle details not added"}
                      {vehicle.odometer
                        ? ` • ${Number(vehicle.odometer).toLocaleString()} km`
                        : ""}
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
