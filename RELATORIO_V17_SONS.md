# Relatório de engenharia — Fortalfy v17

- Adicionados os três arquivos MP3 enviados pelo usuário na pasta `assets/`.
- Criado helper de reprodução de áudio e controles de pré-visualização nas Configurações.
- Adicionada opção local para ativar/silenciar sons.
- Vinculado o som de notificação a ações demonstrativas de solicitação e atualização de agendamento.
- O som de pagamento não é acionado por seleção de forma de pagamento, porque isso não significa pagamento confirmado.
- Sintaxe JavaScript validada com Node.js (`new Function` sobre o script inline).
- Não foram realizados testes E2E em navegador nem integração com backend/push/pagamentos reais.
