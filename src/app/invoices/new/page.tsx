"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCurrentRole } from "@/hooks/useCurrentRole";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type JobData = {
  id: string;
  job_number: number;
  customer_id: string;
  vehicle_id: string;
  odometer: number | null;
  job_type: string;
  customer_complaint: string | null;
  work_completed: string | null;
  next_service_odometer: number | null;
  next_service_due_date: string | null;
  customers: {
    full_name: string;
    phone: string;
    email: string | null;
    address: string | null;
  } | null;
  vehicles: {
    registration: string;
    make: string | null;
    model: string | null;
    year: number | null;
  } | null;
};

type PackageItem = {
  id: string;
  name: string;
  base_price: number;
  price_note: string | null;
};

type ServiceItem = {
  id: string;
  name: string;
  default_price: number | null;
  category: string | null;
};

type PartItem = {
  id: string;
  part_name: string;
  part_number: string | null;
  category: string | null;
  supplier: string | null;
  cost_price: number | null;
  average_cost: number | null;
  selling_price: number;
  quantity_in_stock: number | null;
  item_type: string | null;
  customer_billable: boolean | null;
};

type InvoiceLine = {
  id: string;
  item_type: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  included_in_package: boolean;
  visibility: string;
  billing_mode: string;
  cost_affects_profit: boolean;
  included_note: string | null;
  part_id: string | null;
  cost_price: number;
  supplier: string | null;
  current_stock: number | null;
};

function formatJobNumber(jobNumber?: number) {
  return "JOB-" + String(jobNumber || 0).padStart(5, "0");
}

function money(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(value || 0);
}

function billingBadgeLabel(mode: string) {
  if (mode === "included_in_package") return "Included";
  if (mode === "internal_cost_only") return "Owner only";
  return "Billable";
}

function billingBadgeClass(mode: string) {
  if (mode === "included_in_package") return "bg-blue-100 text-blue-700";
  if (mode === "internal_cost_only") return "bg-purple-100 text-purple-700";
  return "bg-green-100 text-green-700";
}

function billingHelpText(mode: string) {
  if (mode === "included_in_package") return "Customer sees this as included. No extra charge.";
  if (mode === "internal_cost_only") return "Hidden from customer. Owner copy only.";
  return "Customer sees and pays for this item.";
}

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());
}

