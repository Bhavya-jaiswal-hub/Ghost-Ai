import { SignIn } from "@clerk/nextjs"

import { AuthShell } from "@/components/auth/auth-shell"
import { authenticatedRedirectUrl, signInUrl, signUpUrl } from "@/lib/auth-routes"
import { clerkAppearance } from "@/lib/clerk-appearance"

export default function SignInPage() {
  return (
    <AuthShell>
      <SignIn
        appearance={clerkAppearance}
        fallbackRedirectUrl={authenticatedRedirectUrl}
        path={signInUrl}
        routing="path"
        signUpUrl={signUpUrl}
      />
    </AuthShell>
  )
}
