import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  let supabaseResponse = NextResponse.next({
    request,
  })

  const redirectWithSupabaseCookies = (url: URL) => {
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
      redirectResponse.cookies.set(name, value, options)
    })
    return redirectResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Let auth routes (especially /auth/callback) handle their own session exchange.
  // Running getUser() here can interfere with OAuth callback state/cookies.
  if (pathname.startsWith("/auth")) {
    return supabaseResponse
  }

  // Refresh the session — important for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Public routes that don't require auth
  const isPublicRoute = pathname.startsWith("/login")

  // Redirect unauthenticated users to login (except for public routes)
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return redirectWithSupabaseCookies(url)
  }

  // Redirect authenticated users away from login
  if (user && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return redirectWithSupabaseCookies(url)
  }

  return supabaseResponse
}
