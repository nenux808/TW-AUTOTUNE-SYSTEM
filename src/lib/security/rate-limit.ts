import "server-only";
import { createHash } from "crypto";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: string;
  retryAfterSeconds: number;
  error?: string;
};

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  namespace?: string;
  /**
   * Keeps the live app working if the Supabase rate-limit table has not been installed yet.
   * Production security depends on running supabase/rate_limit_security.sql.
   */
  failOpen?: boolean;
};

function hashBucketKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function getClientIp(request: Request) {
  return getClientIpFromHeaders(request.headers);
}

export function getClientIpFromHeaders(headers: Headers | Readonly<Headers>) {
  const forwardedFor = headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    headers.get("x-vercel-forwarded-for") ||
    "unknown"
  );
}

export function rateLimitHeaders(result: RateLimitResult) {
  return {
    "X-RateLimit-Remaining": String(Math.max(result.remaining, 0)),
    "X-RateLimit-Reset": result.resetAt,
    "Retry-After": String(Math.max(result.retryAfterSeconds, 0)),
  };
}

export async function checkRateLimit({
  key,
  limit,
  windowMs,
  namespace = "global",
  failOpen = true,
}: RateLimitOptions): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime());
  const resetAt = new Date(now.getTime() + windowMs);
  const bucketKey = hashBucketKey(`${namespace}:${key}`);

  try {
    const supabase = createServiceRoleSupabaseClient();

    const { data: existing, error: readError } = await supabase
      .from("security_rate_limits")
      .select("bucket_key, request_count, window_start, expires_at")
      .eq("bucket_key", bucketKey)
      .maybeSingle();

    if (readError) {
      throw readError;
    }

    const existingExpiry = existing?.expires_at
      ? new Date(existing.expires_at)
      : null;

    if (!existing || !existingExpiry || existingExpiry <= now) {
      const { error: upsertError } = await supabase
        .from("security_rate_limits")
        .upsert({
          bucket_key: bucketKey,
          request_count: 1,
          window_start: windowStart.toISOString(),
          expires_at: resetAt.toISOString(),
          updated_at: now.toISOString(),
        });

      if (upsertError) {
        throw upsertError;
      }

      return {
        allowed: true,
        remaining: Math.max(limit - 1, 0),
        resetAt: resetAt.toISOString(),
        retryAfterSeconds: 0,
      };
    }

    const currentCount = Number(existing.request_count || 0);
    const retryAfterSeconds = Math.max(
      Math.ceil((existingExpiry.getTime() - now.getTime()) / 1000),
      0
    );

    if (currentCount >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: existingExpiry.toISOString(),
        retryAfterSeconds,
      };
    }

    const nextCount = currentCount + 1;

    const { error: updateError } = await supabase
      .from("security_rate_limits")
      .update({
        request_count: nextCount,
        updated_at: now.toISOString(),
      })
      .eq("bucket_key", bucketKey);

    if (updateError) {
      throw updateError;
    }

    return {
      allowed: true,
      remaining: Math.max(limit - nextCount, 0),
      resetAt: existingExpiry.toISOString(),
      retryAfterSeconds: 0,
    };
  } catch (error: any) {
    if (failOpen) {
      return {
        allowed: true,
        remaining: limit,
        resetAt: resetAt.toISOString(),
        retryAfterSeconds: 0,
        error: error?.message || "Rate limit check failed open.",
      };
    }

    return {
      allowed: false,
      remaining: 0,
      resetAt: resetAt.toISOString(),
      retryAfterSeconds: Math.ceil(windowMs / 1000),
      error: error?.message || "Rate limit check failed closed.",
    };
  }
}
