"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Part = {
  id: string;
  part_name: string;
  part_number: string | null;
  category: string | null;
  supplier: string | null;
  cost_price: number | null;
  selling_price: number;
  quantity_in_stock: number | null;
  reorder_level: number | null;
  location: string | null;
  active: boolean;
  item_type: string | null;
  track_stock: boolean | null;
  expense_category: string | null;
  customer_billable: boolean | null;
};

const itemTypes = [
  { value: "part", label: "Sellable Part" },
  { value: "consumable", label: "Workshop Consumable" },
  { value: "fluid", label: "Fluid / Bulk" },
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

function itemTypeLabel(type?: string | null) {
  return itemTypes.find((item) => item.value === type)?.label || "Sellable Part";
}

function itemBadgeClass(type?: string | null) {
  switch (type) {
    case "part":
      return "bg-green-100 text-green-700";
    case "fluid":
      return "bg-blue-100 text-blue-700";
    case "consumable":
      return "bg-yellow-100 text-yellow-700";
    case "tool":
      return "bg-purple-100 text-purple-700";
    case "expense":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function defaultExpenseCategory(type: string) {
  if (type === "part") return "Parts Purchase";
  if (type === "consumable") return "Workshop Consumables";
  if (type === "fluid") return "Fluids / Oils";
  if (type === "tool") return "Tools & Equipment";
  return "Other";
}

export default function InventoryPage() {
  const supabase = createClient();

  const [parts, setParts] = useState<Part[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    part_name: "",
    part_number: "",
    category: "",
    supplier: "",
    cost_price: "",
    selling_price: "",
    quantity_in_stock: "",
    reorder_level: "",
    location: "",
    item_type: "part",
    expense_category: "Parts Purchase",
    track_stock: true,
    customer_billable: true,
  });

  const filteredParts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return parts.filter((part) => {
      const type = part.item_type || "part";

      const matchesType = typeFilter === "all" || type === typeFilter;

      const searchable = [
        part.part_name,
        part.part_number,
        part.category,
        part.supplier,
        part.item_type,
        part.expense_category,
        part.location,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchable.includes(query);

      return matchesType && matchesSearch;
    });
  }, [parts, search, typeFilter]);

  const stats = useMemo(() => {
    const activeItems = parts.filter((part) => part.active);

    const billableParts = activeItems.filter((part) => {
      const type = part.item_type || "part";
      return part.customer_billable !== false && (type === "part" || type === "fluid");
    });

    const consumables = activeItems.filter((part) => part.item_type === "consumable");
    const tools = activeItems.filter((part) => part.item_type === "tool");

    const lowStock = activeItems.filter((part) => {
      if (part.track_stock === false) return false;

      const qty = Number(part.quantity_in_stock || 0);
      const reorder = Number(part.reorder_level || 0);
      return reorder > 0 && qty <= reorder;
    }).length;

    const stockCostValue = activeItems
      .filter((part) => part.track_stock !== false)
      .reduce((sum, part) => {
        return sum + Number(part.cost_price || 0) * Number(part.quantity_in_stock || 0);
      }, 0);

    const sellingValue = billableParts.reduce((sum, part) => {
      return sum + Number(part.selling_price || 0) * Number(part.quantity_in_stock || 0);
    }, 0);

    const potentialProfit = billableParts.reduce((sum, part) => {
      const qty = Number(part.quantity_in_stock || 0);
      const profitPerUnit = Number(part.selling_price || 0) - Number(part.cost_price || 0);
      return sum + profitPerUnit * qty;
    }, 0);

    const consumableValue = consumables.reduce((sum, part) => {
      return sum + Number(part.cost_price || 0) * Number(part.quantity_in_stock || 0);
    }, 0);

    const toolValue = tools.reduce((sum, part) => {
      return sum + Number(part.cost_price || 0) * Number(part.quantity_in_stock || 0);
    }, 0);

    return {
      totalItems: activeItems.length,
      billableCount: billableParts.length,
      consumableCount: consumables.length,
      lowStock,
      stockCostValue,
      sellingValue,
      potentialProfit,
      consumableValue,
      toolValue,
    };
  }, [parts]);

  function updateField(field: string, value: string | boolean) {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };

      if (field === "item_type") {
        const type = String(value);
        updated.expense_category = defaultExpenseCategory(type);
        updated.track_stock = type !== "expense";
        updated.customer_billable = type === "part" || type === "fluid";
        if (type === "consumable" || type === "tool" || type === "expense") {
          updated.selling_price = "0";
        }
      }

      return updated;
    });
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      part_name: "",
      part_number: "",
      category: "",
      supplier: "",
      cost_price: "",
      selling_price: "",
      quantity_in_stock: "",
      reorder_level: "",
      location: "",
      item_type: "part",
      expense_category: "Parts Purchase",
      track_stock: true,
      customer_billable: true,
    });
  }

  function startEdit(part: Part) {
    const type = part.item_type || "part";

    setEditingId(part.id);
    setForm({
      part_name: part.part_name || "",
      part_number: part.part_number || "",
      category: part.category || "",
      supplier: part.supplier || "",
      cost_price: String(part.cost_price ?? ""),
      selling_price: String(part.selling_price ?? ""),
      quantity_in_stock: String(part.quantity_in_stock ?? ""),
      reorder_level: String(part.reorder_level ?? ""),
      location: part.location || "",
      item_type: type,
      expense_category: part.expense_category || defaultExpenseCategory(type),
      track_stock: part.track_stock !== false,
      customer_billable: part.customer_billable !== false,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function loadParts() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("parts")
      .select("*")
      .eq("active", true)
      .order("part_name", { ascending: true });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    setParts((data || []) as Part[]);
    setLoading(false);
  }

  async function savePart(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!form.part_name.trim()) {
      setMessage("Item name is required.");
      return;
    }

    const itemType = form.item_type || "part";
    const isBillable = form.customer_billable;

    if (isBillable && !form.selling_price.trim()) {
      setMessage("Selling price is required for customer billable items.");
      return;
    }

    const payload = {
      part_name: form.part_name.trim(),
      part_number: form.part_number.trim() || null,
      category: form.category.trim() || null,
      supplier: form.supplier.trim() || null,
      cost_price: form.cost_price ? Number(form.cost_price) : 0,
      selling_price: isBillable && form.selling_price ? Number(form.selling_price) : 0,
      quantity_in_stock: form.track_stock && form.quantity_in_stock ? Number(form.quantity_in_stock) : 0,
      reorder_level: form.track_stock && form.reorder_level ? Number(form.reorder_level) : 0,
      location: form.location.trim() || null,
      item_type: itemType,
      expense_category: form.expense_category || defaultExpenseCategory(itemType),
      track_stock: form.track_stock,
      customer_billable: form.customer_billable,
      active: true,
    };

    if (editingId) {
      const { error } = await supabase.from("parts").update(payload).eq("id", editingId);

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage("Inventory item updated.");
      resetForm();
      loadParts();
      return;
    }

    const { error } = await supabase.from("parts").insert(payload);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Inventory item added.");
    resetForm();
    loadParts();
  }

  async function deactivatePart(id: string) {
    const confirmed = window.confirm(
      "Are you sure you want to deactivate this inventory item? Old records will stay safe."
    );

    if (!confirmed) return;

    const { error } = await supabase.from("parts").update({ active: false }).eq("id", id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Inventory item deactivated.");
    loadParts();
  }

  useEffect(() => {
    loadParts();
  }, []);

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1500px]">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-red-600">TW AUTO TUNE</p>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Inventory</h1>
            <p className="mt-1 text-sm text-slate-600 sm:text-base">
              Manage sellable parts, consumables, tools, stock value and shop expense items.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/inventory/purchases/new" className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
              Add Bought Invoice
            </Link>

            <Link href="/inventory/purchases" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Purchase History
            </Link>

            <Link href="/inventory/suppliers" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Suppliers
            </Link>

            <Link href="/dashboard" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Dashboard
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl bg-slate-950 p-5 text-white shadow-sm">
            <p className="text-sm text-red-300">Inventory Items</p>
            <p className="mt-2 text-3xl font-bold">{stats.totalItems}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-red-600">Billable Parts</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.billableCount}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-red-600">Consumables</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{stats.consumableCount}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-red-600">Low Stock</p>
            <p className="mt-2 text-3xl font-bold text-red-700">{stats.lowStock}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-red-600">Stock Cost Value</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{money(stats.stockCostValue)}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-red-600">Billable Profit</p>
            <p className="mt-2 text-2xl font-bold text-green-700">{money(stats.potentialProfit)}</p>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <form onSubmit={savePart} className="rounded-2xl bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-red-600">{editingId ? "Edit Item" : "New Item"}</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {editingId ? "Update inventory item" : "Add inventory item"}
            </h2>

            <div className="mt-5 grid gap-4">
              <input
                value={form.part_name}
                onChange={(e) => updateField("part_name", e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                placeholder="Item name *"
              />

              <input
                value={form.part_number}
                onChange={(e) => updateField("part_number", e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                placeholder="Part number / SKU"
              />

              <div>
                <label className="text-sm font-medium text-slate-700">Item type</label>
                <select
                  value={form.item_type}
                  onChange={(e) => updateField("item_type", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                >
                  {itemTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Expense category</label>
                <select
                  value={form.expense_category}
                  onChange={(e) => updateField("expense_category", e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                >
                  {expenseCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <input
                  value={form.category}
                  onChange={(e) => updateField("category", e.target.value)}
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                  placeholder="Category"
                />

                <input
                  value={form.supplier}
                  onChange={(e) => updateField("supplier", e.target.value)}
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                  placeholder="Supplier"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <input
                  type="number"
                  step="0.01"
                  value={form.cost_price}
                  onChange={(e) => updateField("cost_price", e.target.value)}
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                  placeholder="Cost price"
                />

                <input
                  type="number"
                  step="0.01"
                  value={form.selling_price}
                  onChange={(e) => updateField("selling_price", e.target.value)}
                  disabled={!form.customer_billable}
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500 disabled:bg-slate-100"
                  placeholder="Selling price"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <input
                  type="number"
                  value={form.quantity_in_stock}
                  onChange={(e) => updateField("quantity_in_stock", e.target.value)}
                  disabled={!form.track_stock}
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500 disabled:bg-slate-100"
                  placeholder="Quantity in stock"
                />

                <input
                  type="number"
                  value={form.reorder_level}
                  onChange={(e) => updateField("reorder_level", e.target.value)}
                  disabled={!form.track_stock}
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500 disabled:bg-slate-100"
                  placeholder="Reorder level"
                />
              </div>

              <input
                value={form.location}
                onChange={(e) => updateField("location", e.target.value)}
                className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                placeholder="Shelf / location"
              />

              <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.track_stock}
                    onChange={(e) => updateField("track_stock", e.target.checked)}
                    className="h-4 w-4"
                  />
                  Track stock quantity
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.customer_billable}
                    onChange={(e) => updateField("customer_billable", e.target.checked)}
                    className="h-4 w-4"
                  />
                  Can be added to customer invoices
                </label>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Value Preview</p>
                {form.customer_billable ? (
                  <p className="mt-1">
                    Selling price - cost price ={" "}
                    <span className="font-bold text-green-700">
                      {money(Number(form.selling_price || 0) - Number(form.cost_price || 0))}
                    </span>
                  </p>
                ) : (
                  <p className="mt-1 text-slate-600">
                    This item is internal/expense only, so profit is not calculated here.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="submit" className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700">
                  {editingId ? "Update Item" : "Add Item"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>
          </form>

          <div className="min-w-0 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-red-600">Inventory Catalogue</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Stock / Expense Items</h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_210px]">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                  placeholder="Search item, SKU, supplier, category..."
                />

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                >
                  <option value="all">All item types</option>
                  {itemTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[1500px] text-left text-sm">
                <thead className="bg-slate-950 text-white">
                  <tr>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">SKU / Number</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Expense Category</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Reorder</th>
                    <th className="px-4 py-3">Cost</th>
                    <th className="px-4 py-3">Selling</th>
                    <th className="px-4 py-3">Profit</th>
                    <th className="px-4 py-3">Billable</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={14} className="px-4 py-6 text-center text-slate-500">
                        Loading inventory...
                      </td>
                    </tr>
                  ) : filteredParts.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="px-4 py-6 text-center text-slate-500">
                        No inventory items found.
                      </td>
                    </tr>
                  ) : (
                    filteredParts.map((part) => {
                      const type = part.item_type || "part";
                      const trackStock = part.track_stock !== false;
                      const billable = part.customer_billable !== false;
                      const stock = Number(part.quantity_in_stock || 0);
                      const reorder = Number(part.reorder_level || 0);
                      const isLow = trackStock && reorder > 0 && stock <= reorder;
                      const cost = Number(part.cost_price || 0);
                      const selling = billable ? Number(part.selling_price || 0) : 0;
                      const profit = billable ? selling - cost : 0;

                      return (
                        <tr key={part.id} className="border-t border-slate-200">
                          <td className="px-4 py-3 font-semibold text-slate-900">{part.part_name}</td>

                          <td className="px-4 py-3">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${itemBadgeClass(type)}`}>
                              {itemTypeLabel(type)}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-slate-700">{part.part_number || "-"}</td>
                          <td className="px-4 py-3 text-slate-700">{part.category || "-"}</td>
                          <td className="px-4 py-3 text-slate-700">{part.expense_category || "-"}</td>
                          <td className="px-4 py-3 text-slate-700">{part.supplier || "-"}</td>

                          <td className="px-4 py-3">
                            {trackStock ? (
                              <span className={isLow ? "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700" : "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"}>
                                {stock}
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                No stock
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-slate-700">{trackStock ? reorder : "-"}</td>
                          <td className="px-4 py-3 text-slate-700">{money(cost)}</td>
                          <td className="px-4 py-3 text-slate-700">{billable ? money(selling) : "-"}</td>

                          <td className="px-4 py-3 font-semibold">
                            {billable ? (
                              <span className={profit >= 0 ? "text-green-700" : "text-red-700"}>
                                {money(profit)}
                              </span>
                            ) : (
                              <span className="text-slate-400">Internal</span>
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {billable ? (
                              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                                Yes
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                                No
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-slate-700">{part.location || "-"}</td>

                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => startEdit(part)}
                                className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => deactivatePart(part.id)}
                                className="rounded-lg bg-red-100 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-200"
                              >
                                Deactivate
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <p className="mt-4 text-xs text-slate-500">
              Consumables and internal expenses are tracked for owner reporting but are hidden from customer invoices unless marked billable.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
