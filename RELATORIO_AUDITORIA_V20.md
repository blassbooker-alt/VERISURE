# Auditoria técnica Fortalfy — 18/10/2026

## Escopo e evidências

Revisão do frontend React/Vite, dos fluxos e rotas principais, do build, dos testes automatizados, da interface responsiva e das políticas de `public.bookings` no projeto Supabase FORTALFY. A inspeção remota começou em modo somente leitura. Após confirmar a regra insegura e a autorização do usuário para corrigi-la, apliquei a restrição de escrita descrita abaixo no Supabase de produção.

## Alterações realizadas

- Dividi telas pesadas em módulos carregados sob demanda. O bundle principal caiu de 696,53 kB (206,42 kB gzip) para 304,00 kB (95,49 kB gzip), redução aproximada de 56% no JavaScript principal.
- Incluí estado acessível de carregamento nas trocas de rota e respeitei `prefers-reduced-motion` na animação.
- Removi a sombra pesada dos textos do menu lateral e ajustei peso/altura de linha para leitura mais limpa.
- Removi a localização estática “Aldeota, Fortaleza” do cabeçalho, que sugeria localização real sem consultar o usuário. FortalPass mantém o botão funcional de localização com consentimento.
- Restrição de alterações diretas em agendamentos aplicada ao Supabase; a migração equivalente está versionada no repositório.

As mudanças de carregamento sob demanda e remoção do rótulo de localização estão apenas no checkout local até sincronizar com o GitHub. A correção anterior da sombra foi publicada em uma execução anterior do deploy; esta revisão não publicou uma nova versão.

## Segurança: prioridade alta

Na auditoria inicial, o RLS estava habilitado em `public.bookings`, mas a política `involved user updates booking` permitia que cliente ou profissional atualizasse qualquer coluna da própria linha. Isso incluía potencialmente status, preço, horário e outros campos. O SQL original já alertava que transições de status devem ser restringidas no servidor. A interface atual lê agendamentos e não precisa de atualização direta pelo cliente. A política foi removida na correção aplicada.

A inspeção também encontrou privilégios diretos de `UPDATE` e `DELETE` para `anon`, além de `UPDATE` para `authenticated`. As políticas RLS atuais não dão uma política de exclusão, e a de atualização exige que o usuário autenticado seja cliente ou profissional vinculado. Ainda assim, permissões amplas aumentam o risco de uma política futura permissiva tornar a tabela alterável.

Executei [FORTALFY_BOOKINGS_CLIENT_WRITE_RESTRICTION_V1.sql](./FORTALFY_BOOKINGS_CLIENT_WRITE_RESTRICTION_V1.sql) no Supabase de produção. A verificação posterior confirmou: RLS permanece ativo; a política de atualização foi removida; seguem apenas a leitura para cliente/profissional envolvido e a criação autenticada pelo próprio cliente; `UPDATE` e `DELETE` deixaram de ser concedidos a `anon` e `authenticated`. A permissão `INSERT` continua concedida, mas a política exige `auth.uid() = customer_id`; chamadas anônimas não satisfazem essa condição. Não testei marcação real com uma conta de cliente/profissional. Quando o app precisar alterar status, implementar RPC transacional com validação de papel, estado anterior e campos permitidos.

## Desempenho e experiência

- O build agora divide telas grandes por rota e não emite aviso de chunk JavaScript acima do limite configurado.
- O vídeo de abertura continua com cerca de 1,53 MB e o áudio WAV com 1,41 MB. Recomendo evitar reproduzir o vídeo em toda visita, permitir pular imediatamente e gerar áudio em formato comprimido; não mudei esses recursos para preservar o comportamento atual.
- A loja informa que os preços são referenciais e não oferece checkout/pedido real; assinaturas e repasses também não devem ser apresentados como concluídos sem integração financeira. Manter essa transparência evita prometer uma transação inexistente.
- O README contém uma observação antiga sobre TLS do domínio que não representa a verificação anterior de `https://fortalfy.com.br`; revisar a documentação na próxima atualização.

## Validação

- `npm.cmd test`: 105 testes passaram, 0 falharam.
- `npm.cmd run build`: concluído com sucesso.
- Smoke test manual: 15 rotas carregaram conteúdo sem ficar presas no estado de carregamento.
- Larguras verificadas no catálogo: 360, 390, 768, 1024 e 1440 px, sem overflow horizontal.
- Limitações: não foi feito teste com contas reais em todas as jornadas, cálculo automatizado de contraste, teste completo de teclado/leitor de tela, teste de compra/pagamento, nem auditoria abrangente de todas as políticas/tabelas RLS. A leitura remota cobriu especificamente `public.bookings`.

## Próximas prioridades

1. Validar com contas de teste o fluxo de criação e consulta de agendamentos após a restrição; implementar RPC segura antes de reativar atualizações de status.
2. Sincronizar as alterações locais com a branch remota antes do próximo deploy. O checkout está divergente e a tentativa de `git fetch` não autenticou; não substituí arquivos remotos nem forcei publicação.
3. Comprimir/retirar o vídeo de abertura repetido e converter o áudio para formato eficiente.
4. Fazer auditoria de contraste, foco, navegação por teclado e leitor de tela em claro/escuro, seguindo WCAG 2.2.
5. Conferir o estado atual de cada migração e política das demais tabelas Supabase; histórico e documentação local não bastam para certificar o banco remoto inteiro.

## Referências

- [WCAG 2.2 — W3C](https://www.w3.org/TR/WCAG22/)
- [Web Vitals — web.dev](https://web.dev/articles/vitals)
- [OWASP ASVS](https://owasp.org/projects/asvs/)
- [OWASP Top 10](https://owasp.org/Top10/)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Material Design — accessible design](https://m3.material.io/foundations/accessible-design/overview)
