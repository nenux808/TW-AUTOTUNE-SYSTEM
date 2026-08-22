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

export async function POST(request: Request) {
  try {
    const auth = await requireApiUser(["owner", "mechanic", "front_desk"]);

    if (auth.response) {
      return auth.response;
    }

    const supabase = auth.supabase;
    const { invoiceId } = await request.json();

    if (!invoiceId) {
      return NextResponse.json(
        { error: "invoiceId is required." },
        { status: 400 }
      );
    }

    const clientIp = getClientIp(request);
    const actorId = auth.user?.id || clientIp;

    const userLimit = await checkRateLimit({
      namespace: "send-invoice:user",
      key: actorId,
      limit: 5,
      windowMs: 60 * 1000,
    });

    if (!userLimit.allowed) {
      return NextResponse.json(
        { error: "Too many invoice email requests. Please wait and try again." },
        { status: 429, headers: rateLimitHeaders(userLimit) }
      );
    }

    const invoiceLimit = await checkRateLimit({
      namespace: "send-invoice:invoice",
      key: String(invoiceId),
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });

    if (!invoiceLimit.allowed) {
      return NextResponse.json(
        { error: "This invoice has been emailed too many times recently. Please wait and try again." },
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
      return NextResponse.json(
        { error: error?.message || "Invoice not found." },
        { status: 404 }
      );
    }

    const customerEmail = invoice.customers?.email;

    if (!customerEmail) {
      return NextResponse.json(
        { error: "Customer does not have an email address." },
        { status: 400 }
      );
    }

    const invoiceNumber = formatInvoiceNumber(invoice.invoice_number);

    let publicToken = invoice.public_token;

    if (!publicToken) {
      publicToken = randomUUID();

      const { error: tokenError } = await supabase
        .from("invoices")
        .update({
          public_token: publicToken,
          public_enabled: true,
        })
        .eq("id", invoice.id);

      if (tokenError) {
        return NextResponse.json(
          { error: tokenError.message },
          { status: 500 }
        );
      }
    } else if (!invoice.public_enabled) {
      const { error: enableError } = await supabase
        .from("invoices")
        .update({
          public_enabled: true,
        })
        .eq("id", invoice.id);

      if (enableError) {
        return NextResponse.json(
          { error: enableError.message },
          { status: 500 }
        );
      }
    }

    const invoiceLink = `${appUrl().replace(/\/$/, "")}/invoice-view/${publicToken}`;
    const subject = `${invoiceNumber} - TW AUTO TUNE Invoice`;

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

        <p>Thank you for choosing TW AUTO TUNE.</p>
        <p style="font-size:12px;color:#6b7280;">System by Nenux Web Solutions</p>
      </div>
    `;

    const sendResult = await resend.emails.send({
      from: fromEmail(),
      to: customerEmail,
      subject,
      html,
    });

    const providerId = sendResult.data?.id || null;

    await supabase.from("email_logs").insert({
      email_type: "invoice",
      recipient_email: customerEmail,
      recipient_name: invoice.customers?.full_name || null,
      customer_id: invoice.customers?.id || invoice.customer_id || null,
      vehicle_id: invoice.vehicles?.id || invoice.vehicle_id || null,
      invoice_id: invoice.id,
      subject,
      status: sendResult.error ? "failed" : "sent",
      provider_message_id: providerId,
      error_message: sendResult.error?.message || null,
    });

    if (sendResult.error) {
      return NextResponse.json(
        { error: sendResult.error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, messageId: providerId });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to send invoice email." },
      { status: 500 }
    );
  }
}
