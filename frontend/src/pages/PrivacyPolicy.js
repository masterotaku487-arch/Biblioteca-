// ==============================================================================
// CRIAR: src/pages/PrivacyPolicy.js
// ==============================================================================

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Button
          onClick={() => navigate(-1)}
          variant="ghost"
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>

        <Card className="shadow-xl">
          <CardHeader className="space-y-4 pb-8 border-b">
            <div className="flex items-center gap-3">
              <Shield className="w-8 h-8 text-blue-600" />
              <CardTitle className="text-3xl font-bold" style={{fontFamily: 'Manrope'}}>
                Política de Privacidade
              </CardTitle>
            </div>
            <p className="text-sm text-gray-600">
              Última atualização: {new Date().toLocaleDateString('pt-BR')}
            </p>
          </CardHeader>

          <CardContent className="prose prose-gray max-w-none py-8 space-y-6">
            <section>
              <h2 className="text-2xl font-bold mb-4">1. Introdução</h2>
              <p className="text-gray-700 leading-relaxed">
                A Biblioteca Privada ("nós", "nosso" ou "nos") está comprometida em proteger sua privacidade. 
                Esta Política de Privacidade explica como coletamos, usamos, divulgamos e protegemos suas informações 
                quando você usa nosso serviço de armazenamento e compartilhamento de arquivos.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">2. Informações que Coletamos</h2>
              
              <h3 className="text-xl font-semibold mb-3">2.1 Informações Fornecidas por Você</h3>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Conta:</strong> Nome de usuário, senha (criptografada), e-mail (opcional)</li>
                <li><strong>Arquivos:</strong> Arquivos que você faz upload, incluindo metadados (nome, tamanho, tipo)</li>
                <li><strong>Login com Google:</strong> Nome, e-mail e foto de perfil (se usar Google OAuth)</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3 mt-4">2.2 Informações Coletadas Automaticamente</h3>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Dados de Uso:</strong> Endereço IP, tipo de navegador, páginas visitadas</li>
                <li><strong>Cookies:</strong> Cookies de sessão para manter você conectado</li>
                <li><strong>Analytics:</strong> Google Analytics para análise de tráfego (anônimo)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">3. Como Usamos Suas Informações</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Fornecer, manter e melhorar nosso serviço</li>
                <li>Processar transações e gerenciar sua conta</li>
                <li>Enviar notificações importantes sobre o serviço</li>
                <li>Responder a suas solicitações e fornecer suporte</li>
                <li>Detectar, prevenir e resolver problemas técnicos</li>
                <li>Cumprir obrigações legais</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">4. Google AdSense e Cookies de Publicidade</h2>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-900">
                  <strong>⚠️ Aviso Importante sobre Publicidade</strong>
                </p>
              </div>
              
              <p className="text-gray-700 leading-relaxed mb-4">
                Utilizamos o Google AdSense para exibir anúncios em nosso site. O Google AdSense usa cookies 
                para exibir anúncios com base em visitas anteriores a este ou outros sites.
              </p>

              <h3 className="text-xl font-semibold mb-3">4.1 Como o Google Usa Seus Dados</h3>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>O Google usa cookies para exibir anúncios personalizados</li>
                <li>Os usuários podem desativar anúncios personalizados visitando 
                  <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" 
                     className="text-blue-600 hover:underline ml-1">
                    Configurações de Anúncios do Google
                  </a>
                </li>
                <li>Você também pode desativar cookies de terceiros visitando 
                  <a href="http://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" 
                     className="text-blue-600 hover:underline ml-1">
                    aboutads.info
                  </a>
                </li>
              </ul>

              <h3 className="text-xl font-semibold mb-3 mt-4">4.2 Google Analytics</h3>
              <p className="text-gray-700 leading-relaxed">
                Usamos o Google Analytics para entender como os visitantes interagem com nosso site. 
                O Google Analytics coleta informações de forma anônima e relata tendências do site 
                sem identificar visitantes individuais.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">5. Compartilhamento de Informações</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Não vendemos, alugamos ou compartilhamos suas informações pessoais, exceto:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Com seu consentimento:</strong> Quando você autoriza explicitamente</li>
                <li><strong>Provedores de serviço:</strong> Google (Analytics, AdSense), Supabase (armazenamento)</li>
                <li><strong>Requisitos legais:</strong> Quando exigido por lei ou ordem judicial</li>
                <li><strong>Proteção de direitos:</strong> Para proteger nossos direitos legais</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">6. Segurança dos Dados</h2>
              <p className="text-gray-700 leading-relaxed">
                Implementamos medidas de segurança técnicas e organizacionais para proteger suas informações:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700 mt-3">
                <li>Senhas criptografadas com bcrypt</li>
                <li>Conexões HTTPS/SSL</li>
                <li>Armazenamento seguro (Supabase Cloud ou servidor protegido)</li>
                <li>Acesso restrito aos dados</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">7. Seus Direitos (LGPD/GDPR)</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                De acordo com a LGPD (Lei Geral de Proteção de Dados) brasileira e GDPR europeu, você tem direito a:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li><strong>Acesso:</strong> Solicitar acesso aos seus dados pessoais</li>
                <li><strong>Correção:</strong> Corrigir dados incorretos ou desatualizados</li>
                <li><strong>Exclusão:</strong> Solicitar a exclusão de seus dados</li>
                <li><strong>Portabilidade:</strong> Receber seus dados em formato estruturado</li>
                <li><strong>Oposição:</strong> Opor-se ao processamento de seus dados</li>
                <li><strong>Revogação:</strong> Revogar consentimento a qualquer momento</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">8. Cookies</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Usamos cookies para:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Manter sua sessão de login</li>
                <li>Lembrar suas preferências</li>
                <li>Análise de tráfego (Google Analytics)</li>
                <li>Exibir anúncios relevantes (Google AdSense)</li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                Você pode desativar cookies nas configurações do seu navegador, mas isso pode afetar 
                a funcionalidade do site.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">9. Links para Sites de Terceiros</h2>
              <p className="text-gray-700 leading-relaxed">
                Nosso site pode conter links para sites de terceiros. Não somos responsáveis pelas 
                práticas de privacidade desses sites. Recomendamos que você leia as políticas de 
                privacidade de todos os sites que visitar.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">10. Alterações nesta Política</h2>
              <p className="text-gray-700 leading-relaxed">
                Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos você sobre 
                mudanças significativas publicando a nova política nesta página e atualizando a data 
                de "Última atualização" no topo.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">11. Contato</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-gray-700 leading-relaxed">
                  Se você tiver dúvidas sobre esta Política de Privacidade ou quiser exercer seus direitos, 
                  entre em contato conosco:
                </p>
                <ul className="list-none space-y-2 text-gray-700 mt-3">
                  <li><strong>Email:</strong> masterotaku487@gmail.com</li>
                  <li><strong>Site:</strong> biblioteca-sigma-gilt.vercel.app</li>
                </ul>
              </div>
            </section>

            <div className="mt-8 pt-8 border-t">
              <p className="text-sm text-gray-500 text-center">
                Esta política está em conformidade com a LGPD (Lei 13.709/2018) e GDPR (Regulamento UE 2016/679)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
