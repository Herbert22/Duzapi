'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Loader2,
  CreditCard,
  Check,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PLANS } from '@/lib/asaas';
import toast from 'react-hot-toast';

function CheckoutForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = (searchParams.get('plan') || 'monthly') as 'monthly' | 'yearly';
  const { data: session, status } = useSession() || {};

  const [loading, setLoading] = useState(false);
  const plan = PLANS[planId];

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/register?plan=${planId}`);
    }
  }, [status, router, planId]);

  const handleCheckout = async () => {
    setLoading(true);

    try {
      const response = await fetch('/api/subscription/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar assinatura');
      }

      // Redirecionar para link de pagamento Asaas
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else if (data.trialActivated) {
        toast.success(`Trial de 7 dias ativado! Aproveite o DuzAPI.`);
        router.push('/dashboard');
      } else {
        toast.success('Assinatura criada! Redirecionando...');
        router.push('/dashboard');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao processar pagamento');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/landing" className="inline-flex items-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <MessageSquare className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">DuzAPI</span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white text-center mb-2">
            Finalizar Assinatura
          </h1>
          <p className="text-gray-400 text-center mb-8">
            Olá, {session?.user?.name || session?.user?.email}!
          </p>

          {/* Plan Summary */}
          <div className="bg-gray-900/50 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                <p className="text-gray-400 text-sm">{plan.description}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">
                  R$ {plan.price.toFixed(2).replace('.', ',')}
                </p>
                <p className="text-gray-400 text-sm">
                  /{planId === 'monthly' ? 'mês' : 'ano'}
                </p>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-4">
              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-gray-300 text-sm">
                    <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Payment Methods */}
          <div className="mb-6">
            <p className="text-gray-400 text-sm mb-3">Formas de pagamento aceitas:</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-900/50 rounded-lg">
                <CreditCard className="w-5 h-5 text-gray-400" />
                <span className="text-gray-300 text-sm">Cartão</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-900/50 rounded-lg">
                <span className="text-gray-300 text-sm">PIX</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-900/50 rounded-lg">
                <span className="text-gray-300 text-sm">Boleto</span>
              </div>
            </div>
          </div>

          <Button
            onClick={handleCheckout}
            className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-lg h-12"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CreditCard className="w-5 h-5 mr-2" />
                Ir para Pagamento
              </>
            )}
          </Button>

          {/* Security Badge */}
          <div className="flex items-center justify-center gap-2 mt-6 text-gray-400 text-sm">
            <Shield className="w-4 h-4" />
            <span>Pagamento seguro via Asaas</span>
          </div>

          {/* Change Plan */}
          <p className="text-center text-gray-400 text-sm mt-4">
            Quer outro plano?{' '}
            <Link href="/landing#pricing" className="text-violet-400 hover:text-violet-300">
              Ver todos os planos
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    }>
      <CheckoutForm />
    </Suspense>
  );
}
