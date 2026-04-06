'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Bot,
  Zap,
  Shield,
  BarChart3,
  Users,
  Check,
  ArrowRight,
  Sparkles,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PLANS } from '@/lib/asaas';

export default function LandingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const features = [
    {
      icon: Bot,
      title: 'IA Avançada',
      description: 'Chatbot inteligente que entende contexto e responde naturalmente.',
    },
    {
      icon: MessageSquare,
      title: 'Multi-Atendimento',
      description: 'Gerencie múltiplas conversas simultâneas com respostas humanizadas.',
    },
    {
      icon: Zap,
      title: 'Respostas Instantâneas',
      description: 'Atendimento 24/7 com delays humanizados para parecer natural.',
    },
    {
      icon: Shield,
      title: 'Segurança Total',
      description: 'Criptografia ponta a ponta e proteção de dados dos seus clientes.',
    },
    {
      icon: BarChart3,
      title: 'Dashboard Completo',
      description: 'Métricas em tempo real, gráficos e relatórios detalhados.',
    },
    {
      icon: Users,
      title: 'Multi-Tenant',
      description: 'Gerencie múltiplos números de WhatsApp em uma única plataforma.',
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">DuzAPI</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost" className="text-gray-300 hover:text-white">
                  Entrar
                </Button>
              </Link>
              <Link href="/register">
                <Button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700">
                  Criar Conta
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 mb-6">
              <Sparkles className="w-4 h-4 text-violet-400" />
              <span className="text-violet-300 text-sm">Desenvolvido com Inteligência Artificial</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Automatize seu WhatsApp com{' '}
              <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                Inteligência Artificial
              </span>
            </h1>
            <p className="text-xl text-gray-400 mb-8 max-w-3xl mx-auto">
              Transforme seu atendimento com um chatbot que entende, aprende e responde
              como um humano. Aumente suas vendas enquanto reduz custos.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register">
                <Button size="lg" className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-lg px-8">
                  Comece Grátis por 7 Dias
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link href="#pricing">
                <Button size="lg" variant="outline" className="text-lg px-8 border-gray-600 text-gray-300 hover:bg-gray-800">
                  Ver Preços
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-gray-800/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Tudo que você precisa para automatizar
            </h2>
            <p className="text-gray-400 text-lg">
              Recursos poderosos para escalar seu atendimento
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="p-6 rounded-2xl bg-gray-800/50 border border-gray-700 hover:border-violet-500/50 transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-violet-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Escolha seu plano
            </h2>
            <p className="text-gray-400 text-lg mb-8">
              Comece com 7 dias grátis e transforme seu atendimento
            </p>
            {/* Billing Toggle */}
            <div className="inline-flex items-center gap-4 p-1 rounded-full bg-gray-800">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-6 py-2 rounded-full transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-violet-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Mensal
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-6 py-2 rounded-full transition-all flex items-center gap-2 ${
                  billingCycle === 'yearly'
                    ? 'bg-violet-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Anual
                <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                  -17%
                </span>
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Monthly Plan */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className={`relative p-8 rounded-2xl border ${
                billingCycle === 'monthly'
                  ? 'bg-gradient-to-br from-violet-900/50 to-purple-900/50 border-violet-500'
                  : 'bg-gray-800/50 border-gray-700'
              }`}
            >
              {billingCycle === 'monthly' && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-violet-600 rounded-full text-white text-sm font-medium">
                  Mais Popular
                </div>
              )}
              <h3 className="text-2xl font-bold text-white mb-2">{PLANS.monthly.name}</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold text-white">R$ {PLANS.monthly.price.toFixed(2).replace('.', ',')}</span>
                <span className="text-gray-400">/mês</span>
              </div>
              <p className="text-gray-400 mb-6">{PLANS.monthly.description}</p>
              <ul className="space-y-3 mb-8">
                {PLANS.monthly.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-gray-300">
                    <Check className="w-5 h-5 text-green-400" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link href={`/register?plan=monthly`}>
                <Button
                  className={`w-full ${
                    billingCycle === 'monthly'
                      ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  size="lg"
                >
                  Comece Grátis por 7 Dias
                </Button>
              </Link>
            </motion.div>

            {/* Yearly Plan */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
              className={`relative p-8 rounded-2xl border ${
                billingCycle === 'yearly'
                  ? 'bg-gradient-to-br from-violet-900/50 to-purple-900/50 border-violet-500'
                  : 'bg-gray-800/50 border-gray-700'
              }`}
            >
              {billingCycle === 'yearly' && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-violet-600 rounded-full text-white text-sm font-medium">
                  Melhor Valor
                </div>
              )}
              <h3 className="text-2xl font-bold text-white mb-2">{PLANS.yearly.name}</h3>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-4xl font-bold text-white">R$ {PLANS.yearly.price.toFixed(2).replace('.', ',')}</span>
                <span className="text-gray-400">/ano</span>
              </div>
              <p className="text-gray-400 mb-6">{PLANS.yearly.description}</p>
              <ul className="space-y-3 mb-8">
                {PLANS.yearly.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-gray-300">
                    <Check className="w-5 h-5 text-green-400" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link href={`/register?plan=yearly`}>
                <Button
                  className={`w-full ${
                    billingCycle === 'yearly'
                      ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  size="lg"
                >
                  Comece Grátis por 7 Dias
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 bg-gray-800/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Como funciona
            </h2>
            <p className="text-gray-400 text-lg">
              Em 3 passos simples
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Crie sua conta', description: 'Cadastre-se e ganhe 7 dias grátis para testar todos os recursos.' },
              { step: '2', title: 'Conecte seu WhatsApp', description: 'Escaneie o QR Code e conecte seu número em segundos.' },
              { step: '3', title: 'Configure seu chatbot', description: 'Personalize as respostas da IA e comece a automatizar.' },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="text-center"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-gray-400">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="p-12 rounded-3xl bg-gradient-to-br from-violet-600 to-purple-600"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Pronto para revolucionar seu atendimento?
            </h2>
            <p className="text-violet-100 text-lg mb-8">
              Comece agora com 7 dias grátis. Sem compromisso.
            </p>
            <Link href="/register">
              <Button size="lg" className="bg-white text-violet-600 hover:bg-gray-100 text-lg px-8">
                Comece Agora Grátis
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            {/* Logo & description */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-bold text-white">DuzAPI</span>
              </div>
              <p className="text-gray-400 text-sm">
                Automatize seu WhatsApp com Inteligência Artificial.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-white font-semibold mb-4">Links</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="#pricing" className="text-gray-400 hover:text-violet-400">Preços</Link></li>
                <li><Link href="/register" className="text-gray-400 hover:text-violet-400">Criar conta</Link></li>
                <li><Link href="/login" className="text-gray-400 hover:text-violet-400">Entrar</Link></li>
                <li><Link href="/termos" className="text-gray-400 hover:text-violet-400">Termos de Uso</Link></li>
                <li><Link href="/privacidade" className="text-gray-400 hover:text-violet-400">Política de Privacidade</Link></li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-white font-semibold mb-4">Contato</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2 text-gray-400">
                  <Mail className="w-4 h-4" />
                  <a href="mailto:suporte@duzapi.com.br" className="hover:text-violet-400">
                    suporte@duzapi.com.br
                  </a>
                </li>
                <li className="flex items-center gap-2 text-gray-400">
                  <MessageSquare className="w-4 h-4" />
                  <a href="https://wa.me/5571997351964" target="_blank" rel="noopener noreferrer" className="hover:text-violet-400">
                    WhatsApp Suporte
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 text-center">
            <p className="text-gray-400 text-sm">
              © {new Date().getFullYear()} DuzAPI. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
