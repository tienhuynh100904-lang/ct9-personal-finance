import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    // Everything except static assets, image optimization, metadata files and the offline page
    // (it holds no data and must load for the service worker even when signed out).
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|offline-db.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
