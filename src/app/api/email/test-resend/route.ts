import { NextResponse } from "next/server";
import { requireApiOwner } from "@/lib/auth/server";
import { fromEmail, resend } from "@/lib/email/resend";
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
} from "@/lib/security/rate-limit";

export async function GET(request: Request) {
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

    const clientIp = getClientIp(request);
    const actorId = auth.user?.id || clientIp;

    const limit = await checkRateLimit({
      namespace: "test-resend:owner",
      key: actorId,
      limit: 3,
      windowMs: 60 * 60 * 1000,
    });

    if (!limit.allowed) {
      return NextResponse.json(
        { ok: false, error: "Too many test email requests. Please wait and try again." },
        { status: 429, headers: rateLimitHeaders(limit) }
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
