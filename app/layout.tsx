import { Geist_Mono, Inter } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { ToastProvider } from "@/components/ui/toast"
import { ViewModeProvider } from "@/lib/view-mode"
import { ViewDensityProvider } from "@/lib/view-density"
import { cn } from "@/lib/utils"
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

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

