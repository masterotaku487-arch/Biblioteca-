// src/pages/PrivacyPolicy.jsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, Eye, Database, Cookie, UserCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            onClick={() => navigate(-1)}
            variant="ghost"
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          
          <div className="text-center mb-8">
            <Shield className="w-16 h-16 mx-auto mb-4 text-purple-600" />
            <h1 className="text-4xl font-bold text-gray-900 mb-2" style={{fontFamily: 'Manrope'}}>
              Política de Privacidade
            </h1>
            <p className="text-gray-600">
              Última atualização: {new Date().toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* Introdução */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                Introdução
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-700">
              <p>
                A <strong>Biblioteca Privada</strong> leva sua privacidade a sério. Esta política 
                explica como coletamos, usamos, armazenamos e protegemos suas informações pessoais.
              </p>
              <p>
                Ao usar nosso serviço, você concorda com as práticas descritas nesta política.
              </p>
            </CardContent>
          </Card>

          {/* 1. Informações Coletadas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-green-600" />
                1. Informações que Coletamos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-700">
              <div>
                <h3 className="font-semibold mb-2">1.1 Informações de Conta</h3>
                <p>Quando você cria uma conta, coletamos:</p>
                <ul className="list-disc list-inside space-y-1 ml-4 mt-2">
                  <li>Nome de usuário</li>
                  <li>Endereço de e-mail (se fornecido)</li>
                  <li>Senha (armazenada de forma criptografada)</li>
                  <li>Informações de perfil do Google ou Discord (se usar login social)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">1.2 Conteúdo do Usuário</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Arquivos que você faz upload</li>
                  <li>Metadados dos arquivos (nome, tamanho, tipo, data)</li>
                  <li>Mensagens do chat (quando habilitado)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">1.3 Dados de Uso</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Endereço IP</li>
                  <li>Tipo de navegador</li>
                  <li>Data e hora de acesso</li>
                  <li>Páginas visitadas</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* 2. Como Usamos suas Informações */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-purple-600" />
                2. Como Usamos suas Informações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-700">
              <p>Usamos suas informações para:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Fornecer e manter o serviço</li>
                <li>Processar uploads e downloads de arquivos</li>
                <li>Autenticar sua identidade</li>
                <li>Melhorar a experiência do usuário</li>
                <li>Detectar e prevenir fraudes</li>
                <li>Enviar notificações importantes sobre o serviço</li>
                <li>Responder a solicitações de suporte</li>
              </ul>
            </CardContent>
          </Card>

          {/* 3. Compartilhamento de Dados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-orange-600" />
                3. Compartilhamento de Informações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-700">
              <p>
                <strong>NÃO vendemos</strong> suas informações pessoais a terceiros.
              </p>
              <p>Podemos compartilhar suas informações apenas nas seguintes circunstâncias:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Com seu consentimento:</strong> Quando você autoriza explicitamente</li>
                <li><strong>Provedores de serviço:</strong> MongoDB (banco de dados), Vercel/Render (hospedagem)</li>
                <li><strong>Login social:</strong> Google e Discord para autenticação</li>
                <li><strong>Requisitos legais:</strong> Se exigido por lei ou ordem judicial</li>
              </ul>
            </CardContent>
          </Card>

          {/* 4. Segurança dos Dados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-red-600" />
                4. Segurança dos Dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-700">
              <p>Implementamos medidas de segurança para proteger seus dados:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Senhas criptografadas com bcrypt</li>
                <li>Conexões HTTPS/SSL</li>
                <li>Tokens JWT para autenticação</li>
                <li>Armazenamento seguro em MongoDB</li>
                <li>Arquivos privados por padrão</li>
              </ul>
              <p className="mt-3">
                <strong>Importante:</strong> Nenhum sistema é 100% seguro. Recomendamos não 
                armazenar informações extremamente sensíveis.
              </p>
            </CardContent>
          </Card>

          {/* 5. Seus Direitos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                5. Seus Direitos (LGPD/GDPR)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-700">
              <p>Você tem direito a:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Acessar:</strong> Solicitar cópia de seus dados</li>
                <li><strong>Corrigir:</strong> Atualizar informações incorretas</li>
                <li><strong>Excluir:</strong> Solicitar exclusão de sua conta e dados</li>
                <li><strong>Portabilidade:</strong> Exportar seus arquivos</li>
                <li><strong>Revogar consentimento:</strong> Remover permissões de login social</li>
              </ul>
              <p className="mt-3">
                Para exercer esses direitos, entre em contato através do chat ou configurações da conta.
              </p>
            </CardContent>
          </Card>

          {/* 6. Cookies */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cookie className="w-5 h-5 text-yellow-600" />
                6. Cookies e Tecnologias Similares
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-700">
              <p>Usamos cookies e localStorage para:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Manter você logado</li>
                <li>Lembrar suas preferências</li>
                <li>Melhorar a performance do site</li>
              </ul>
              <p>
                Você pode limpar cookies e dados locais através das configurações do navegador.
              </p>
            </CardContent>
          </Card>

          {/* 7. Retenção de Dados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-teal-600" />
                7. Retenção de Dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-700">
              <p>
                Mantemos seus dados enquanto sua conta estiver ativa ou conforme necessário 
                para fornecer o serviço.
              </p>
              <p>
                Ao excluir sua conta, seus dados pessoais e arquivos são removidos permanentemente 
                de nossos sistemas.
              </p>
            </CardContent>
          </Card>

          {/* 8. Menores de Idade */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-pink-600" />
                8. Privacidade de Menores
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-700">
              <p>
                Nosso serviço não é direcionado a menores de 13 anos.
              </p>
              <p>
                Não coletamos intencionalmente informações de menores de 13 anos. Se você acredita 
                que coletamos dados de um menor, entre em contato imediatamente.
              </p>
            </CardContent>
          </Card>

          {/* 9. Alterações */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-gray-600" />
                9. Alterações nesta Política
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-700">
              <p>
                Podemos atualizar esta política ocasionalmente. Alterações significativas serão 
                notificadas através do site ou e-mail.
              </p>
              <p>
                Recomendamos revisar esta página periodicamente.
              </p>
            </CardContent>
          </Card>

          {/* 10. Contato */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                10. Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-700">
              <p>
                Para questões sobre esta Política de Privacidade ou para exercer seus direitos:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Use o chat quando disponível</li>
                <li>Entre em contato através das configurações da conta</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <Button
            onClick={() => navigate(-1)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            Voltar ao Site
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;