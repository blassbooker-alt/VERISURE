# E-mails transacionais Fortalfy

## Estado da implementação

O fluxo de confirmação por código e de recuperação de senha usa o Supabase Auth já integrado ao aplicativo. O código de confirmação é emitido e validado pelo Supabase; o app não cria nem valida códigos localmente. A redefinição de senha exige uma sessão de recuperação válida, confirmação da nova senha e atualização via Supabase Auth.

Implementado no código local:

- Cadastro encaminha para confirmação quando o Supabase não cria uma sessão imediatamente.
- Campo de OTP aceita colagem do código completo sem pressupor uma quantidade fixa de caracteres.
- Reenvio usa `auth.resend` com tipo `signup` e espera de 60 segundos na interface.
- Recuperação direciona para `https://fortalfy.com.br/#/profile`, apresenta campos para nova senha e confirmação e não permite atualização sem sessão de recuperação.
- Links inválidos/expirados voltam à tela de recuperação com mensagem explicativa.
- Templates responsivos de confirmação e recuperação foram preparados em `supabase/templates/`.
- Assuntos em português foram definidos em `supabase/config.toml`.

## Configuração de produção verificada

No projeto Supabase FORTALFY (`pfmioxdeirbsvqrvoekw`), foi salvo:

- **Site URL:** `https://fortalfy.com.br/`
- **Redirect URL adicional:** `https://fortalfy.com.br/`
- A URL existente do GitHub Pages foi preservada na lista de redirecionamentos.
- **Custom SMTP:** habilitado e apontando para `smtp.resend.com`, porta `465`, usuário `resend`.
- O remetente SMTP já existente permanece `suporte@fortalfy.com.br` com nome `fortalfy`. A senha SMTP não foi lida nem alterada.

## Pendências que precisam ser concluídas antes de ativar os novos templates

1. **DNS atualizado em 18/10/2026:** no Registro.br foram adicionados os registros exatos da equipe Resend `fortalfy`, sem remover nem alterar os apontamentos A/AAAA/CNAME do GitHub Pages:
   - `resend._domainkey` TXT — chave DKIM gerada pelo Resend.
   - `rsend` CNAME → `rsend-sae1.forge.rmta.net`.
   - `send` CNAME → `send.forge.rmta.net`.
   - `_dmarc` TXT → `v=DMARC1; p=none;`.
   Consultas públicas via Google Public DNS confirmam os quatro valores. Em 18/10/2026, o Resend marcou o domínio `fortalfy.com.br` como **verified** e informou que está pronto para enviar e-mails.
2. O SMTP customizado do Supabase está habilitado com host `smtp.resend.com`, porta `465` e usuário `resend`. O remetente mantido é `suporte@fortalfy.com.br` com nome `fortalfy`; essa configuração foi confirmada após atualizar o painel. A credencial SMTP permanece oculta e não foi alterada. Nunca colocá-la no frontend ou no repositório.
3. Publicar a versão do aplicativo com confirmação por OTP antes de instalar o template de confirmação abaixo. O template de produção ainda não foi substituído: enviar OTP enquanto a versão pública não aceita o código bloquearia novos cadastros.
4. Após publicar o app, abrir **Supabase → Authentication → Emails → Templates** e instalar `supabase/templates/confirmation.html` em **Confirm signup** e `supabase/templates/recovery.html` em **Reset password**. Os assuntos correspondentes estão em `supabase/config.toml`. Os templates locais precisam ser copiados pelo painel do projeto remoto; alterações em arquivos locais não atualizam os templates de produção automaticamente.
5. Criar uma conta de teste controlada e registrar a entrega no Resend. Confirmar signup, código incorreto/expirado/reutilizado, reenvio, recuperação de senha, link inválido/expirado, troca de senha e login com a senha nova. Não foi enviado e-mail de teste nem criada conta real nesta revisão. Os formulários publicados foram abertos no site; os templates ativos foram conferidos em preview. O envio e a troca final de senha ainda não foram testados ponta a ponta.

## Testes executados

- `npm.cmd test`: 107 testes passaram, 0 falharam.
- `npm.cmd run build`: build de produção concluído.
- Cobertura adicionada para a chamada de `verifyOtp` de signup (token sem tamanho fixo) e para o reenvio via `resend` com tipo signup.

Os testes automatizados e o build não comprovam entrega de mensagens. O domínio e o remetente SMTP estão configurados, mas a entrega real e o fluxo de troca de senha permanecem pendentes de teste com uma conta controlada.

## Referências oficiais

- [SMTP personalizado no Supabase](https://supabase.com/docs/guides/auth/auth-smtp)
- [Templates de e-mail do Supabase Auth](https://supabase.com/docs/guides/auth/auth-email-templates)
- [URLs de redirecionamento do Supabase Auth](https://supabase.com/docs/guides/auth/redirect-urls)
- [Domínios no Resend](https://resend.com/domains)
