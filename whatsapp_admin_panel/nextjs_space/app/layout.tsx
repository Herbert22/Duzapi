import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  title: {
    default: 'DuzAPI — Automatize seu WhatsApp com IA',
    template: '%s | DuzAPI',
  },
  description: 'Automatize seu atendimento no WhatsApp com inteligência artificial. Chatbot com GPT-4, multi-atendimento, dashboard de métricas e muito mais.',
  keywords: ['whatsapp', 'chatbot', 'automação', 'inteligência artificial', 'GPT-4', 'atendimento automático', 'SaaS'],
  authors: [{ name: 'DuzAPI' }],
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  openGraph: {
    title: 'DuzAPI — Automatize seu WhatsApp com IA',
    description: 'Chatbot inteligente com GPT-4 para WhatsApp. Aumente suas vendas com atendimento 24/7.',
    siteName: 'DuzAPI',
    locale: 'pt_BR',
    type: 'website',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DuzAPI — Automatize seu WhatsApp com IA',
    description: 'Chatbot inteligente com GPT-4 para WhatsApp. Aumente suas vendas com atendimento 24/7.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script src="https://apps.abacus.ai/chatllm/appllm-lib.js"></script>
      </head>
      <body className={`${inter.className} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
