'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  Loader2,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const plan = searchParams.get('plan') || 'monthly';
  const provider = searchParams.get('provider');

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Se veio do Google, redirecionar para checkout
  useEffect(() => {
    if (provider === 'google') {
      router.push(`/checkout?plan=${plan}`);
    }
  }, [provider, plan, router]);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Cole de código completo
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      const newCode = [...code];
      digits.forEach((digit, i) => {
        if (i < 6) newCode[i] = digit;
      });
      setCode(newCode);
      if (digits.length === 6) {
        inputRefs.current[5]?.focus();
      }
      return;
    }

    const newCode = [...code];
    newCode[index] = value.replace(/\D/g, '');
    setCode(newCode);

    // Auto-focus próximo
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const verificationCode = code.join('');
    if (verificationCode.length !== 6) {
      toast.error('Digite o código completo');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: verificationCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Código inválido');
      }

      toast.success('Email verificado com sucesso!');
      router.push(`/checkout?plan=${plan}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao verificar código');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;

    setResending(true);

    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao reenviar código');
      }

      toast.success('Novo código enviado!');
      setCountdown(60);
      setCode(['', '', '', '', '', '']);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao reenviar código');
    } finally {
      setResending(false);
    }
  };

  if (provider === 'google') {
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
        className="w-full max-w-md"
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
        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-violet-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-violet-400" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            Verifique seu email
          </h1>
          <p className="text-gray-400 mb-8">
            Enviamos um código de 6 dígitos para<br />
            <span className="text-white font-medium">{email}</span>
          </p>

          {/* Code Input */}
          <div className="flex justify-center gap-2 mb-6">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-14 text-center text-2xl font-bold bg-gray-900 border border-gray-600 rounded-lg text-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none transition-all"
              />
            ))}
          </div>

          <Button
            onClick={handleVerify}
            className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 mb-4"
            disabled={loading || code.join('').length !== 6}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Verificar Código'
            )}
          </Button>

          <button
            onClick={handleResend}
            disabled={resending || countdown > 0}
            className="text-gray-400 hover:text-violet-400 text-sm flex items-center justify-center gap-2 mx-auto transition-colors disabled:opacity-50"
          >
            {resending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {countdown > 0 ? `Reenviar em ${countdown}s` : 'Reenviar código'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    }>
      <VerifyEmailForm />
    </Suspense>
  );
}
