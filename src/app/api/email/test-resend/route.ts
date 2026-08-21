import { NextResponse } from "next/server";
import { requireApiOwner } from "@/lib/auth/server";
import { fromEmail, resend } from "@/lib/email/resend";

export async function GET() {
  try {
    const auth = await requireApiOwner();

    if (auth.response) {
      return auth.response;
    }

    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { ok: false, error: "Test email endpoint is disabled in production." },
        { status: 403 }
      );
    }

    const to = "admintwautotune@gmail.com";

    const result = await resend.emails.send({
      from: fromEmail(),
      to,
      subject: "TW AUTO TUNE Resend Test",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>TW AUTO TUNE</h2>
          <p>This is a direct Resend test email from the TW AUTO TUNE system.</p>
          <p>If you received this, Resend and the API key are working.</p>
        </div>
      `,
    });

    if (result.error) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      messageId: result.data?.id,
      to,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Unknown test email error.",
      },
      { status: 500 }
    );
  }
}
