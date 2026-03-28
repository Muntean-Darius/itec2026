import { redirect } from "next/navigation"
import { getAuthUser } from "@/data/queries"
import { OnboardingForm } from "./onboarding-form"

export default async function OnboardingPage() {
  const user = await getAuthUser()
  if (!user) redirect("/login")
  if (user.onboardingComplete) redirect("/dashboard")

  return <OnboardingForm email={user.email} />
}
