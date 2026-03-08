import Link from 'next/link';
import { MessageSquare, ArrowLeft } from 'lucide-react';

export default function PrivacidadePage() {
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
          <h1 className="text-3xl font-bold text-white mb-2">Política de Privacidade</h1>
          <p className="text-gray-400 text-sm">Última atualização: Março de 2026</p>
        </div>

        <div className="prose prose-invert prose-gray max-w-none space-y-6 text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">1. Dados que Coletamos</h2>
            <p>Coletamos as seguintes informações:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong className="text-white">Dados de cadastro:</strong> nome, email e senha (armazenada de forma criptografada)</li>
              <li><strong className="text-white">Dados de uso:</strong> logs de mensagens processadas pelo chatbot</li>
              <li><strong className="text-white">Dados de pagamento:</strong> processados pelo Asaas (não armazenamos dados de cartão)</li>
              <li><strong className="text-white">Dados técnicos:</strong> endereço IP, navegador e sistema operacional</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">2. Como Usamos seus Dados</h2>
            <p>Seus dados são utilizados para:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Fornecer e manter o serviço de automação WhatsApp</li>
              <li>Processar pagamentos e gerenciar assinaturas</li>
              <li>Enviar comunicações sobre o serviço (atualizações, alertas)</li>
              <li>Melhorar a qualidade do serviço e correção de problemas</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">3. Armazenamento e Segurança</h2>
            <p>Seus dados são armazenados em servidores seguros com criptografia. Chaves de API são armazenadas com criptografia Fernet. Senhas são armazenadas com hash bcrypt. Aplicamos medidas de segurança técnicas e organizacionais para proteger seus dados.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">4. Compartilhamento de Dados</h2>
            <p>Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros, exceto:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong className="text-white">Asaas:</strong> para processamento de pagamentos</li>
              <li><strong className="text-white">OpenAI:</strong> mensagens são enviadas à API da OpenAI para geração de respostas da IA</li>
              <li><strong className="text-white">Obrigação legal:</strong> quando exigido por lei ou ordem judicial</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">5. Retenção de Dados</h2>
            <p>Logs de mensagens são armazenados por até 90 dias. Dados de conta são mantidos enquanto sua conta estiver ativa. Após exclusão da conta, seus dados serão removidos em até 30 dias.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">6. Seus Direitos (LGPD)</h2>
            <p>De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Acessar seus dados pessoais</li>
              <li>Corrigir dados incompletos ou incorretos</li>
              <li>Solicitar a exclusão de seus dados</li>
              <li>Revogar o consentimento para tratamento de dados</li>
              <li>Solicitar portabilidade de dados</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">7. Cookies</h2>
            <p>Utilizamos cookies essenciais para autenticação e funcionamento do sistema. Não utilizamos cookies de rastreamento ou publicidade.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mt-8 mb-3">8. Contato</h2>
            <p>Para exercer seus direitos ou tirar dúvidas sobre esta política, entre em contato pelo email <a href="mailto:suporte@duzapi.com.br" className="text-violet-400 hover:text-violet-300">suporte@duzapi.com.br</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