export default function NewInvoicePage() {
  const { isOwner } = useCurrentRole();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const jobId = searchParams.get("job_id") || searchParams.get("jobId") || "";

  const [job, setJob] = useState<JobData | null>(null);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [parts, setParts] = useState<PartItem[]>([]);
  const [partSearch, setPartSearch] = useState("");
  const [labourRate, setLabourRate] = useState(100);
  const [gstRate, setGstRate] = useState(10);
  const [lines, setLines] = useState<InvoiceLine[]>([]);
  const [notes, setNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [status, setStatus] = useState("draft");
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const filteredParts = useMemo(() => {
    const query = partSearch.trim().toLowerCase();

    if (!query) return parts.slice(0, 8);

    return parts
      .filter((part) => {
        const searchable = [
          part.part_name,
          part.part_number,
          part.category,
          part.supplier,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(query);
      })
      .slice(0, 10);
  }, [parts, partSearch]);

  const subtotal = useMemo(() => {
    return lines.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  }, [lines]);

  const gstAmount = useMemo(() => {
    return subtotal * (gstRate / 100);
  }, [subtotal, gstRate]);

  const total = useMemo(() => {
    return subtotal + gstAmount;
  }, [subtotal, gstAmount]);

  const totalCost = useMemo(() => {
    return lines.reduce((sum, item) => {
      if (item.item_type !== "part") return sum;
      return sum + item.quantity * item.cost_price;
    }, 0);
  }, [lines]);

  const totalProfit = useMemo(() => {
    return subtotal - totalCost;
  }, [subtotal, totalCost]);

  const profitMargin = useMemo(() => {
    return subtotal > 0 ? (totalProfit / subtotal) * 100 : 0;
  }, [subtotal, totalProfit]);

  async function loadData() {
    setLoading(true);
    setMessage("");

    if (!jobId) {
      setMessage("No job selected.");
      setLoading(false);
      return;
    }

    const jobRes = await supabase
      .from("jobs")
      .select(`
        *,
        customers(full_name, phone, email, address),
        vehicles(registration, make, model, year)
      `)
      .eq("id", jobId)
      .single();

    const packageRes = await supabase
      .from("service_packages")
      .select("id, name, base_price, price_note")
      .eq("active", true)
      .order("name", { ascending: true });

    const serviceRes = await supabase
      .from("services")
      .select("id, name, default_price, category")
      .eq("active", true)
      .order("name", { ascending: true });

    const partsRes = await supabase
      .from("parts")
      .select("id, part_name, part_number, category, supplier, cost_price, average_cost, selling_price, quantity_in_stock, item_type, customer_billable")
      .eq("active", true)
      .order("part_name", { ascending: true });

    const settingsRes = await supabase
      .from("business_settings")
      .select("default_labour_rate, gst_rate")
      .limit(1)
      .single();

    const errors = [
      jobRes.error ? `Job: ${jobRes.error.message}` : "",
      packageRes.error ? `Packages: ${packageRes.error.message}` : "",
      serviceRes.error ? `Services: ${serviceRes.error.message}` : "",
      partsRes.error ? `Parts: ${partsRes.error.message}` : "",
      settingsRes.error ? `Settings: ${settingsRes.error.message}` : "",
    ].filter(Boolean);

    if (errors.length > 0) {
      setMessage(errors.join(" | "));
    }

    if (jobRes.error) {
      setLoading(false);
      return;
    }

    setJob(jobRes.data as JobData);
    setPackages((packageRes.data || []) as PackageItem[]);
    setServices((serviceRes.data || []) as ServiceItem[]);
    setParts((partsRes.data || []) as PartItem[]);

    if (settingsRes.data?.default_labour_rate) {
      setLabourRate(Number(settingsRes.data.default_labour_rate));
    }

    if (settingsRes.data?.gst_rate) {
      setGstRate(Number(settingsRes.data.gst_rate));
    }

    setNotes(
      jobRes.data?.next_service_odometer || jobRes.data?.next_service_due_date
        ? `Next service due at ${
            jobRes.data.next_service_odometer
              ? Number(jobRes.data.next_service_odometer).toLocaleString() + " km"
              : "-"
          } or ${jobRes.data.next_service_due_date || "-"}, whichever comes first.`
        : ""
    );

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [jobId]);

  function addLine(item: Omit<InvoiceLine, "id">) {
    setLines((prev) => [
      ...prev,
      {
        ...item,
        id: makeId(),
      },
    ]);
  }

  function updateLine(id: string, field: keyof InvoiceLine, value: string | number | boolean) {
    setLines((prev) =>
      prev.map((line) =>
        line.id === id
          ? {
              ...line,
              [field]:
                field === "quantity" ||
                field === "unit_price" ||
                field === "tax_rate" ||
                field === "cost_price" ||
                field === "current_stock"
                  ? Number(value)
                  : value,
            }
          : line
      )
    );
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((line) => line.id !== id));
  }

  function addPackage(packageId: string) {
    if (!packageId) return;

    const selected = packages.find((item) => item.id === packageId);

    if (!selected) {
      setMessage("Package not found.");
      return;
    }

    addLine({
      item_type: "package",
      description: selected.name,
      quantity: 1,
      unit_price: Number(selected.base_price || 0),
      tax_rate: gstRate,
      included_in_package: false,
      visibility: "customer",
      billing_mode: "billable",
      cost_affects_profit: true,
      included_note: null,
      part_id: null,
      cost_price: 0,
      supplier: null,
      current_stock: null,
    });

    setMessage(`Package added: ${selected.name}`);
  }

  function addService(serviceId: string) {
    if (!serviceId) return;

    const selected = services.find((item) => item.id === serviceId);
    if (!selected) return;

    addLine({
      item_type: "service",
      description: selected.name,
      quantity: 1,
      unit_price: Number(selected.default_price || 0),
      tax_rate: gstRate,
      included_in_package: false,
      visibility: "customer",
      billing_mode: "billable",
      cost_affects_profit: true,
      included_note: null,
      part_id: null,
      cost_price: 0,
      supplier: null,
      current_stock: null,
    });
  }


  function defaultBillingModeForPart(part: PartItem) {
    const text = `${part.part_name || ""} ${part.category || ""} ${part.item_type || ""}`.toLowerCase();

    if (
      text.includes("glove") ||
      text.includes("wipe") ||
      text.includes("rag") ||
      text.includes("brake cleaner") ||
      text.includes("degreaser") ||
      text.includes("cable tie") ||
      part.item_type === "consumable"
    ) {
      return "internal_cost_only";
    }

    if (
      text.includes("engine oil") ||
      text.includes("oil filter") ||
      text.includes("sump") ||
      text.includes("washer") ||
      text.includes("fluid")
    ) {
      return "included_in_package";
    }

    return "billable";
  }

  function applyBillingModeToLine(line: InvoiceLine, mode: string): InvoiceLine {
    if (mode === "included_in_package") {
      return {
        ...line,
        billing_mode: "included_in_package",
        visibility: "customer",
        unit_price: 0,
        included_in_package: true,
        cost_affects_profit: true,
        included_note: "Included in selected service package",
      };
    }

    if (mode === "internal_cost_only") {
      return {
        ...line,
        billing_mode: "internal_cost_only",
        visibility: "owner_only",
        unit_price: 0,
        included_in_package: false,
        cost_affects_profit: true,
        included_note: "Internal workshop cost only",
      };
    }

    return {
      ...line,
      billing_mode: "billable",
      visibility: "customer",
      included_in_package: false,
      cost_affects_profit: true,
      included_note: null,
    };
  }
  function addPart(part: PartItem) {
    const costPrice = Number(part.average_cost || part.cost_price || 0);

    addLine({
      item_type: "part",
      description: `${part.part_name}${part.part_number ? ` (${part.part_number})` : ""}`,
      quantity: 1,
      unit_price: Number(part.selling_price || 0),
      tax_rate: gstRate,
      included_in_package: false,
      visibility: "customer",
      billing_mode: "billable",
      cost_affects_profit: true,
      included_note: null,
      part_id: part.id,
      cost_price: costPrice,
      supplier: part.supplier || null,
      current_stock: Number(part.quantity_in_stock || 0),
    });

    setPartSearch("");
    setMessage(`Part added: ${part.part_name}`);
  }

  function addLabour(hours: number) {
    addLine({
      item_type: "labour",
      description: "Labour charge",
      quantity: hours,
      unit_price: labourRate,
      tax_rate: gstRate,
      included_in_package: false,
      visibility: "customer",
      billing_mode: "billable",
      cost_affects_profit: true,
      included_note: null,
      part_id: null,
      cost_price: 0,
      supplier: null,
      current_stock: null,
    });
  }

  function addManualPart() {
    addLine({
      item_type: "part",
      description: "Manual part / item",
      quantity: 1,
      unit_price: 0,
      tax_rate: gstRate,
      included_in_package: false,
      visibility: "customer",
      billing_mode: "billable",
      cost_affects_profit: true,
      included_note: null,
      part_id: null,
      cost_price: 0,
      supplier: null,
      current_stock: null,
    });
  }

  function addCustomCharge() {
    addLine({
      item_type: "custom",
      description: "Custom charge",
      quantity: 1,
      unit_price: 0,
      tax_rate: gstRate,
      included_in_package: false,
      visibility: "customer",
      billing_mode: "billable",
      cost_affects_profit: true,
      included_note: null,
      part_id: null,
      cost_price: 0,
      supplier: null,
      current_stock: null,
    });
  }

  async function saveInvoice() {
    if (!job) return;

    setSaving(true);
    setMessage("");

    if (lines.length === 0) {
      setMessage("Add at least one invoice line item.");
      setSaving(false);
      return;
    }

    const stockIssue = lines.find((line) => {
      if (!line.part_id) return false;
      return Number(line.quantity || 0) > Number(line.current_stock || 0);
    });

    if (stockIssue) {
      setMessage(
        `Not enough stock for ${stockIssue.description}. Current stock: ${
          stockIssue.current_stock || 0
        }`
      );
      setSaving(false);
      return;
    }

    const amountPaid = paymentStatus === "paid" ? total : 0;
    const balanceDue = total - amountPaid;

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        job_id: job.id,
        customer_id: job.customer_id,
        vehicle_id: job.vehicle_id,
        status,
        invoice_date: new Date().toISOString().split("T")[0],
        due_date: new Date().toISOString().split("T")[0],
        subtotal,
        discount_amount: 0,
        gst_amount: gstAmount,
        total_amount: total,
        amount_paid: amountPaid,
        balance_due: balanceDue,
        notes: notes.trim() || null,
        internal_notes: internalNotes.trim() || null,
        owner_copy_code: `OC-${formatJobNumber(job.job_number)}-${Date.now()}`,
        total_cost: totalCost,
        total_profit: totalProfit,
        profit_margin: profitMargin,
      })
      .select("id, invoice_number")
      .single();

    if (invoiceError || !invoice) {
      setMessage(invoiceError?.message || "Could not save invoice.");
      setSaving(false);
      return;
    }

    const itemPayload = lines.map((line, index) => {
      const lineSellingTotal = Number(line.quantity || 0) * Number(line.unit_price || 0);
      const lineCostTotal =
        line.item_type === "part"
          ? Number(line.quantity || 0) * Number(line.cost_price || 0)
          : 0;
      const lineProfit = lineSellingTotal - lineCostTotal;
      const lineMargin =
        lineSellingTotal > 0 ? (lineProfit / lineSellingTotal) * 100 : 0;

      return {
        invoice_id: invoice.id,
        item_type: line.item_type,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        tax_rate: line.tax_rate,
        included_in_package: line.included_in_package,
        sort_order: index + 1,
        part_id: line.part_id,
        cost_price: line.cost_price,
        profit_amount: lineProfit,
        profit_margin: lineMargin,
        supplier: line.supplier,
        owner_visible: true,
        visibility: line.visibility || "customer",
        billing_mode: line.billing_mode || (line.included_in_package ? "included_in_package" : "billable"),
        cost_affects_profit: line.cost_affects_profit !== false,
        included_note:
          line.included_note ||
          (line.billing_mode === "included_in_package"
            ? "Included in selected service package"
            : line.billing_mode === "internal_cost_only"
              ? "Internal workshop cost only"
              : null),
      };
    });

    const { error: itemsError } = await supabase
      .from("invoice_items")
      .insert(itemPayload);

    if (itemsError) {
      setMessage(itemsError.message);
      setSaving(false);
      return;
    }

    for (const line of lines) {
      if (!line.part_id) continue;

      const oldQuantity = Number(line.current_stock || 0);
      const soldQuantity = Number(line.quantity || 0);
      const newQuantity = oldQuantity - soldQuantity;

      const { error: stockError } = await supabase
        .from("parts")
        .update({
          quantity_in_stock: newQuantity,
        })
        .eq("id", line.part_id);

      if (stockError) {
        setMessage(stockError.message);
        setSaving(false);
        return;
      }

      const { error: movementError } = await supabase
        .from("stock_movements")
        .insert({
          part_id: line.part_id,
          invoice_id: invoice.id,
          movement_type: "invoice_sale",
          quantity: -soldQuantity,
          old_quantity: oldQuantity,
          new_quantity: newQuantity,
          notes: `Customer invoice INV-${String(invoice.invoice_number).padStart(5, "0")} for ${job.customers?.full_name || "customer"}`,
        });

      if (movementError) {
        setMessage(movementError.message);
        setSaving(false);
        return;
      }
    }

    setMessage(
      `Invoice saved successfully: INV-${String(invoice.invoice_number).padStart(5, "0")}. Stock and profit snapshot updated.`
    );

    setSaving(false);
    await loadData();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-6 shadow-sm">
          Loading invoice draft...
        </div>
      </main>
    );
  }

  if (!job) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-6 shadow-sm">
          <p className="font-semibold text-red-600">Job not found.</p>
          {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
          <Link href="/jobs" className="mt-4 inline-block rounded-xl bg-slate-950 px-4 py-2 text-white">
            Back to Jobs
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px]">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-red-600">TW AUTO TUNE</p>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Create Invoice Draft
            </h1>
            <p className="mt-1 text-sm text-slate-600 sm:text-base">
              Generate invoice from {formatJobNumber(job.job_number)} job card.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/jobs/${job.id}`}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Job
            </Link>

            <Link
              href="/jobs"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Jobs
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            {message}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
            <p className="text-sm text-red-300">Job</p>
            <h2 className="mt-2 text-2xl font-bold">
              {formatJobNumber(job.job_number)}
            </h2>
            <div className="mt-4 grid gap-2 text-sm">
              <p>Type: <span className="font-semibold capitalize">{job.job_type}</span></p>
              <p>Odometer: <span className="font-semibold">{job.odometer?.toLocaleString() || "-"} km</span></p>
              <p>
                Next service:{" "}
                <span className="font-semibold">
                  {job.next_service_odometer
                    ? `${job.next_service_odometer.toLocaleString()} km`
                    : "-"}
                  {job.next_service_due_date ? ` / ${job.next_service_due_date}` : ""}
                </span>
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Customer</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              {job.customers?.full_name || "-"}
            </h2>
            <div className="mt-4 grid gap-2 text-sm text-slate-700">
              <p>Phone: {job.customers?.phone || "-"}</p>
              <p>Email: {job.customers?.email || "-"}</p>
              <p>Address: {job.customers?.address || "-"}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Vehicle</p>
            <h2 className="mt-2 text-xl font-bold uppercase text-slate-900">
              {job.vehicles?.registration || "-"}
            </h2>
            <div className="mt-4 grid gap-2 text-sm text-slate-700">
              <p>
                Vehicle: {[job.vehicles?.make, job.vehicles?.model].filter(Boolean).join(" ") || "-"}
              </p>
              <p>Year: {job.vehicles?.year || "-"}</p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">Add Items</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Invoice Builder</h2>

            <div className="mt-5 grid gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Add package
                </label>
                <select
                  value=""
                  onChange={(e) => addPackage(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                >
                  <option value="">
                    {packages.length === 0 ? "No packages found" : "Select package"}
                  </option>
                  {packages.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} - {money(Number(item.base_price))}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Add service</label>
                <select
                  value=""
                  onChange={(e) => addService(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                >
                  <option value="">Select service</option>
                  {services.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} - {money(Number(item.default_price || 0))}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="text-sm font-bold text-slate-900">
                  Search parts from database
                </label>
                <input
                  value={partSearch}
                  onChange={(e) => setPartSearch(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-red-500"
                  placeholder="Type oil filter, brake pads, battery..."
                />

                <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                  {filteredParts.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">
                      No matching parts found.
                    </p>
                  ) : (
                    filteredParts.map((part) => (
                      <button
                        key={part.id}
                        type="button"
                        onClick={() => addPart(part)}
                        className="block w-full border-b border-slate-100 p-3 text-left hover:bg-red-50"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">
                              {part.part_name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {part.part_number || "No part number"} |{" "}
                              {part.category || "Uncategorised"} | Stock:{" "}
                              {part.quantity_in_stock ?? 0}
                            </p>
                            {isOwner && (
                              <p className="mt-1 text-xs text-slate-500">
                                Cost: {money(Number(part.average_cost || part.cost_price || 0))} | Supplier: {part.supplier || "-"}
                              </p>
                            )})}
                          </div>

                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                            {money(Number(part.selling_price || 0))}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-700">Labour</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => addLabour(0.5)} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">
                    + 0.5 hr
                  </button>
                  <button type="button" onClick={() => addLabour(1)} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">
                    + 1 hr
                  </button>
                  <button type="button" onClick={() => addLabour(1.5)} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">
                    + 1.5 hr
                  </button>
                  <button type="button" onClick={() => addLabour(2)} className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200">
                    + 2 hr
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Default labour rate: {money(labourRate)} per hour
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={addManualPart} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-red-600">
                  Add Manual Part
                </button>

                <button type="button" onClick={addCustomCharge} className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-red-600">
                  Add Custom Charge
                </button>
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-red-600">Draft Invoice</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Line Items</h2>
              </div>

              <div className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                {lines.length} items
              </div>
            </div>

            <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Qty / Hours</th>
                    <th className="px-4 py-3">Selling</th>
                    {isOwner && <th className="px-4 py-3">Cost</th>}
                    {isOwner && <th className="px-4 py-3">Profit</th>}
                    {isOwner && <th className="px-4 py-3">Stock</th>}
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                        No invoice items yet.
                      </td>
                    </tr>
                  ) : (
                    lines.map((line) => {
                      const lineTotal = line.quantity * line.unit_price;
                      const lineCost =
                        line.item_type === "part"
                          ? line.quantity * line.cost_price
                          : 0;
                      const lineProfit = lineTotal - lineCost;

                      return (
                        <tr key={line.id} className="border-t border-slate-200">
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-semibold capitalize text-slate-700">
                                {line.item_type}
                              </div>

                              <span
                                className={`rounded-full px-3 py-1 text-xs font-bold ${billingBadgeClass(line.billing_mode || "billable")}`}
                              >
                                {billingBadgeLabel(line.billing_mode || "billable")}
                              </span>
                            </div>

                            <p className="mt-1 text-xs text-slate-500">
                              {billingHelpText(line.billing_mode || "billable")}
                            </p>

                            <select
                              value={line.billing_mode || "billable"}
                              onChange={(e) => {
                                const mode = e.target.value;
                                setLines((prev) =>
                                  prev.map((current) =>
                                    current.id === line.id
                                      ? applyBillingModeToLine(current, mode)
                                      : current
                                  )
                                );
                              }}
                              className="mt-2 w-52 rounded-lg border border-slate-300 px-3 py-2 text-xs"
                            >
                              <option value="billable">Billable extra</option>
                              <option value="included_in_package">Included in package - show as included</option>
                              <option value="internal_cost_only">Internal owner-only cost</option>
                            </select>
                          </td>

                          <td className="px-4 py-3">
                            <input
                              value={line.description}
                              onChange={(e) => updateLine(line.id, "description", e.target.value)}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2"
                            />
                          </td>

                          <td className="px-4 py-3">
                            <input
                              type="number"
                              step="0.1"
                              value={line.quantity}
                              onChange={(e) => updateLine(line.id, "quantity", e.target.value)}
                              className="w-24 rounded-lg border border-slate-300 px-3 py-2"
                            />
                          </td>

                          <td className="px-4 py-3">
                            <input
                              type="number"
                              step="0.01"
                              value={line.unit_price}
                              onChange={(e) => updateLine(line.id, "unit_price", e.target.value)}
                              disabled={line.billing_mode === "included_in_package" || line.billing_mode === "internal_cost_only"}
                              className="w-28 rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100 disabled:text-slate-500"
                            />
                          </td>

                          {isOwner && ({isOwner && (<td className="px-4 py-3"><input type="number" step="0.01" value={line.cost_price} onChange={(e) => updateLine(line.id, "cost_price", e.target.value)} disabled={line.item_type !== "part"} className="w-28 rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100" /></td>)})}

                          {isOwner && ({isOwner && (<td className="whitespace-nowrap px-4 py-3 font-semibold text-green-700">{money(lineProfit)}</td>)})}

                          {isOwner && ({isOwner && (<td className="whitespace-nowrap px-4 py-3 text-slate-700">{line.part_id ? `${line.current_stock || 0} -> ${Number(line.current_stock || 0) - Number(line.quantity || 0)}` : "-"}</td>)})}

                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => removeLine(line.id)}
                              className="rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-200"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
              <div className="grid gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Customer-visible notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                    placeholder="Invoice notes..."
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Internal notes</label>
                  <textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    className="mt-1 min-h-20 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                    placeholder="Private invoice notes..."
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-slate-950 p-5 text-white">
                <p className="text-sm text-red-300">Invoice Summary</p>

                <div className="mt-4 grid gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Subtotal</span>
                    <span className="font-semibold">{money(subtotal)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-300">GST {gstRate}%</span>
                    <span className="font-semibold">{money(gstAmount)}</span>
                  </div>                  {isOwner && (
                    <>                  {isOwner && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-300">Owner Cost</span>
                        <span className="font-semibold">{money(totalCost)}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-300">Profit</span>
                        <span className="font-semibold text-green-300">{money(totalProfit)}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-slate-300">Margin</span>
                        <span className="font-semibold text-green-300">
                          {profitMargin.toFixed(2)}%
                        </span>
                      </div>
                    </>
                  )}
                    </>
                  )}

                  <div className="border-t border-white/10 pt-3">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>{money(total)}</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-slate-300">Invoice status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white"
                    >
                      <option className="text-slate-900" value="draft">Draft</option>
                      <option className="text-slate-900" value="sent">Sent</option>
                      <option className="text-slate-900" value="paid">Paid</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm text-slate-300">Payment</label>
                    <select
                      value={paymentStatus}
                      onChange={(e) => setPaymentStatus(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white"
                    >
                      <option className="text-slate-900" value="unpaid">Unpaid</option>
                      <option className="text-slate-900" value="paid">Paid</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={saveInvoice}
                    disabled={saving}
                    className="mt-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save Invoice Draft"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

















