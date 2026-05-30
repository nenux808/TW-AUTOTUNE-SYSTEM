export type InspectionCategory = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number | null;
  active: boolean;
};

export type InspectionChecklistItem = {
  id: string;
  category_id: string;
  item_name: string;
  input_type: string;
  measurement_unit: string | null;
  vehicle_type: string | null;
  default_customer_visible: boolean;
  sort_order: number | null;
  active: boolean;
  inspection_categories?: {
    name: string;
    sort_order: number | null;
  } | null;
};

export type JobInspectionItemInput = {
  checklist_item_id: string;
  category_name: string;
  item_name: string;
  status: string;
  measurement_value: string;
  measurement_unit: string;
  mechanic_note: string;
  recommendation: string;
  repaired_during_job: boolean;
  show_on_invoice: boolean;
  quote_required: boolean;
};
