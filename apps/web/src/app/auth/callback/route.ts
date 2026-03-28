import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Redirect to home — it will check onboarding status and route accordingly
      return NextResponse.redirect(`${origin}/`)
    }
  }

  // Return the user to login with an error
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
