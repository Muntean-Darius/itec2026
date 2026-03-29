import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { NextResponse } from "next/server"

export async function createClient(response?: NextResponse) {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch (error) {
            // Expected in Server Components (read-only); route handlers can pass a
            // response so auth cookies are still attached to the outgoing response.
            if (!response) {
              console.warn("[supabase/server] setAll failed:", error)
            }
          }

          if (response) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            )
          }
        },
      },
    }
  )
}
