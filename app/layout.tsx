import type { Metadata } from 'next'
import { Playfair_Display, IBM_Plex_Mono, Source_Serif_4 } from 'next/font/google'
import './globals.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  weight: ['400', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const ibmMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-ibm-mono',
  weight: ['300', '400', '500'],
  display: 'swap',
})

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-source-serif',
  weight: 'variable',
  style: ['normal', 'italic'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: "Edwin's Feed",
  description: "Edwin's gepersonaliseerde AI-nieuwsfeed",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="nl"
      className={`${playfair.variable} ${ibmMono.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
