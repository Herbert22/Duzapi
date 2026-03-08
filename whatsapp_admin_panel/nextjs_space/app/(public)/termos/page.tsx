import Link from 'next/link';
import { MessageSquare, ArrowLeft } from 'lucide-react';

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <Link href="/landing" className="inline-flex items-center gap-2 text-gray-400 hover:text-violet-400 mb-6">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Link>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">DuzAPI</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Termos de Uso</h1>
          <p className="text-gray-400 text-sm">Última atualização: Março de 2026</p>
        </div>

        <div className="prose prose-invert prose-gray max-w-none space-y-6 text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">1. Aceitação dos Termos</h2>
            <p>Ao acessar e utilizar a plataforma DuzAPI, você concorda com estes Termos de Uso. Se você não concorda com algum destes termos, não utilize nosso serviço.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">2. Descrição do Serviço</h2>
            <p>A DuzAPI é uma plataforma SaaS de automação de WhatsApp com inteligência artificial. O serviço permite a criação de chatbots automatizados para atendimento ao cliente via WhatsApp.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">3. Cadastro e Conta</h2>
            <p>Para utilizar o serviço, é necessário criar uma conta com informações verdadeiras e atualizadas. Você é responsável por manter a confidencialidade de suas credenciais de acesso.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">4. Uso Aceitável</h2>
            <p>Você concorda em não utilizar o serviço para:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Enviar spam ou mensagens não solicitadas em massa</li>
              <li>Atividades ilegais ou fraudulentas</li>
              <li>Violar os Termos de Serviço do WhatsApp</li>
              <li>Coletar dados pessoais sem consentimento</li>
              <li>Qualquer atividade que possa prejudicar terceiros</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">5. Planos e Pagamento</h2>
            <p>Os planos são cobrados conforme o ciclo escolhido (mensal ou anual). O período de trial gratuito de 7 dias está disponível para novos usuários. Após o trial, a cobrança é realizada automaticamente.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">6. Cancelamento</h2>
            <p>Você pode cancelar sua assinatura a qualquer momento. O acesso será mantido até o final do período pago. Não há reembolso para períodos parciais.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">7. Limitação de Responsabilidade</h2>
            <p>A DuzAPI não se responsabiliza por interrupções no serviço do WhatsApp, bloqueios de número, ou ações tomadas pela Meta/WhatsApp. O serviço é fornecido &quot;como está&quot;.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">8. Alterações nos Termos</h2>
            <p>Reservamos o direito de modificar estes termos a qualquer momento. Alterações significativas serão comunicadas por email.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">9. Contato</h2>
            <p>Para dúvidas sobre estes termos, entre em contato pelo email <a href="mailto:suporte@duzapi.com.br" className="text-violet-400 hover:text-violet-300">suporte@duzapi.com.br</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
