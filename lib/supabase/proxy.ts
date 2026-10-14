import { createServerClient } from '@supabase/ssr'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './database.types'
import { getSupabaseConfig } from './env'

const LOGIN_PATH = '/login'
/** Pages for signed-out visitors only: a signed-in user is sent to the app instead. */
const GUEST_PATHS = [LOGIN_PATH, '/forgot-password']
/**
 * Reachable in either state: /auth/confirm is where the emailed reset link lands, and
 * /api/reminders/run is called by the database's cron job (it checks its own secret).
 */
const OPEN_PATHS = ['/auth/confirm', '/api/reminders/run']

/**
 * Refreshes the Supabase session cookie on every request and gates the app:
 * signed-out visitors are sent to /login, signed-in users skip it.
 * There is no sign-up route — accounts are created in the Supabase dashboard.
 */
export async function updateSession(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const isGuestPage = GUEST_PATHS.includes(pathname)
  const isPublic = isGuestPage || OPEN_PATHS.includes(pathname)
  const config = getSupabaseConfig()

  // When the redirect in a reset email is not in Supabase's allow-list (or the template still has
  // the default link), the visitor lands on the Site URL with the result in the query string.
  // Forward it to where it is handled instead of dropping them on the login page.
  if (pathname === '/' || pathname === LOGIN_PATH) {
    const code = request.nextUrl.searchParams.get('code')
    if (code) {
      const url = new URL('/auth/confirm', request.url)
      url.searchParams.set('code', code)
      return NextResponse.redirect(url)
    }
    if (request.nextUrl.searchParams.has('error_code')) return redirectTo(request, '/forgot-password?error=expired')
  }

  if (!config) {
    // Without configuration nobody can sign in; the login page explains what is missing.
    return isPublic ? NextResponse.next() : redirectTo(request, LOGIN_PATH)
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
  let signedIn = Boolean(data?.claims?.sub)

  // A token can outlive its session (revoked by a password change on another device). getSession()
  // rejects such a session and sends the visitor to /login, so confirm with Supabase here too:
  // otherwise this proxy would send them straight back and the two would redirect forever.
  // 'local' scope: clear only this browser's cookies, never revoke the user's other sessions.
  if (signedIn && isGuestPage) {
    const { error } = await supabase.auth.getUser()
    if (error && !isAuthRetryableFetchError(error)) {
      await supabase.auth.signOut({ scope: 'local' })
      signedIn = false
    }
  }

  if (!signedIn && !isPublic) {
    // Keep deep links such as /?add=expense (app-icon shortcuts) across the login round trip.
    const next = pathname === '/' && !search ? '' : `?next=${encodeURIComponent(pathname + search)}`
    return withCookies(redirectTo(request, `${LOGIN_PATH}${next}`), response)
  }
  if (signedIn && isGuestPage) {
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
