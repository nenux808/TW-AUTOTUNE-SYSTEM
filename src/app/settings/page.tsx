"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type WorkshopSettings = {
  id: string;
  business_name: string;
  business_tagline: string | null;
  abn: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  phone: string | null;
  email: string | null;
  default_labour_rate: number;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_bsb: string | null;
  bank_account_number: string | null;
  invoice_footer_note: string | null;
};

function money(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(value || 0);
}

export default function WorkshopSettingsPage() {
  const supabase = createClient();

  const [settingsId, setSettingsId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [form, setForm] = useState({
    business_name: "TW AUTO TUNE",
    business_tagline: "AUTOMOTIVE SERVICE & REPAIR",
    abn: "",
    address_line_1: "Unit 2/119 Box St",
    address_line_2: "Dandenong South VIC",
    phone: "0403 965 946",
    email: "",
    default_labour_rate: "100",
    bank_name: "",
    bank_account_name: "TW AUTO TUNE",
    bank_bsb: "",
    bank_account_number: "",
    invoice_footer_note: "Thank you for choosing TW AUTO TUNE.",
  });

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function loadSettings() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("workshop_settings")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const settings = data as WorkshopSettings;

    setSettingsId(settings.id);

    setForm({
      business_name: settings.business_name || "TW AUTO TUNE",
      business_tagline: settings.business_tagline || "AUTOMOTIVE SERVICE & REPAIR",
      abn: settings.abn || "",
      address_line_1: settings.address_line_1 || "",
      address_line_2: settings.address_line_2 || "",
      phone: settings.phone || "",
      email: settings.email || "",
      default_labour_rate: String(settings.default_labour_rate || 100),
      bank_name: settings.bank_name || "",
      bank_account_name: settings.bank_account_name || "TW AUTO TUNE",
      bank_bsb: settings.bank_bsb || "",
      bank_account_number: settings.bank_account_number || "",
      invoice_footer_note: settings.invoice_footer_note || "",
    });

    setLoading(false);
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();

    setSaving(true);
    setMessage("");

    if (!form.business_name.trim()) {
      setMessage("Business name is required.");
      setSaving(false);
      return;
    }

    if (Number(form.default_labour_rate || 0) <= 0) {
      setMessage("Default labour rate must be greater than 0.");
      setSaving(false);
      return;
    }

    const payload = {
      business_name: form.business_name.trim(),
      business_tagline: form.business_tagline.trim() || null,
      abn: form.abn.trim() || null,
      address_line_1: form.address_line_1.trim() || null,
      address_line_2: form.address_line_2.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      default_labour_rate: Number(form.default_labour_rate || 100),
      bank_name: form.bank_name.trim() || null,
      bank_account_name: form.bank_account_name.trim() || null,
      bank_bsb: form.bank_bsb.trim() || null,
      bank_account_number: form.bank_account_number.trim() || null,
      invoice_footer_note: form.invoice_footer_note.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (settingsId) {
      const { error } = await supabase
        .from("workshop_settings")
        .update(payload)
        .eq("id", settingsId);

      if (error) {
        setMessage(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from("workshop_settings").insert(payload);

      if (error) {
        setMessage(error.message);
        setSaving(false);
        return;
      }
    }

    setMessage("Workshop settings saved successfully.");
    await loadSettings();
    setSaving(false);
  }

  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1300px]">
        <div className="mb-6 flex flex-col gap-4 rounded-2xl bg-slate-950 p-6 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-red-300">TW AUTO TUNE</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              Workshop Settings
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Manage business details, bank details, labour rate and invoice footer.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard"
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20"
            >
              Dashboard
            </Link>

            <Link
              href="/owner/reports"
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
            >
              Owner Reports
            </Link>
          </div>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
            {message}
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            Loading workshop settings...
          </div>
        ) : (
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
            <form onSubmit={saveSettings} className="rounded-2xl bg-white p-6 shadow-sm">
              <div>
                <p className="text-sm font-medium text-red-600">Editable Settings</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Business & Invoice Details
                </h2>
              </div>

              <div className="mt-6 grid gap-6">
                <div className="rounded-2xl border border-slate-200 p-5">
                  <p className="font-bold text-slate-900">Business Details</p>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Business name *</label>
                      <input
                        value={form.business_name}
                        onChange={(e) => updateField("business_name", e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700">Tagline</label>
                      <input
                        value={form.business_tagline}
                        onChange={(e) => updateField("business_tagline", e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700">ABN</label>
                      <input
                        value={form.abn}
                        onChange={(e) => updateField("abn", e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                        placeholder="ABN"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700">Phone</label>
                      <input
                        value={form.phone}
                        onChange={(e) => updateField("phone", e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700">Email</label>
                      <input
                        value={form.email}
                        onChange={(e) => updateField("email", e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                        placeholder="info@example.com"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700">Default labour rate</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.default_labour_rate}
                        onChange={(e) => updateField("default_labour_rate", e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700">Address line 1</label>
                      <input
                        value={form.address_line_1}
                        onChange={(e) => updateField("address_line_1", e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700">Address line 2</label>
                      <input
                        value={form.address_line_2}
                        onChange={(e) => updateField("address_line_2", e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-5">
                  <p className="font-bold text-slate-900">Bank Details</p>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-slate-700">Bank name</label>
                      <input
                        value={form.bank_name}
                        onChange={(e) => updateField("bank_name", e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                        placeholder="Example: Commonwealth Bank"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700">Account name</label>
                      <input
                        value={form.bank_account_name}
                        onChange={(e) => updateField("bank_account_name", e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700">BSB</label>
                      <input
                        value={form.bank_bsb}
                        onChange={(e) => updateField("bank_bsb", e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                        placeholder="000-000"
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium text-slate-700">Account number</label>
                      <input
                        value={form.bank_account_number}
                        onChange={(e) => updateField("bank_account_number", e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                        placeholder="000000000"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-5">
                  <p className="font-bold text-slate-900">Invoice Footer</p>

                  <textarea
                    value={form.invoice_footer_note}
                    onChange={(e) => updateField("invoice_footer_note", e.target.value)}
                    className="mt-4 min-h-24 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-red-500"
                    placeholder="Footer note shown on invoices"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-fit rounded-xl bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </form>

            <aside className="grid gap-6">
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-red-600">Preview</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Invoice Header Preview
                </h2>

                <div className="mt-5 rounded-2xl border border-slate-200 p-5 text-sm text-slate-700">
                  <p className="text-center text-2xl font-bold text-slate-900">
                    {form.business_name || "TW AUTO TUNE"}
                  </p>
                  <p className="text-center text-xs font-semibold uppercase text-slate-500">
                    {form.business_tagline || "AUTOMOTIVE SERVICE & REPAIR"}
                  </p>

                  <div className="mt-5 grid gap-1">
                    <p>{form.address_line_1 || "-"}</p>
                    <p>{form.address_line_2 || "-"}</p>
                    <p>Phone: {form.phone || "-"}</p>
                    <p>Email: {form.email || "-"}</p>
                    <p>ABN: {form.abn || "To be added"}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-red-600">Bank Preview</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Direct Deposit
                </h2>

                <div className="mt-5 grid gap-2 rounded-2xl bg-slate-50 p-5 text-sm text-slate-700">
                  <p>Bank: {form.bank_name || "To be added"}</p>
                  <p>Account Name: {form.bank_account_name || "-"}</p>
                  <p>BSB: {form.bank_bsb || "000-000"}</p>
                  <p>Account No: {form.bank_account_number || "000000000"}</p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-950 p-6 text-white shadow-sm">
                <p className="text-sm text-red-300">Labour Rate</p>
                <p className="mt-2 text-3xl font-bold">
                  {money(Number(form.default_labour_rate || 0))}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  This can be connected to invoice labour line defaults later.
                </p>
              </div>
            </aside>
          </section>
        )}
      </div>
    </main>
  );
}
