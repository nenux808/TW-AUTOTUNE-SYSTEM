import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fromEmail, resend } from "@/lib/email/resend";

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function reminderType(days: number) {
  return days === 3 ? "service_reminder_3_days" : "service_reminder_1_day";
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const expected = `Bearer ${process.env.CRON_SECRET}`;

    if (!process.env.CRON_SECRET || authHeader !== expected) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const supabase = await createServerSupabaseClient();

    const targetDates = [
      { days: 3, date: addDays(3), type: reminderType(3) },
      { days: 1, date: addDays(1), type: reminderType(1) },
    ];

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const target of targetDates) {
      const { data: jobs, error } = await supabase
        .from("jobs")
        .select(`
          *,
          customers(id, full_name, email, phone),
          vehicles(id, registration, make, model)
        `)
        .eq("next_service_due_date", target.date);

      if (error) {
        errors.push(error.message);
        continue;
      }

      for (const job of jobs || []) {
        const customer = (job as any).customers;
        const vehicle = (job as any).vehicles;
        const customerEmail = customer?.email;

        if (!customerEmail) {
          skipped++;
          continue;
        }

        const duplicate = await supabase
          .from("email_logs")
          .select("id")
          .eq("email_type", target.type)
          .eq("job_id", (job as any).id)
          .eq("recipient_email", customerEmail)
          .maybeSingle();

        if (duplicate.data) {
          skipped++;
          continue;
        }

        const customerName = customer?.full_name || "Customer";
        const vehicleText = `${vehicle?.registration || ""} ${vehicle?.make || ""} ${vehicle?.model || ""}`.trim();

        const subject =
          target.days === 3
            ? `Service reminder: ${vehicleText || "your vehicle"} is due in 3 days`
            : `Service reminder: ${vehicleText || "your vehicle"} is due tomorrow`;

        const html = `
          <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
            <h2>TW AUTO TUNE</h2>
            <p>Hi ${customerName},</p>
            <p>This is a friendly reminder that your vehicle service is coming up.</p>

            <table style="border-collapse: collapse; width: 100%; max-width: 520px;">
              <tr>
                <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Vehicle</strong></td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${vehicleText || "-"}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Service Due Date</strong></td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${target.date}</td>
              </tr>
              <tr>
                <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Due Odometer</strong></td>
                <td style="padding: 8px; border: 1px solid #e5e7eb;">${(job as any).next_service_odometer ? `${(job as any).next_service_odometer} km` : "-"}</td>
              </tr>
            </table>

            <p>Please contact TW AUTO TUNE to book or confirm your service time.</p>
            <p>Phone: 0403 965 946</p>
            <p>Thank you,<br/>TW AUTO TUNE</p>
            <p style="font-size:12px;color:#6b7280;">System by Nenux Web Solutions</p>
          </div>
        `;

        const sendResult = await resend.emails.send({
          from: fromEmail(),
          to: customerEmail,
          subject,
          html,
        });

        await supabase.from("email_logs").insert({
          email_type: target.type,
          recipient_email: customerEmail,
          recipient_name: customerName,
          customer_id: customer?.id || (job as any).customer_id || null,
          vehicle_id: vehicle?.id || (job as any).vehicle_id || null,
          job_id: (job as any).id,
          subject,
          status: sendResult.error ? "failed" : "sent",
          provider_message_id: sendResult.data?.id || null,
          error_message: sendResult.error?.message || null,
          scheduled_for: target.date,
        });

        if (sendResult.error) {
          errors.push(sendResult.error.message);
        } else {
          sent++;
        }
      }
    }

    return NextResponse.json({
      ok: errors.length === 0,
      sent,
      skipped,
      errors,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Service reminder cron failed." },
      { status: 500 }
    );
  }
}
