import { ApiProvider } from '@/components/providers/api-provider'
import { AuthRefreshProvider } from '@/components/providers/auth-refresh-provider'
import { Toaster } from '@/components/ui/sonner'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'
import type { Metadata } from 'next'
import { MicrosoftClarity } from '../components/analytics/microsoft-clarity'
import './globals.css'

export const metadata: Metadata = {
  title: 'G&S Comercios',
  description: 'Sistema de gestión con alta pública, trial y suscripción automática.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <ApiProvider>
          <AuthRefreshProvider />
          <Toaster />
          {children}
          <MicrosoftClarity />
        </ApiProvider>
      </body>
    </html>
  )
}
