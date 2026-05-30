"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Supplier = {
  id: string;
  supplier_name: string;
};

type Part = {
  id: string;
  part_name: string;
  part_number: string | null;
  category: string | null;
  supplier: string | null;
  cost_price: number | null;
  selling_price: number;
  quantity_in_stock: number | null;
  average_cost: number | null;
  item_type: string | null;
  track_stock: boolean | null;
  expense_category: string | null;
  customer_billable: boolean | null;
};

type PurchaseLine = {
  id: string;
  part_id: string | null;
  item_type: string;
  part_name: string;
  part_number: string;
  category: string;
  expense_category: string;
  quantity: number;
  unit_cost: number;
  unit_selling_price: number;
  gst_rate: number;
  existing_stock: number;
  average_cost: number;
  track_stock: boolean;
  customer_billable: boolean;
};

const itemTypes = [
  { value: "part", label: "Sellable Part" },
  { value: "consumable", label: "Workshop Consumable" },
  { value: "fluid", label: "Fluid / Bulk Item" },
  { value: "tool", label: "Tool / Equipment" },
  { value: "expense", label: "General Expense" },
];

const expenseCategories = [
  "Parts Purchase",
  "Workshop Consumables",
  "Fluids / Oils",
  "Tools & Equipment",
  "Rent",
  "Utilities",
  "Insurance",
  "Software / Subscriptions",
  "Waste Disposal",
  "Cleaning Supplies",
  "Office / Admin",
  "Repairs & Maintenance",
  "Other",
];

function money(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(value || 0);
}

function todayDate() {
  return new Date().toISOString().split("T")[0];
}

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now() + Math.random());
}

function getDefaultCategory(itemType: string) {
  if (itemType === "part") return "Parts Purchase";
  if (itemType === "consumable") return "Workshop Consumables";
  if (itemType === "fluid") return "Fluids / Oils";
  if (itemType === "tool") return "Tools & Equipment";
  return "Other";
}

function makeLine(part?: Part): PurchaseLine {
  const itemType = part?.item_type || "part";
  const trackStock =
    typeof part?.track_stock === "boolean"
      ? part.track_stock
      : itemType !== "expense";

  const customerBillable =
    typeof part?.customer_billable === "boolean"
      ? part.customer_billable
      : itemType === "part" || itemType === "fluid";

  return {
    id: makeId(),
    part_id: part?.id || null,
    item_type: itemType,
    part_name: part?.part_name || "",
    part_number: part?.part_number || "",
    category: part?.category || "",
    expense_category: part?.expense_category || getDefaultCategory(itemType),
    quantity: 1,
    unit_cost: Number(part?.cost_price || part?.average_cost || 0),
    unit_selling_price: Number(part?.selling_price || 0),
    gst_rate: 10,
    existing_stock: Number(part?.quantity_in_stock || 0),
    average_cost: Number(part?.average_cost || part?.cost_price || 0),
    track_stock: trackStock,
    customer_billable: customerBillable,
  };
}

