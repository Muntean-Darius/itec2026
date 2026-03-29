import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const errorParam = searchParams.get("error")
  const errorDescription = searchParams.get("error_description")

  // Supabase may redirect back with an error (e.g. user denied, invalid redirect URL)
  if (errorParam) {
    console.error("[auth/callback] OAuth error from provider:", errorParam, errorDescription)
    const msg = encodeURIComponent(errorDescription || errorParam)
    return NextResponse.redirect(`${origin}/login?error=${msg}`)
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}/`)
    }
    console.error("[auth/callback] Code exchange failed:", error.message)
    const msg = encodeURIComponent(error.message)
    return NextResponse.redirect(`${origin}/login?error=${msg}`)
  }

  console.error("[auth/callback] No code or error parameter in callback URL")
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
