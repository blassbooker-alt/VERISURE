# Notificações Fortalfy

## O que esta entrega inclui

- Central persistida por conta, com filtros, estado de leitura, atualização em tempo real e abertura do destino indicado.
- Preferências por categoria, horário silencioso, som no app aberto e vibração compatível.
- Inscrição Web Push por dispositivo, com suporte a navegadores compatíveis e PWA instalado.
- Gatilhos para curtidas, comentários, respostas, menções, novos seguidores, mensagens diretas, agendamentos, aprovação/revisão profissional e atualização de pedidos FortalShop/FortalFood.
- Fila assíncrona Supabase, tentativas com espera progressiva, deduplicação em grupos de atividade, auditoria e revogação de assinaturas expiradas.

## Implantação Supabase necessária

A migração ainda precisa ser aplicada ao projeto antes de a central por conta e a entrega real funcionarem. Execute `FORTALFY_NOTIFICATIONS_V1.sql` no SQL Editor depois das migrações de base indicadas no cabeçalho do arquivo. A migração cria extensões/tabelas, políticas RLS e agenda o dispatcher do `pg_cron`.

O envio real requer os seguintes segredos na Edge Function `fortalfy-push-worker`:

- `FORTALFY_PUSH_WORKER_SECRET`: segredo aleatório longo compartilhado com o dispatcher.
- `WEB_PUSH_VAPID_PUBLIC_KEY` e `WEB_PUSH_VAPID_PRIVATE_KEY`: par VAPID gerado para a Fortalfy.
- `WEB_PUSH_CONTACT`: contato `mailto:` para o provedor push.
- `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`: segredos padrão do Supabase, usados apenas no servidor.

Configure os segredos pelo painel ou CLI do Supabase. Nunca coloque chave privada, service role ou segredo do worker em variáveis `VITE_` nem no navegador.

No Supabase Vault, crie os dois segredos usados pelo dispatcher, com estes nomes exatos:

- `fortalfy_push_worker_url` = `https://<project-ref>.supabase.co/functions/v1/fortalfy-push-worker`
- `fortalfy_push_worker_secret` = o mesmo valor de `FORTALFY_PUSH_WORKER_SECRET`

Pelo SQL Editor, a criação tem este formato (substitua os valores localmente e não os envie em chats ou commits):

```sql
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/fortalfy-push-worker', 'fortalfy_push_worker_url');
select vault.create_secret('<mesmo segredo longo configurado na Edge Function>', 'fortalfy_push_worker_secret');
```

Crie cada nome apenas uma vez; para rotacionar um segredo já existente, use a tela do Vault ou `vault.update_secret` pelo ID correspondente. Mantenha `vault` e `net` fora dos schemas expostos pela API do projeto.

A função está marcada `verify_jwt = false` no `supabase/config.toml`; ela valida o segredo próprio em tempo constante antes de processar a fila. Publique a função e depois faça um build do site com `VITE_WEB_PUSH_PUBLIC_KEY` igual à chave pública VAPID:

```powershell
supabase functions deploy fortalfy-push-worker
$env:VITE_WEB_PUSH_PUBLIC_KEY = "<VAPID public key>"
cd web
npm run build
```

A publicação da função, migração do banco, configuração de Vault/segredos e rebuild não foram executados nesta alteração. Até essas etapas serem concluídas, o app continua utilizável; a central da conta informa que falta aplicar a migração e o push não pode ser ativado.

## Áudio e limitações de plataforma

`web/public/assets/fortalfy-notificacao-profissional.mp3` é reproduzido somente quando uma nova notificação chega com o app aberto, a preferência de som ligada e a página fora do destino atual. O navegador pode bloquear áudio até existir interação do usuário.

O padrão Web Push não oferece uma opção portátil para escolher um arquivo de som quando o app está fechado. Nesse estado, Android/iOS usam o som configurado pelo sistema/navegador. A vibração também depende do navegador; o iOS pode ignorar essa opção. No iOS, Web Push exige um web app instalado na tela inicial em versões compatíveis do sistema.

A central e os avisos dentro do app não dependem de permissão do sistema. Se o navegador não oferecer Push API, o usuário ainda pode consultar os avisos persistidos depois da migração.

## Verificação por plataforma

Build e testes automatizados do projeto validam o app e os arquivos web. Verificação física de entrega push em Android/iOS, navegador fechado, instalação PWA e permissões exige implantar a migração/função, configurar VAPID e testar em aparelhos reais; isso não é simulado por build local.
