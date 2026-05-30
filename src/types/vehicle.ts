export type Vehicle = {
  id: string;
  customer_id: string;
  registration: string;
  make: string | null;
  model: string | null;
  year: number | null;
  vin: string | null;
  engine_number: string | null;
  odometer: number | null;
  fuel_type: string | null;
  transmission: string | null;
  colour: string | null;
  vehicle_type: string | null;
  notes: string | null;
  created_at: string;
  customers?: {
    full_name: string;
    phone: string;
  } | null;
};
