import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import {
  checkLoginRateLimit,
  clearLoginRateLimit,
  getLoginRateLimitConfig,
  recordLoginFailure,
} from '@/lib/login-rate-limit';

function normalizeEmail(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwardedFor || request.headers.get('x-real-ip') || 'unknown';
}

function buildRateLimitKey(request: NextRequest, email: string) {
  return `${getClientIp(request)}:${email}`;
}

function rateLimitedResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      error: 'rate_limited',
      retryAfterSeconds,
      ...getLoginRateLimitConfig(),
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
      },
    }
  );
}

function getAllowedOrigins(request: NextRequest) {
  return new Set(
    [
      request.nextUrl.origin,
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.NEXT_PUBLIC_SITE_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    ].filter(Boolean)
  );
}

function isAllowedOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  return getAllowedOrigins(request).has(origin);
}

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: 'forbidden_origin' }, { status: 403 });
  }

  let payload: { email?: unknown; password?: unknown };

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const email = normalizeEmail(payload.email);
  const password = typeof payload.password === 'string' ? payload.password : '';

  if (!email || !password) {
    return NextResponse.json({ error: 'missing_credentials' }, { status: 400 });
  }

  const limitKey = buildRateLimitKey(request, email);
  const limit = checkLoginRateLimit(limitKey);

  if (limit.allowed === false) {
    return rateLimitedResponse(limit.retryAfterSeconds);
  }

  const response = NextResponse.json({ ok: true });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value;
        },
        set(name, value, options) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const failure = recordLoginFailure(limitKey);

    if (failure.allowed === false) {
      return rateLimitedResponse(failure.retryAfterSeconds);
    }

    return NextResponse.json({ error: error.message || 'login_failed' }, { status: 401 });
  }

  clearLoginRateLimit(limitKey);
  return response;
}
