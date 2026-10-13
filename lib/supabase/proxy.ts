import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './database.types'
import { getSupabaseConfig } from './env'

const LOGIN_PATH = '/login'

/**
 * Refreshes the Supabase session cookie on every request and gates the app:
 * signed-out visitors are sent to /login, signed-in users skip it.
 * There is no sign-up route — accounts are created in the Supabase dashboard.
 */
export async function updateSession(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const isLoginPage = pathname === LOGIN_PATH
  const config = getSupabaseConfig()

  if (!config) {
    // Without configuration nobody can sign in; the login page explains what is missing.
    return isLoginPage ? NextResponse.next() : redirectTo(request, LOGIN_PATH)
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(config.url, config.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options)
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value)
      },
    },
  })

  // Do not run code between createServerClient and getClaims(): getClaims()
  // validates the JWT and refreshes an expired session.
  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims?.sub)

  if (!signedIn && !isLoginPage) {
    const next = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`
    return withCookies(redirectTo(request, `${LOGIN_PATH}${next}`), response)
  }
  if (signedIn && isLoginPage) {
    return withCookies(redirectTo(request, '/'), response)
  }
  return response
}

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url))
}

/** Carries refreshed auth cookies (and their no-cache headers) over to a redirect response. */
function withCookies(target: NextResponse, source: NextResponse) {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie)
  for (const header of ['cache-control', 'expires', 'pragma']) {
    const value = source.headers.get(header)
    if (value) target.headers.set(header, value)
  }
  return target
}
