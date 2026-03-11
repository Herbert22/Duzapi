'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, XCircle, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props {
  isTrial: boolean;
  hasAsaasSubscription: boolean;
}

export default function CancelSubscriptionButton({ isTrial, hasAsaasSubscription }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [action, setAction] = useState<'cancel' | 'refund'>('cancel');

  const handleAction = async () => {
    setLoading(true);
    try {
      const endpoint = action === 'refund'
        ? '/api/subscription/refund'
        : '/api/subscription/cancel';

      const response = await fetch(endpoint, { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar solicitação');
      }

      toast.success(data.message || 'Assinatura cancelada com sucesso.');
      setConfirmOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao processar solicitação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={() => { setAction('cancel'); setConfirmOpen(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <XCircle className="w-4 h-4" />
          Cancelar assinatura
        </button>

        {hasAsaasSubscription && !isTrial && (
          <button
            onClick={() => { setAction('refund'); setConfirmOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Cancelar com estorno
          </button>
        )}
      </div>

      {/* Confirmation modal */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-white mb-2">
              {action === 'refund' ? 'Cancelar com estorno?' : 'Cancelar assinatura?'}
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              {action === 'refund'
                ? 'Sua assinatura será cancelada e um estorno do último pagamento será solicitado. Seus limites voltarão ao plano gratuito imediatamente.'
                : isTrial
                  ? 'Seu período de trial será encerrado imediatamente e seus limites voltarão ao plano gratuito.'
                  : 'Sua assinatura será cancelada imediatamente. Seus limites voltarão ao plano gratuito. Nenhum estorno será processado.'}
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setConfirmOpen(false)}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-sm text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleAction}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  action === 'refund' ? 'Confirmar estorno' : 'Confirmar cancelamento'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
