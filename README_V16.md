# Fortalfy v16 — revisão de experiência e configurações

## Como abrir
1. Extraia o ZIP completo.
2. Abra `fortalfy_v10/index.html` em navegador moderno.
3. Crie uma conta demonstrativa com e-mail de teste e senha exclusiva para este protótipo.
4. Clique na foto do canto superior direito > Configurações.
5. Altere as preferências, salve, feche e reabra Configurações para confirmar persistência local.

## Implementado nesta revisão
- Tela de configurações com preferências de novidades, lembretes, ofertas e visibilidade preferida.
- Persistência das preferências por e-mail no armazenamento local do navegador.
- Valores reaparecem ao reabrir a tela.
- Exportação de dados básicos e saída da conta continuam disponíveis.
- Feed com publicações de exemplo, curtidas, comentários e conteúdo publicitário claramente marcado como demonstrativo.
- Verificação de sintaxe JavaScript com Node.js.

## Limites críticos — não publicar como produção
Esta é uma demonstração front-end. Cadastro e dados ficam no navegador; o protótipo atual armazena senha de demonstração em localStorage e, portanto, NÃO deve receber senha real nem dados pessoais/sensíveis. As preferências não controlam notificações reais nem visibilidade de perfis no servidor. Curtidas, comentários, pedidos, carteira e agendamentos não são compartilhados entre dispositivos. Os perfis, preços, selos, anúncios, academias e restaurantes são fictícios/ilustrativos.

Para produção é obrigatório substituir autenticação local por provedor seguro, remover armazenamento de senha no navegador, configurar banco de dados e regras de autorização no servidor, armazenamento de imagens, moderação/denúncias, consentimento e política de privacidade, integração de pagamento com checkout hospedado, testes automatizados e revisão de segurança. Nenhuma chave secreta deve ser colocada no HTML/JavaScript público.
