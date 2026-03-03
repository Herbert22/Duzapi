import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { CreditCard, Calendar, Users, MessageSquare, AlertCircle, CheckCircle } from 'lucide-react';

async function getBillingData(userId: string) {
  const [user, subscription] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { maxTenants: true, maxMessagesPerMonth: true },
    }),
    prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return { user, subscription };
}

function StatusBadge({ status }: { status: string }) {
  const statusMap: Record<string, { label: string; className: string }> = {
    active: { label: 'Ativo', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
    pending: { label: 'Pendente', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    cancelled: { label: 'Cancelado', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
    expired: { label: 'Expirado', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
    trial: { label: 'Trial', className: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
  };

  const config = statusMap[status] ?? statusMap.pending;
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}>
      {config.label}
    </span>
  );
}

export default async function BillingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect('/login');

  const dbUser = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!dbUser) redirect('/login');

  const { user, subscription } = await getBillingData(dbUser.id);

  const isTrialActive =
    subscription?.status === 'active' &&
    subscription?.trialEndsAt &&
    new Date(subscription.trialEndsAt) > new Date();

  const trialDaysLeft = isTrialActive && subscription?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const planLabels: Record<string, string> = {
    monthly: 'Mensal',
    yearly: 'Anual',
    trial: 'Trial',
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Cobrança e Plano</h1>
        <p className="text-gray-400 mt-1">Gerencie sua assinatura e visualize seu uso</p>
      </div>

      {/* Plan card */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-500/20 rounded-xl flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold">
                {subscription ? `Plano ${planLabels[subscription.plan] ?? subscription.plan}` : 'Sem plano'}
              </h2>
              <p className="text-gray-400 text-sm">
                {subscription
                  ? `R$ ${(subscription.priceInCents / 100).toFixed(2).replace('.', ',')} / ${subscription.plan === 'yearly' ? 'ano' : 'mês'}`
                  : 'Nenhuma assinatura ativa'}
              </p>
            </div>
          </div>
          {subscription && <StatusBadge status={isTrialActive ? 'trial' : subscription.status} />}
        </div>

        {isTrialActive && (
          <div className="mt-4 flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-xl p-3">
            <CheckCircle className="w-4 h-4 text-violet-400 flex-shrink-0" />
            <span className="text-violet-300 text-sm">
              Trial ativo — {trialDaysLeft} {trialDaysLeft === 1 ? 'dia' : 'dias'} restantes
            </span>
          </div>
        )}

        {subscription?.status === 'active' && !isTrialActive && subscription?.endDate && (
          <div className="mt-4 flex items-center gap-2 text-gray-400 text-sm">
            <Calendar className="w-4 h-4" />
            <span>Renova em {new Date(subscription.endDate).toLocaleDateString('pt-BR')}</span>
          </div>
        )}

        {(!subscription || ['cancelled', 'expired', 'pending'].includes(subscription.status)) && (
          <div className="mt-4">
            <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-4">
              <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <span className="text-yellow-300 text-sm">
                {subscription?.status === 'pending'
                  ? 'Pagamento pendente. Complete o pagamento para ativar sua assinatura.'
                  : 'Assinatura inativa. Faça upgrade para continuar usando o DuzAPI.'}
              </span>
            </div>
            <a
              href="/checkout"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-medium px-4 py-2 rounded-xl text-sm transition-all"
            >
              {subscription?.status === 'pending' ? 'Concluir pagamento' : 'Fazer upgrade'}
            </a>
          </div>
        )}

        {subscription?.asaasPaymentLink && (
          <div className="mt-3">
            <a
              href={subscription.asaasPaymentLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:text-violet-300 text-sm underline"
            >
              Gerenciar assinatura no Asaas →
            </a>
          </div>
        )}
      </div>

      {/* Usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-gray-300 font-medium text-sm">Instâncias WhatsApp</span>
          </div>
          <p className="text-2xl font-bold text-white">
            — / {user?.maxTenants ?? 1}
          </p>
          <p className="text-gray-500 text-xs mt-1">Tenants disponíveis no plano</p>
        </div>

        <div className="bg-gray-800/50 border border-gray-700/50 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-green-500/20 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-gray-300 font-medium text-sm">Mensagens / mês</span>
          </div>
          <p className="text-2xl font-bold text-white">
            — / {(user?.maxMessagesPerMonth ?? 500).toLocaleString('pt-BR')}
          </p>
          <p className="text-gray-500 text-xs mt-1">Limite mensal do plano</p>
        </div>
      </div>
    </div>
  );
}
