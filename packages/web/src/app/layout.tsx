import "./globals.css";
import { ClientWrapper } from "@/src/app/client-layout";
import { geistSans, geistMono } from '@/src/app/fonts'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {  
  const config = {
    superglueEndpoint: process.env.NEXT_PUBLIC_SUPERGLUE_ENDPOINT,
    superglueApiKey: process.env.NEXT_PUBLIC_SUPERGLUE_API_KEY,
    postHogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    postHogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  }
  return (
    <html lang="en" className={`dark ${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <ClientWrapper config={config}>
          {children}
        </ClientWrapper>
      </body>
    </html>
  );
}

