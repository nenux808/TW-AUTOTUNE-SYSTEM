export type Job = {
  id: string;
  job_number: number;
  customer_id: string;
  vehicle_id: string;
  job_type: string;
  priority: string;
  status: string;
  odometer: number | null;
  next_service_interval_km: number | null;
  next_service_odometer: number | null;
  next_service_due_date: string | null;
  customer_complaint: string | null;
  initial_notes: string | null;
  diagnosis_summary: string | null;
  work_completed: string | null;
  recommendations: string | null;
  safety_status: string | null;
  estimated_total: number | null;
  final_total: number | null;
  created_at: string;
  completed_at: string | null;
  customers?: {
    full_name: string;
    phone: string;
  } | null;
  vehicles?: {
    registration: string;
    make: string | null;
    model: string | null;
    year: number | null;
    customer_id?: string;
  } | null;
};
