export type Customer = {
  id: string;
  full_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  customer_type: string;
  notes: string | null;
  status: string;
  created_at: string;
};
