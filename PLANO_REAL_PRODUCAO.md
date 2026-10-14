# Fortalfy — caminho para produção real

## Estado honesto da entrega
O `index.html` incluído continua sendo um protótipo front-end local. Cadastro, senha, feed, curtidas, comentários, carteira demonstrativa, pedidos e agendamentos usam armazenamento do navegador; não são compartilhados entre pessoas ou dispositivos. Não use dados ou senhas reais neste protótipo.

## O que não pode ser declarado pronto sem configuração externa
- Autenticação real, recuperação/verificação de e-mail e encerramento de sessão no servidor.
- Banco de dados compartilhado e políticas RLS revisadas.
- Armazenamento de fotos com limites, validação de conteúdo e URLs protegidas.
- Pagamentos e reembolsos com provedor real; jamais coletar cartão/CVV diretamente no app.
- Pedidos de restaurante, entregas, disponibilidade de academias e agenda de profissionais com parceiros reais.
- Notificações, moderação, denúncias, bloqueios, privacidade e exclusão de conta.
- Testes automatizados, acessibilidade, monitoramento, backups e publicação HTTPS.

## Próximos passos concretos
1. Criar projeto Supabase separado para desenvolvimento e produção.
2. Executar `PRODUCAO_BACKEND_SUPABASE.sql` em ambiente de teste, revisar as políticas RLS e restringir transições de status via funções RPC.
3. Integrar o front-end a Supabase Auth, Postgres e Storage. Nunca colocar a `service_role` key no navegador; usar somente a chave publicável/anon com RLS.
4. Configurar buckets privados/públicos conforme o tipo de mídia, validação de upload e regras de tamanho.
5. Conectar um provedor de pagamentos via checkout hospedado e webhooks assinados no servidor.
6. Implementar testes de fluxo e segurança, depois publicar em domínio HTTPS.

## O que preciso do proprietário para ativar serviços reais
- Acesso ao projeto Supabase (ou autorização para orientar a criação); não envie senhas no chat.
- Escolha/conta do provedor de pagamentos e definição de taxas, cancelamentos e reembolsos.
- Regras comerciais e contratos para academias, restaurantes, profissionais e entregas.
- Política de privacidade, termos, canal de suporte e responsável por moderação.

## Referências de segurança
Use as recomendações atuais da OWASP para autenticação e gestão de sessão. Tokens de autenticação não devem ser armazenados em `localStorage`; a sessão precisa ser gerenciada por solução de autenticação segura e validada no servidor.
