"use client";

export default function PublicPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
    >
      Print / Save PDF
    </button>
  );
}
