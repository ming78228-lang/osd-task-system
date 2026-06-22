import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '茁日設計 任務系統',
  description: 'OSD Design Task Management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className="bg-gray-50 min-h-screen antialiased">{children}</body>
    </html>
  )
}
