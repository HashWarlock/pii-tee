import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClientProviders } from "@/components/client-providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export const metadata: Metadata = {
  title: "PII-TEE Anonymous Chat",
  description: "Secure, privacy-preserving conversations with AI using Trusted Execution Environment",
  keywords: ["privacy", "AI", "chat", "anonymous", "TEE", "security"],
  authors: [{ name: "PII-TEE Team" }],
  creator: "PII-TEE",
  publisher: "PII-TEE",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html 
      lang="en" 
      suppressHydrationWarning
      className="scrollbar-thin"
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        <ClientProviders>
          {children}
        </ClientProviders>
        
        {/* Performance and accessibility script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Prevent FOUC and improve accessibility
              document.documentElement.style.setProperty('--initial-color-mode', 
                window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
              );
              
              // Add reduced motion class if user prefers reduced motion
              if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                document.documentElement.classList.add('reduce-motion');
              }
              
              // Add high contrast class if user prefers high contrast
              if (window.matchMedia('(prefers-contrast: high)').matches) {
                document.documentElement.classList.add('high-contrast');
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
