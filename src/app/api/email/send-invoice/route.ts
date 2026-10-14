import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireApiUser } from "@/lib/auth/server";
import {
  appUrl,
  formatInvoiceNumber,
  formatMoney,
  fromEmail,
  resend,
} from "@/lib/email/resend";
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

function safeApiError(message = "Unable to complete this request right now.", status = 500) {
  return NextResponse.json({ error: message }, { status });
}

function safeProviderMessage(error: any) {
  const raw =
    error?.message ||
    error?.name ||
    (typeof error === "string" ? error : "Email provider rejected the message.");

  return String(raw)
    .replace(/re_[A-Za-z0-9_-]+/g, "[hidden-api-key]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [hidden]")
    .slice(0, 240);
}

async function logEmailAttempt({
  supabase,
  invoice,
  customerEmail,
  subject,
  status,
  providerId,
  errorMessage,
}: {
  supabase: any;
  invoice: any;
  customerEmail: string;
  subject: string;
  status: "sent" | "failed";
  providerId: string | null;
  errorMessage: string | null;
}) {
  const { error } = await supabase.from("email_logs").insert({
    email_type: "invoice",
    recipient_email: customerEmail,
    recipient_name: invoice.customers?.full_name || null,
    customer_id: invoice.customers?.id || invoice.customer_id || null,
    vehicle_id: invoice.vehicles?.id || invoice.vehicle_id || null,
    invoice_id: invoice.id,
    subject,
    status,
    provider_message_id: providerId,
    error_message: errorMessage,
  });

  if (error) {
    console.error("Invoice email log insert failed", error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(["owner", "mechanic", "front_desk"]);

    if (auth.response) {
      return auth.response;
    }

    if (!process.env.RESEND_API_KEY) {
      console.error("Invoice email failed: RESEND_API_KEY is missing.");
      return safeApiError("Email is not configured. Missing RESEND_API_KEY in Vercel.", 500);
    }

    const supabase = auth.supabase;
    const { invoiceId } = await request.json();

    if (!invoiceId) {
      return safeApiError("invoiceId is required.", 400);
    }

    const clientIp = getClientIp(request);
    const actorId = auth.user?.id || clientIp;

    // Authenticated staff-only route.
    // Keep sending available if Supabase rate-limit storage/service-role config has a problem,
    // while still enforcing limits whenever the security_rate_limits table is reachable.
    const userLimit = await checkRateLimit({
      namespace: "send-invoice:v4:user",
      key: actorId,
      limit: 120,
      windowMs: 60 * 60 * 1000,
      failOpen: true,
    });

    if (!userLimit.allowed) {
      return NextResponse.json(
        { error: "Too many invoice email requests. Please wait a few minutes and try again." },
        { status: 429, headers: rateLimitHeaders(userLimit) }
      );
    }

    const invoiceLimit = await checkRateLimit({
      namespace: "send-invoice:v4:invoice",
      key: String(invoiceId),
      limit: 30,
      windowMs: 60 * 60 * 1000,
      failOpen: true,
    });

    if (!invoiceLimit.allowed) {
      return NextResponse.json(
        { error: "This invoice was emailed several times recently. Please wait a few minutes before resending." },
        { status: 429, headers: rateLimitHeaders(invoiceLimit) }
      );
    }

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select(`
        *,
        customers(id, full_name, email, phone),
        vehicles(id, registration, make, model)
      `)
      .eq("id", invoiceId)
      .single();

    if (error || !invoice) {
      return safeApiError("Invoice not found.", 404);
    }

    const customerEmail = String(invoice.customers?.email || "").trim();

    if (!customerEmail) {
      return safeApiError("Customer does not have an email address.", 400);
    }

    if (!/^\S+@\S+\.\S+$/.test(customerEmail)) {
      return safeApiError("Customer email address looks invalid. Please update the customer email and try again.", 400);
    }

    const invoiceNumber = formatInvoiceNumber(invoice.invoice_number);
    const publicToken = invoice.public_token || randomUUID();

    const updatePublicLink = await supabase
      .from("invoices")
      .update({
        public_token: publicToken,
        public_enabled: true,
      })
      .eq("id", invoice.id);

    if (updatePublicLink.error) {
      console.error("Public invoice link update failed", updatePublicLink.error);
      return safeApiError("Unable to prepare invoice link.", 500);
    }

    const invoiceLink = `${appUrl().replace(/\/$/, "")}/invoice-view/${publicToken}`;
    const subject = `${invoiceNumber} - TW AUTO TUNE Invoice`;
    const sender = fromEmail();

    const html = `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <h2 style="margin-bottom: 4px;">TW AUTO TUNE</h2>
        <p style="margin-top: 0;">Invoice from TW AUTO TUNE</p>
        <hr />
        <p>Hi ${invoice.customers?.full_name || "Customer"},</p>
        <p>Your invoice is ready. Please click the button below to view the full customer copy invoice and service report.</p>
        <table style="border-collapse: collapse; width: 100%; max-width: 520px;">
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Invoice</strong></td>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Vehicle</strong></td>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">
              ${invoice.vehicles?.registration || "-"} ${invoice.vehicles?.make || ""} ${invoice.vehicles?.model || ""}
            </td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Total</strong></td>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${formatMoney(Number(invoice.total_amount || 0))}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Balance Due</strong></td>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${formatMoney(Number(invoice.balance_due || 0))}</td>
          </tr>
        </table>
        <p style="margin-top: 24px;">
          <a href="${invoiceLink}" style="background:#dc2626;color:white;padding:12px 18px;text-decoration:none;border-radius:10px;font-weight:bold;display:inline-block;">
            View Invoice
          </a>
        </p>
        <p>You can use this link to view your invoice when needed.</p>
        <p>Thank you for choosing TW AUTO TUNE.</p>
        <p style="font-size:12px;color:#6b7280;">System by Nenux Web Solutions</p>
      </div>
    `;

    const text = `TW AUTO TUNE\n\nHi ${invoice.customers?.full_name || "Customer"},\n\nYour invoice ${invoiceNumber} is ready.\nView invoice: ${invoiceLink}\n\nTotal: ${formatMoney(Number(invoice.total_amount || 0))}\nBalance Due: ${formatMoney(Number(invoice.balance_due || 0))}\n\nThank you for choosing TW AUTO TUNE.`;

    const sendResult = await resend.emails.send({
      from: sender,
      to: customerEmail,
      subject,
      html,
      text,
    });

    const providerId = sendResult.data?.id || null;

    if (sendResult.error) {
      const providerMessage = safeProviderMessage(sendResult.error);
      console.error("Invoice email send failed", {
        providerMessage,
        customerEmail,
        invoiceId: invoice.id,
        from: sender,
      });

      await logEmailAttempt({
        supabase,
        invoice,
        customerEmail,
        subject,
        status: "failed",
        providerId,
        errorMessage: providerMessage,
      });

      return safeApiError(`Email provider error: ${providerMessage}`, 502);
    }

    await logEmailAttempt({
      supabase,
      invoice,
      customerEmail,
      subject,
      status: "sent",
      providerId,
      errorMessage: null,
    });

    return NextResponse.json({ ok: true, messageId: providerId });
  } catch (error: any) {
    const message = safeProviderMessage(error);
    console.error("Invoice email route failed", message);
    return safeApiError(`Failed to send invoice email: ${message}`, 500);
  }
}
