# Próxima etapa para produção

1. Criar projeto Supabase e tabelas `profiles`, `professional_verifications`, `appointments`, `professional_posts`, `reviews`.
2. Usar Supabase Auth para cadastro, login, recuperação de senha e sessões. Nunca armazenar senhas em `localStorage`.
3. Criar Row Level Security: cliente lê apenas os próprios agendamentos; profissional lê solicitações atribuídas a ele; apenas o profissional atribuído pode mudar status.
4. Implementar estados de agendamento com transições permitidas, validação de disponibilidade e prevenção de dupla reserva no banco.
5. Adicionar verificação administrativa de CRN/CREF e aprovação antes de publicar perfil.
6. Armazenar fotos no Storage privado/público conforme política e validar tipo, tamanho e consentimento.
7. Implementar notificações por e-mail/push, cancelamento, histórico e trilha de auditoria.
8. Testar autorização entre contas, tentativas de acesso indevido, responsividade, acessibilidade e LGPD.
9. Só então ativar reservas reais; pagamentos devem usar checkout de provedor com webhooks verificados.
