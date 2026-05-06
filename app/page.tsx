import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"

import { authenticatedRedirectUrl, signInUrl } from "@/lib/auth-routes"

export default async function Home() {
  const { isAuthenticated } = await auth()

  if (isAuthenticated) {
    redirect(authenticatedRedirectUrl)
  }

  redirect(signInUrl)
}
