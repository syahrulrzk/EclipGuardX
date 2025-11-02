import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EclipGuardX - Container Monitoring & Security Dashboard",
  description: "Enterprise-grade container monitoring and security dashboard with real-time metrics, vulnerability scanning, and malware detection.",
  keywords: ["EclipGuardX", "container monitoring", "security", "Docker", "Kubernetes", "cybersecurity", "devops"],
  authors: [{ name: "EclipGuardX Team" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "EclipGuardX - Container Security Dashboard",
    description: "Enterprise-grade container monitoring and security platform",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "EclipGuardX - Container Security Dashboard",
    description: "Enterprise-grade container monitoring and security platform",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
        <SonnerToaster />
      </body>
    </html>
  );
}
