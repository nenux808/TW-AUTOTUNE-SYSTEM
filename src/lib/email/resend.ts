import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

export function fromEmail() {
  return process.env.RESEND_FROM_EMAIL || "TW AUTO TUNE <onboarding@resend.dev>";
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(Number(value || 0));
}

export function formatInvoiceNumber(value: any) {
  if (!value) return "INV";
  const text = String(value);
  if (text.toUpperCase().startsWith("INV-")) return text;
  return `INV-${text.padStart(5, "0")}`;
}
