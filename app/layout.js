import { Playfair_Display, Inter } from 'next/font/google'
import './globals.css'
import { Analytics } from "@vercel/analytics/next"

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata = {
  metadataBase: new URL('https://echoandchronicle.today'),
  title: {
    default: 'Echo & Chronicle',
    template: '%s | Echo & Chronicle',
  },
  description: 'One historical story, every day. Echo & Chronicle connects the moments that shaped America to the news of today. Primary sources. No ads.',
  icons: {
    icon: '/images/ec-logo.png',
    apple: '/images/ec-logo.png',
  },
  openGraph: {
    title: 'Echo & Chronicle',
    description: 'One historical story, every day. Echo & Chronicle connects the moments that shaped America to the news of today. Primary sources. No ads.',
    url: 'https://echoandchronicle.today',
    siteName: 'Echo & Chronicle',
    locale: 'en_US',
    type: 'website',
    images: [{ url: '/images/ec-logo.png', width: 500, height: 500 }],
  },
  twitter: {
    card: 'summary',
    title: 'Echo & Chronicle',
    description: 'One historical story, every day. Echo & Chronicle connects the moments that shaped America to the news of today. Primary sources. No ads.',
    site: '@EchoChronicle',
  },
  alternates: {
    canonical: 'https://echoandchronicle.today',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body className="antialiased">{children}<Analytics /></body>
    </html>
  )
}