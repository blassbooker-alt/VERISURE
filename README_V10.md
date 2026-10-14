# Fortalfy v10 — fluxo demonstrativo de agendamentos

## O que foi acrescentado
- Solicitações com identificador, nome/e-mail do cliente, data, hora, modalidade e status.
- Área do cliente exibe status da solicitação.
- Agenda profissional apresenta solicitações da categoria compatível e permite marcar Confirmada, Recusada ou Concluída.
- Validação básica de categoria profissional antes de alterar status.
- Mantém avisos claros de que os dados são locais e não representam uma reserva real.

## Como testar
1. Abra `index.html` no navegador e crie uma conta Cliente.
2. Entre, abra Encontrar profissionais e solicite uma consulta/treino com data futura.
3. Saia e crie uma conta Personal trainer ou Nutricionista, conforme o tipo solicitado.
4. Abra Agenda profissional e altere o status da solicitação correspondente.
5. Entre novamente como cliente e abra Meus agendamentos para ver o status atualizado.

## Limitações importantes
A demonstração usa `localStorage`: o fluxo só compartilha os dados entre perfis no mesmo navegador e dispositivo. Não existe autenticação segura de servidor, agenda online, notificação ou confirmação real. Não use para armazenar informações sensíveis nem para agendamentos reais.
