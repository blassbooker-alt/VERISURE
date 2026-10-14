# Fortalfy v17 — Identidade sonora

## Áudios incluídos
- `assets/fortalfy_notificacao.mp3`: notificação padrão, lembretes e atualizações de agendamento.
- `assets/fortalfy_pagamento.mp3`: som reservado para pagamento/assinatura confirmados. Não tocar em uma preferência de pagamento ou intenção de compra, pois isso não confirma cobrança.
- `assets/fortalfy_mensagem.mp3`: mensagem recebida e confirmações de conversa.

## Como testar
1. Abra `index.html` em um navegador.
2. Entre na demonstração e abra o menu da conta > Configurações.
3. Use os três botões em “Testar identidade sonora”.
4. “Sons do aplicativo” pode silenciar os sons neste dispositivo.

## Limitações importantes
- Os três áudios estão incluídos localmente e podem ser pré-visualizados.
- O som padrão de notificação toca nas ações locais de criar/atualizar uma solicitação de agendamento.
- Não existe ainda servidor de push, mensagens em tempo real ou provedor de pagamento integrado. Portanto, o som de mensagem recebida e o de pagamento não são disparados automaticamente por eventos reais remotos; o de pagamento só deve ser conectado a uma confirmação verificada do provedor no backend.
- O estado atual é uma demonstração local, não uma implementação de produção.
