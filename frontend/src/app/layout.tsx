import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import { BottomNav } from "@/components/layout/BottomNav";
import { DesktopNav } from "@/components/layout/DesktopNav";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SwipeNest AI — Apartment hunting, intelligently",
  description:
    "Premium AI-powered apartment discovery for Paris. Swipe, learn, understand recommendations, and apply with confidence.",
  applicationName: "SwipeNest AI",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SwipeNest AI",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#F8F6F1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${jakarta.variable} antialiased`}>
        <AppProviders>
          <div className="flex min-h-dvh">
            <DesktopNav />
            <div className="app-shell flex-1">
              {children}
              <BottomNav />
            </div>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
