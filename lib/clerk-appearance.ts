import type { ClerkAppearanceTheme } from "@clerk/shared/types"
import { dark } from "@clerk/ui/themes"

export const clerkAppearance: ClerkAppearanceTheme = {
  theme: dark,
  variables: {
    colorBackground: "var(--bg-surface)",
    colorBorder: "var(--border-default)",
    colorDanger: "var(--state-error)",
    colorForeground: "var(--text-primary)",
    colorInput: "var(--bg-subtle)",
    colorInputForeground: "var(--text-primary)",
    colorMuted: "var(--bg-elevated)",
    colorMutedForeground: "var(--text-muted)",
    colorPrimary: "var(--accent-primary)",
    colorPrimaryForeground: "var(--bg-base)",
    colorRing: "var(--accent-primary)",
    colorSuccess: "var(--state-success)",
    colorWarning: "var(--state-warning)",
    fontFamily: "var(--font-geist-sans)",
    fontFamilyButtons: "var(--font-geist-sans)",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: {
      fontFamily: "var(--font-geist-sans)",
      width: "100%",
    },
    cardBox: {
      boxShadow: "none",
      margin: "0 auto",
      width: "min(100%, 30rem)",
    },
    card: {
      backgroundColor: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
    },
    headerTitle: {
      color: "var(--text-primary)",
      fontFamily: "var(--font-geist-sans)",
      fontWeight: "600",
    },
    headerSubtitle: {
      color: "var(--text-muted)",
      fontFamily: "var(--font-geist-sans)",
    },
    footer: {
      backgroundColor: "var(--bg-surface)",
    },
    socialButtonsBlockButton: {
      borderColor: "var(--border-default)",
      color: "var(--text-secondary)",
      fontFamily: "var(--font-geist-sans)",
    },
    formFieldLabel: {
      color: "var(--text-primary)",
      fontFamily: "var(--font-geist-sans)",
      fontWeight: "600",
    },
    formFieldInput: {
      backgroundColor: "var(--bg-subtle)",
      color: "var(--text-primary)",
      fontFamily: "var(--font-geist-sans)",
    },
    formButtonPrimary: {
      boxShadow: "none",
      fontFamily: "var(--font-geist-sans)",
      fontWeight: "600",
    },
  },
}

export const userProfileAppearance: ClerkAppearanceTheme = {
  theme: dark,
  variables: clerkAppearance.variables,
  elements: {
    rootBox: {
      width: "auto",
    },
    modalContent: {
      width: "min(calc(100vw - 2rem), 56rem)",
    },
    cardBox: {
      boxShadow: "none",
      width: "min(calc(100vw - 2rem), 56rem)",
    },
    card: {
      backgroundColor: "var(--bg-surface)",
      border: "1px solid var(--border-default)",
      width: "100%",
    },
    navbar: {
      backgroundColor: "var(--bg-elevated)",
      borderRight: "1px solid var(--border-default)",
      flex: "0 0 17rem",
    },
    pageScrollBox: {
      overflowX: "hidden",
    },
    profilePage: {
      minWidth: "0",
    },
    profileSectionContent: {
      minWidth: "0",
    },
  },
}