export default function NewPurchaseInvoicePage() {
  const supabase = createClient();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [partSearch, setPartSearch] = useState("");
  const [lines, setLines] = useState<PurchaseLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    supplier_id: "",
    supplier_invoice_number: "",
    purchase_date: todayDate(),
    payment_status: "paid",
    payment_method: "card",
    notes: "",
  });

  const selectedSupplier = suppliers.find(
    (supplier) => supplier.id === form.supplier_id
  );

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
          part.item_type,
          part.expense_category,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return searchable.includes(query);
      })
      .slice(0, 12);
  }, [parts, partSearch]);

  const subtotal = useMemo(() => {
    return lines.reduce((sum, line) => {
      return sum + Number(line.quantity || 0) * Number(line.unit_cost || 0);
    }, 0);
  }, [lines]);

  const gstAmount = useMemo(() => {
    return lines.reduce((sum, line) => {
      const lineTotal = Number(line.quantity || 0) * Number(line.unit_cost || 0);
      return sum + lineTotal * (Number(line.gst_rate || 0) / 100);
    }, 0);
  }, [lines]);

  const total = subtotal + gstAmount;

  const stockLineCount = lines.filter((line) => line.track_stock).length;
  const expenseLineCount = lines.filter((line) => !line.track_stock || line.item_type === "expense").length;

  function updateForm(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updateLine(
    id: string,
    field: keyof PurchaseLine,
    value: string | number | boolean | null
  ) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.id !== id) return line;

        const updated = {
          ...line,
          [field]:
            field === "quantity" ||
            field === "unit_cost" ||
            field === "unit_selling_price" ||
            field === "gst_rate"
              ? Number(value)
              : value,
        } as PurchaseLine;

        if (field === "item_type") {
          const itemType = String(value);
          updated.expense_category = getDefaultCategory(itemType);
          updated.track_stock = itemType !== "expense";
          updated.customer_billable = itemType === "part" || itemType === "fluid";
          updated.unit_selling_price =
            itemType === "part" || itemType === "fluid"
              ? updated.unit_selling_price
              : 0;
        }

        return updated;
      })
    );
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((line) => line.id !== id));
  }

  function addManualLine(itemType = "part") {
    const line = makeLine();
    line.item_type = itemType;
    line.expense_category = getDefaultCategory(itemType);
    line.track_stock = itemType !== "expense";
    line.customer_billable = itemType === "part" || itemType === "fluid";
    line.unit_selling_price = itemType === "part" || itemType === "fluid" ? line.unit_selling_price : 0;

    setLines((prev) => [...prev, line]);
  }

  function addExistingPart(part: Part) {
    setLines((prev) => [...prev, makeLine(part)]);
    setPartSearch("");
  }

  async function loadData() {
    setLoading(true);
    setMessage("");

    const supplierRes = await supabase
      .from("suppliers")
      .select("id, supplier_name")
      .eq("active", true)
      .order("supplier_name", { ascending: true });

    const partsRes = await supabase
      .from("parts")
      .select("id, part_name, part_number, category, supplier, cost_price, selling_price, quantity_in_stock, average_cost, item_type, track_stock, expense_category, customer_billable")
      .eq("active", true)
      .order("part_name", { ascending: true });

    const errors = [
      supplierRes.error ? `Suppliers: ${supplierRes.error.message}` : "",
      partsRes.error ? `Inventory Items: ${partsRes.error.message}` : "",
    ].filter(Boolean);

    if (errors.length > 0) {
      setMessage(errors.join(" | "));
    }

    setSuppliers((supplierRes.data || []) as Supplier[]);
    setParts((partsRes.data || []) as Part[]);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function savePurchaseInvoice() {
    setSaving(true);
    setMessage("");

    if (!form.supplier_id) {
      setMessage("Supplier is required.");
      setSaving(false);
      return;
    }

    if (!form.supplier_invoice_number.trim()) {
      setMessage("Supplier invoice number is required.");
      setSaving(false);
      return;
    }

    if (lines.length === 0) {
      setMessage("Add at least one item from the supplier invoice.");
      setSaving(false);
      return;
    }

    const invalidLine = lines.find(
      (line) =>
        !line.part_name.trim() ||
        Number(line.quantity) <= 0 ||
        Number(line.unit_cost) < 0
    );

    if (invalidLine) {
      setMessage("Each line needs item name, quantity and unit cost.");
      setSaving(false);
      return;
    }

    const { data: purchaseInvoice, error: invoiceError } = await supabase
      .from("purchase_invoices")
      .insert({
        supplier_id: form.supplier_id,
        supplier_invoice_number: form.supplier_invoice_number.trim(),
        purchase_date: form.purchase_date,
        payment_status: form.payment_status,
        payment_method: form.payment_method || null,
        subtotal,
        gst_amount: gstAmount,
        total_amount: total,
        amount_paid: form.payment_status === "paid" ? total : 0,
        balance_due: form.payment_status === "paid" ? 0 : total,
        notes: form.notes.trim() || null,
      })
      .select("id")
      .single();

    if (invoiceError || !purchaseInvoice) {
      const duplicateText =
        invoiceError?.message?.toLowerCase().includes("duplicate") ||
        invoiceError?.message?.toLowerCase().includes("unique")
          ? "This supplier invoice number already exists for this supplier."
          : invoiceError?.message;

      setMessage(duplicateText || "Could not save purchase invoice.");
      setSaving(false);
      return;
    }

    if (form.payment_status === "paid" && total > 0) {
      await supabase.from("purchase_invoice_payments").insert({
        purchase_invoice_id: purchaseInvoice.id,
        payment_date: form.purchase_date,
        amount: total,
        payment_method: form.payment_method || null,
        reference: form.supplier_invoice_number.trim(),
        notes: "Auto-recorded as paid when bought invoice was created.",
      });
    }

    for (const line of lines) {
      let partId = line.part_id;
      let oldQuantity = Number(line.existing_stock || 0);
      let newQuantity = oldQuantity + Number(line.quantity || 0);
      let newAverageCost = Number(line.unit_cost || 0);

      if (line.track_stock) {
        if (partId) {
          const existingPart = parts.find((part) => part.id === partId);
          oldQuantity = Number(existingPart?.quantity_in_stock || 0);

          const oldAverageCost = Number(
            existingPart?.average_cost ||
              existingPart?.cost_price ||
              line.average_cost ||
              0
          );

          const purchasedQuantity = Number(line.quantity || 0);
          newQuantity = oldQuantity + purchasedQuantity;

          newAverageCost =
            newQuantity > 0
              ? (oldAverageCost * oldQuantity +
                  Number(line.unit_cost || 0) * purchasedQuantity) /
                newQuantity
              : Number(line.unit_cost || 0);

          const { error: updatePartError } = await supabase
            .from("parts")
            .update({
              part_name: line.part_name.trim(),
              part_number: line.part_number.trim() || null,
              category: line.category.trim() || null,
              supplier: selectedSupplier?.supplier_name || null,
              cost_price: Number(line.unit_cost || 0),
              selling_price: Number(line.unit_selling_price || 0),
              quantity_in_stock: newQuantity,
              average_cost: Number(newAverageCost.toFixed(2)),
              item_type: line.item_type,
              track_stock: line.track_stock,
              expense_category: line.expense_category || getDefaultCategory(line.item_type),
              customer_billable: line.customer_billable,
              last_purchase_invoice_id: purchaseInvoice.id,
              last_purchase_date: form.purchase_date,
            })
            .eq("id", partId);

          if (updatePartError) {
            setMessage(updatePartError.message);
            setSaving(false);
            return;
          }
        } else {
          const { data: newPart, error: createPartError } = await supabase
            .from("parts")
            .insert({
              part_name: line.part_name.trim(),
              part_number: line.part_number.trim() || null,
              category: line.category.trim() || null,
              supplier: selectedSupplier?.supplier_name || null,
              cost_price: Number(line.unit_cost || 0),
              selling_price: Number(line.unit_selling_price || 0),
              quantity_in_stock: Number(line.quantity || 0),
              average_cost: Number(line.unit_cost || 0),
              item_type: line.item_type,
              track_stock: line.track_stock,
              expense_category: line.expense_category || getDefaultCategory(line.item_type),
              customer_billable: line.customer_billable,
              last_purchase_invoice_id: purchaseInvoice.id,
              last_purchase_date: form.purchase_date,
              active: true,
            })
            .select("id")
            .single();

          if (createPartError || !newPart) {
            setMessage(createPartError?.message || "Could not create new inventory item.");
            setSaving(false);
            return;
          }

          partId = newPart.id;
          oldQuantity = 0;
          newQuantity = Number(line.quantity || 0);
        }

        const { error: movementError } = await supabase.from("stock_movements").insert({
          part_id: partId,
          purchase_invoice_id: purchaseInvoice.id,
          movement_type: "purchase_stock",
          quantity: Number(line.quantity || 0),
          old_quantity: oldQuantity,
          new_quantity: newQuantity,
          notes: `Supplier invoice ${form.supplier_invoice_number.trim()} from ${
            selectedSupplier?.supplier_name || "supplier"
          }`,
        });

        if (movementError) {
          setMessage(movementError.message);
          setSaving(false);
          return;
        }
      }

      const { error: itemError } = await supabase.from("purchase_invoice_items").insert({
        purchase_invoice_id: purchaseInvoice.id,
        part_id: partId,
        part_name: line.part_name.trim(),
        part_number: line.part_number.trim() || null,
        category: line.category.trim() || null,
        supplier: selectedSupplier?.supplier_name || null,
        quantity: Number(line.quantity || 0),
        unit_cost: Number(line.unit_cost || 0),
        unit_selling_price: Number(line.unit_selling_price || 0),
        gst_rate: Number(line.gst_rate || 0),
        item_type: line.item_type,
        expense_category: line.expense_category || getDefaultCategory(line.item_type),
        track_stock: line.track_stock,
        customer_billable: line.customer_billable,
      });

      if (itemError) {
        setMessage(itemError.message);
        setSaving(false);
        return;
      }

      if (!line.track_stock || line.item_type === "expense" || line.item_type === "tool") {
        const lineSubtotal = Number(line.quantity || 0) * Number(line.unit_cost || 0);
        const lineGst = lineSubtotal * (Number(line.gst_rate || 0) / 100);

        const { error: expenseError } = await supabase.from("shop_expenses").insert({
          supplier_id: form.supplier_id,
          purchase_invoice_id: purchaseInvoice.id,
          expense_date: form.purchase_date,
          expense_category: line.expense_category || getDefaultCategory(line.item_type),
          description: line.part_name.trim(),
          amount: lineSubtotal,
          gst_amount: lineGst,
          total_amount: lineSubtotal + lineGst,
          payment_status: form.payment_status,
          payment_method: form.payment_method || null,
          reference: form.supplier_invoice_number.trim(),
          notes: form.notes.trim() || null,
        });

        if (expenseError) {
          setMessage(expenseError.message);
          setSaving(false);
          return;
        }
      }
    }

    setMessage("Bought invoice saved. Stock and shop expenses updated successfully.");

    setForm({
      supplier_id: "",
      supplier_invoice_number: "",
      purchase_date: todayDate(),
      payment_status: "paid",
      payment_method: "card",
      notes: "",
    });

    setLines([]);
    await loadData();
    setSaving(false);
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px]">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-red-600">Inventory</p>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Add Bought Invoice
            </h1>
            <p className="mt-1 text-sm text-slate-600 sm:text-base">
              Enter parts, consumables, tools and general shop expenses from supplier invoices.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/inventory"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Inventory
            </Link>

            <Link
              href="/inventory/purchases"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Purchase History
            </Link>

            <Link
              href="/inventory/suppliers"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Suppliers
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            {message}
          </div>
        )}

        <section className="grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
          <div className="grid gap-6">
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-red-600">Supplier Invoice</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Invoice Details
              </h2>

              <div className="mt-5 grid gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Supplier *</label>
                  <select
                    value={form.supplier_id}
                    onChange={(e) => updateForm("supplier_id", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                  >
                    <option value="">{loading ? "Loading suppliers..." : "Select supplier"}</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.supplier_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Supplier invoice number *
                  </label>
                  <input
                    value={form.supplier_invoice_number}
                    onChange={(e) => updateForm("supplier_invoice_number", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 uppercase outline-none focus:border-red-500"
                    placeholder="Example: REP-INV-10291"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Required and unique per supplier.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">Purchase date</label>
                  <input
                    type="date"
                    value={form.purchase_date}
                    onChange={(e) => updateForm("purchase_date", e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-slate-700">Payment status</label>
                    <select
                      value={form.payment_status}
                      onChange={(e) => updateForm("payment_status", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                    >
                      <option value="paid">Paid</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="partial">Partial</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">Payment method</label>
                    <select
                      value={form.payment_method}
                      onChange={(e) => updateForm("payment_method", e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                    >
                      <option value="card">Card</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cash">Cash</option>
                      <option value="account">Supplier Account</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <textarea
                  value={form.notes}
                  onChange={(e) => updateForm("notes", e.target.value)}
                  className="min-h-24 rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                  placeholder="Internal notes about this supplier invoice..."
                />
              </div>
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-red-600">Find Existing Inventory</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Search Parts / Consumables
              </h2>

              <input
                value={partSearch}
                onChange={(e) => setPartSearch(e.target.value)}
                className="mt-5 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                placeholder="Search part, gloves, cleaner, SKU, category..."
              />

              <div className="mt-4 max-h-80 overflow-y-auto rounded-xl border border-slate-200">
                {filteredParts.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500">No matching inventory items.</p>
                ) : (
                  filteredParts.map((part) => (
                    <button
                      key={part.id}
                      type="button"
                      onClick={() => addExistingPart(part)}
                      className="block w-full border-b border-slate-100 p-3 text-left hover:bg-red-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{part.part_name}</p>
                          <p className="text-xs text-slate-500">
                            {part.part_number || "No SKU"} | {part.item_type || "part"} | Stock:{" "}
                            {part.quantity_in_stock ?? 0}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {part.expense_category || part.category || "No category"}
                          </p>
                        </div>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                          Cost {money(Number(part.cost_price || 0))}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={() => addManualLine("part")}
                  className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-red-600"
                >
                  Add Sellable Part Line
                </button>

                <button
                  type="button"
                  onClick={() => addManualLine("consumable")}
                  className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                >
                  Add Consumable Line
                </button>

                <button
                  type="button"
                  onClick={() => addManualLine("expense")}
                  className="rounded-xl bg-red-50 px-5 py-3 text-sm font-semibold text-red-700 hover:bg-red-100"
                >
                  Add General Expense Line
                </button>
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-red-600">Purchase Items</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Bought Invoice Lines
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                  {lines.length} lines
                </span>
                <span className="rounded-xl bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">
                  {stockLineCount} stock
                </span>
                <span className="rounded-xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-700">
                  {expenseLineCount} expense
                </span>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[1500px] text-left text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Item Name</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Expense Category</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Unit Cost</th>
                    <th className="px-4 py-3">Selling</th>
                    <th className="px-4 py-3">GST %</th>
                    <th className="px-4 py-3">Track Stock</th>
                    <th className="px-4 py-3">Billable</th>
                    <th className="px-4 py-3">Line Total</th>
                    <th className="px-4 py-3">Stock After</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {lines.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="px-4 py-6 text-center text-slate-500">
                        No purchase items yet. Search an item or add a manual line.
                      </td>
                    </tr>
                  ) : (
                    lines.map((line) => (
                      <tr key={line.id} className="border-t border-slate-200">
                        <td className="px-4 py-3">
                          <select
                            value={line.item_type}
                            onChange={(e) => updateLine(line.id, "item_type", e.target.value)}
                            className="w-40 rounded-lg border border-slate-300 px-3 py-2"
                          >
                            {itemTypes.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="px-4 py-3">
                          <input
                            value={line.part_name}
                            onChange={(e) => updateLine(line.id, "part_name", e.target.value)}
                            className="w-52 rounded-lg border border-slate-300 px-3 py-2"
                            placeholder="Item name"
                          />
                        </td>

                        <td className="px-4 py-3">
                          <input
                            value={line.part_number}
                            onChange={(e) => updateLine(line.id, "part_number", e.target.value)}
                            className="w-36 rounded-lg border border-slate-300 px-3 py-2"
                            placeholder="SKU"
                          />
                        </td>

                        <td className="px-4 py-3">
                          <input
                            value={line.category}
                            onChange={(e) => updateLine(line.id, "category", e.target.value)}
                            className="w-40 rounded-lg border border-slate-300 px-3 py-2"
                            placeholder="Category"
                          />
                        </td>

                        <td className="px-4 py-3">
                          <select
                            value={line.expense_category}
                            onChange={(e) => updateLine(line.id, "expense_category", e.target.value)}
                            className="w-52 rounded-lg border border-slate-300 px-3 py-2"
                          >
                            {expenseCategories.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="1"
                            value={line.quantity}
                            onChange={(e) => updateLine(line.id, "quantity", e.target.value)}
                            className="w-24 rounded-lg border border-slate-300 px-3 py-2"
                          />
                        </td>

                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            value={line.unit_cost}
                            onChange={(e) => updateLine(line.id, "unit_cost", e.target.value)}
                            className="w-28 rounded-lg border border-slate-300 px-3 py-2"
                          />
                        </td>

                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            value={line.unit_selling_price}
                            onChange={(e) => updateLine(line.id, "unit_selling_price", e.target.value)}
                            className="w-28 rounded-lg border border-slate-300 px-3 py-2"
                            disabled={!line.customer_billable}
                          />
                        </td>

                        <td className="px-4 py-3">
                          <input
                            type="number"
                            step="0.01"
                            value={line.gst_rate}
                            onChange={(e) => updateLine(line.id, "gst_rate", e.target.value)}
                            className="w-24 rounded-lg border border-slate-300 px-3 py-2"
                          />
                        </td>

                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={line.track_stock}
                            onChange={(e) => updateLine(line.id, "track_stock", e.target.checked)}
                            className="h-5 w-5"
                          />
                        </td>

                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={line.customer_billable}
                            onChange={(e) => updateLine(line.id, "customer_billable", e.target.checked)}
                            className="h-5 w-5"
                          />
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 font-semibold">
                          {money(Number(line.quantity || 0) * Number(line.unit_cost || 0))}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3">
                          {line.track_stock ? (
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                              {Number(line.existing_stock || 0) + Number(line.quantity || 0)}
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              No stock
                            </span>
                          )}
                        </td>

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
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
              <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-700">
                <p className="font-bold text-slate-900">How this works</p>
                <p className="mt-2">
                  Sellable parts and fluids can be marked customer billable. Consumables like gloves
                  can be stocked but hidden from customer invoices. General expenses are recorded for
                  owner reports without creating stock.
                </p>
                <p className="mt-2">
                  Supplier invoice number stays required and unique per supplier.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-950 p-5 text-white">
                <p className="text-sm text-red-300">Purchase Summary</p>

                <div className="mt-4 grid gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-300">Subtotal</span>
                    <span className="font-semibold">{money(subtotal)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-300">GST</span>
                    <span className="font-semibold">{money(gstAmount)}</span>
                  </div>

                  <div className="border-t border-white/10 pt-3">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total</span>
                      <span>{money(total)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={savePurchaseInvoice}
                    disabled={saving}
                    className="mt-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save Bought Invoice"}
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
