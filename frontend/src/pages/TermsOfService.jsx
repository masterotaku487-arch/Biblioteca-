// src/pages/TermsOfService.jsx

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Shield, AlertTriangle, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const TermsOfService = () => {
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
            <FileText className="w-16 h-16 mx-auto mb-4 text-purple-600" />
            <h1 className="text-4xl font-bold text-gray-900 mb-2" style={{fontFamily: 'Manrope'}}>
              Termos de Uso
            </h1>
            <p className="text-gray-600">
              Última atualização: {new Date().toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* 1. Aceitação dos Termos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                1. Aceitação dos Termos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-700">
              <p>
                Ao acessar e usar a <strong>Biblioteca Privada</strong>, você concorda em cumprir 
                e estar vinculado a estes Termos de Uso.
              </p>
              <p>
                Se você não concorda com qualquer parte destes termos, não utilize nosso serviço.
              </p>
            </CardContent>
          </Card>

          {/* 2. Descrição do Serviço */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600" />
                2. Descrição do Serviço
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-700">
              <p>
                A Biblioteca Privada é um sistema de armazenamento e compartilhamento de arquivos 
                que permite aos usuários:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Fazer upload de arquivos pessoais</li>
                <li>Armazenar documentos de forma segura</li>
                <li>Compartilhar arquivos de forma privada</li>
                <li>Gerenciar seu espaço de armazenamento</li>
              </ul>
            </CardContent>
          </Card>

          {/* 3. Responsabilidades do Usuário */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                3. Responsabilidades do Usuário
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-700">
              <p>Você concorda em:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Fornecer informações verdadeiras e precisas ao criar sua conta</li>
                <li>Manter a segurança de sua senha</li>
                <li>Não compartilhar sua conta com terceiros</li>
                <li>Não fazer upload de conteúdo ilegal, ofensivo ou que viole direitos autorais</li>
                <li>Não usar o serviço para distribuir malware, vírus ou conteúdo malicioso</li>
                <li>Respeitar os limites de armazenamento estabelecidos</li>
              </ul>
            </CardContent>
          </Card>

          {/* 4. Conteúdo do Usuário */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-600" />
                4. Conteúdo do Usuário
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-700">
              <p>
                <strong>Propriedade:</strong> Você mantém todos os direitos sobre os arquivos que 
                faz upload. Não reivindicamos propriedade sobre seu conteúdo.
              </p>
              <p>
                <strong>Licença:</strong> Ao fazer upload, você nos concede uma licença limitada 
                para armazenar e exibir seus arquivos conforme necessário para fornecer o serviço.
              </p>
              <p>
                <strong>Remoção:</strong> Reservamo-nos o direito de remover conteúdo que viole 
                estes termos sem aviso prévio.
              </p>
            </CardContent>
          </Card>

          {/* 5. Limites de Armazenamento */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
                5. Limites de Armazenamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-700">
              <p>
                Cada usuário possui um limite de armazenamento de <strong>100 MB gratuitos</strong>.
              </p>
              <p>
                Reservamo-nos o direito de modificar os limites de armazenamento mediante aviso prévio.
              </p>
            </CardContent>
          </Card>

          {/* 6. Privacidade e Segurança */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                6. Privacidade e Segurança
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-700">
              <p>
                Seus arquivos são privados por padrão e não são compartilhados com terceiros, 
                exceto quando você optar por compartilhá-los.
              </p>
              <p>
                Consulte nossa <strong>Política de Privacidade</strong> para mais detalhes sobre 
                como tratamos seus dados.
              </p>
            </CardContent>
          </Card>

          {/* 7. Isenção de Garantias */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                7. Isenção de Garantias
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-700">
              <p>
                O serviço é fornecido "como está" sem garantias de qualquer tipo, expressas ou implícitas.
              </p>
              <p>
                Não garantimos que o serviço será ininterrupto, seguro ou livre de erros.
              </p>
              <p>
                <strong>Faça backup de seus arquivos importantes.</strong> Não nos responsabilizamos 
                por perda de dados.
              </p>
            </CardContent>
          </Card>

          {/* 8. Limitação de Responsabilidade */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-gray-600" />
                8. Limitação de Responsabilidade
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-700">
              <p>
                Em nenhuma circunstância seremos responsáveis por danos indiretos, incidentais, 
                especiais ou consequenciais resultantes do uso ou impossibilidade de uso do serviço.
              </p>
            </CardContent>
          </Card>

          {/* 9. Modificações */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />
                9. Modificações dos Termos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-700">
              <p>
                Reservamo-nos o direito de modificar estes termos a qualquer momento.
              </p>
              <p>
                Mudanças significativas serão notificadas aos usuários com antecedência razoável.
              </p>
              <p>
                O uso continuado do serviço após alterações constitui aceitação dos novos termos.
              </p>
            </CardContent>
          </Card>

          {/* 10. Encerramento */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                10. Encerramento de Conta
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-700">
              <p>
                Podemos suspender ou encerrar sua conta se você violar estes termos.
              </p>
              <p>
                Você pode encerrar sua conta a qualquer momento entrando em contato conosco.
              </p>
            </CardContent>
          </Card>

          {/* 11. Contato */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                11. Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-gray-700">
              <p>
                Para questões sobre estes Termos de Uso, entre em contato através do chat 
                quando disponível ou através das configurações da sua conta.
              </p>
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

export default TermsOfService;
