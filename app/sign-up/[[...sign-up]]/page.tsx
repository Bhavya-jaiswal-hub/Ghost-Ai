import { SignUp } from "@clerk/nextjs"

import { AuthShell } from "@/components/auth/auth-shell"
import { authenticatedRedirectUrl, signInUrl, signUpUrl } from "@/lib/auth-routes"
import { clerkAppearance } from "@/lib/clerk-appearance"

export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUp
        appearance={clerkAppearance}
        fallbackRedirectUrl={authenticatedRedirectUrl}
        path={signUpUrl}
        routing="path"
        signInUrl={signInUrl}
      />
    </AuthShell>
  )
}
