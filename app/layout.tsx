import type { Metadata, Viewport } from "next"
import { Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { ToastProvider } from "@/components/ui/toast"
import { ViewModeProvider } from "@/lib/view-mode"
import { ViewDensityProvider } from "@/lib/view-density"
import { cn } from "@/lib/utils"
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { ServiceWorkerRegister } from "@/components/pwa/sw-register"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata: Metadata = {
  title: "MDM Daily Report",
  description: "Daily work reporting, task tracking, and project management system.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "DailyReport",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body suppressHydrationWarning>
        <ServiceWorkerRegister />
        <ThemeProvider>
          <ToastProvider>
            <ViewModeProvider>
              <ViewDensityProvider>
                {children}
                <Analytics />
                <SpeedInsights />
              </ViewDensityProvider>
            </ViewModeProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}


