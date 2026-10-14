# Fortalfy v11 — experiência de app, perfis e feed

## O que mudou
- Cadastro passa diretamente para a área logada, sem pedir novo login.
- Enquanto houver sessão salva neste navegador, a pessoa permanece no app. Para sair, abra **Perfil** e clique em **Sair da Fortalfy**.
- Após login, a landing page de marketing é escondida para reduzir a confusão e mostrar o painel do app.
- Área de profissionais com cards visuais, fotos ilustrativas e perfis públicos clicáveis pelo nome/foto/botão.
- Perfis demonstrativos de nutricionista, personal trainer, academia, restaurante e marca parceira.
- Feed inicial preenchido com publicações fictícias e fotos para visualizar o layout. Novas publicações profissionais continuam disponíveis.
- Área Meu perfil permite alterar nome, telefone, cidade, foto de perfil e capa. Perfil comercial/profissional pode editar apresentação pública.
- Selos de demonstração são explicitamente marcados como demo. Nenhum selo real de verificação ou parceria é concedido automaticamente.
- Ajustes de layout responsivo para feed e cartões.

## Como testar
1. Extraia o ZIP.
2. Abra `fortalfy_v10/index.html` no navegador.
3. Crie uma conta. Você deve entrar direto no painel.
4. Abra **Encontrar profissionais** e clique na foto ou no nome dos perfis.
5. Abra **Feed da comunidade profissional** na lista de profissionais ou **Meu feed profissional** (se a conta for personal/nutricionista).
6. Abra **Meu perfil**, altere fotos e dados e salve.
7. Para sair, somente pelo botão **Sair da Fortalfy** dentro do perfil.

## Limitações importantes
É um protótipo estático com `localStorage`. Contas, sessão, imagens e publicações ficam apenas no navegador e não sincronizam com outros aparelhos. Os perfis, fotos, preços, publicações, avaliações e selos marcados como demonstração são fictícios. Verificação de identidade/registro profissional, aprovação de parceiros, autenticação segura, banco compartilhado, notificações e upload real exigem backend e revisão operacional antes de produção. Não usar senha reutilizada nem dados reais sensíveis.
