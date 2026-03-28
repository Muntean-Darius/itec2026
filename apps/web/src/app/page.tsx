import { redirect } from "next/navigation"
import { getAuthUser } from "@/data/queries"

export default async function Home() {
  const user = await getAuthUser()

  if (!user) {
    redirect("/login")
  }

  if (!user.onboardingComplete) {
    redirect("/onboarding")
  }

  redirect("/dashboard")
}

