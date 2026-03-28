import { redirect } from "next/navigation"
import { getAuthUser } from "@/data/queries"
import { SettingsForm } from "./settings-form"

export default async function SettingsPage() {
  const user = await getAuthUser()
  if (!user) redirect("/login")

  return (
    <SettingsForm
      initialName={user.name}
      initialEmail={user.email}
    />
  )
}
