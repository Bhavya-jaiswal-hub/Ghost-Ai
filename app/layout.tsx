import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { signInUrl, signUpUrl } from "@/lib/auth-routes";
import { clerkAppearance } from "@/lib/clerk-appearance";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ghost AI",
  description: "Collaborative system design workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      afterSignOutUrl={signInUrl}
      appearance={clerkAppearance}
      signInUrl={signInUrl}
      signUpUrl={signUpUrl}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} dark h-full overflow-x-hidden antialiased`}
      >
        <body
          className="min-h-full w-full overflow-x-hidden flex flex-col bg-base font-sans antialiased"
          suppressHydrationWarning
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
