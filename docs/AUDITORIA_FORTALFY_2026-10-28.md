# Estudo do Fortalfy — 28/10/2026

## Escopo e limites

Revisão do app publicado em `https://fortalfy.com.br`, do mapa de rotas e componentes do frontend, dos serviços de domínio, das migrações versionadas, do workflow de publicação e dos documentos de auditoria/configuração existentes. Foram abertas no site as rotas públicas de início, treino, diário alimentar, Feed, pessoas, mensagens, FortalFood, FortalPass, perfil, loja, criador, Academy, configurações, termos, parcerias, transmissões e desempenho.

Esta revisão não autenticou uma conta, não comprou produtos, não criou cadastros reais, não consultou o painel Supabase nem verificou o estado real do banco em produção. A segurança de todas as tabelas não pode ser certificada apenas pelos arquivos locais.

## Atualização de correções locais — 28/10/2026

- A rota `/pass` agora renderiza `LivePassScreen`, que usa o catálogo de parceiros aprovados e separa a prévia demonstrativa da lista real.
- Foi adicionado um teste estático que encontra links internos JSX sem destino registrado.
- A sacola agora consegue recuperar produtos conhecidos de linhas legadas sem snapshot e preserva o SKU nos novos snapshots; IDs de produto desconhecidos continuam fora do subtotal.
- O teste do pacote de imagens foi atualizado para distinguir o pacote principal de 82 imagens da galeria demonstrativa adicional.
- O workflow de publicação agora executa `npm test` antes do build, impedindo que a publicação avance quando as regras automatizadas falharem.
- O cadastro de parceiros foi reorganizado localmente em quatro etapas curtas; agora mantém a etapa ao persistir rascunhos, valida obrigatórios da etapa atual, exige documento antes da revisão e permite substituir anexos quando há reprovação/correção.
- Foi criado um fluxo separado de interesse em parceria: objetivos, produtos/serviços, modalidades de interesse, informações adicionais, estados próprios e fila de revisão administrativa. O envio e as decisões usam RPCs do banco; a migração foi criada localmente, sem aplicação remota.
- Validação local: 141 testes passaram; `npm run build` concluiu; a prévia de `/#/pass` abriu FortalPass, `/#/professional` exibiu as seis categorias e o card de Academia direcionou à etapa correta de cadastro. Nenhuma conta foi criada ou usada.
- Estas correções não foram enviadas ao GitHub nem publicadas. Nenhuma conta real foi usada e nenhum banco remoto foi alterado.

## Revisão do cadastro profissional e de parceiros — 28/10/2026

### Perfis públicos de Personal e Nutricionista — implementação local

- Antes, “Ver perfil” dos cadastros aprovados abria o perfil social genérico; os modais de demonstração eram muito compactos no celular e continham conteúdo ilustrativo. Os modais continuam identificados como exemplos e tiveram a tipografia/ações móveis ampliadas.
- Os perfis demonstrativos já existentes de Personal e Nutricionista agora usam a mesma estrutura profissional espaçosa: cabeçalho de identidade, aviso claro de demonstração, apresentação, áreas, metodologia/abordagem, público, etapas e dados ainda não verificados. No celular as seções são empilhadas e os botões ficam em largura total; agendamento continua desabilitado para exemplos. Os modais são montados na camada do documento e travam a rolagem de fundo, evitando ficarem posicionados abaixo da viewport em páginas compridas.
- A rota `/profile/:profileId` agora consulta um cadastro público aprovado em `partner_listings` e, quando encontrado, mostra uma página profissional para Personal/Nutricionista (e academia), com informações que já existem: nome, categoria, cidade, apresentação, modalidades/serviços cadastrados, horários cadastrados e site. Perfis marcados como privados foram removidos da descoberta pública.
- O endereço completo não é renderizado no perfil. Ações de solicitação de atendimento levam ao fluxo existente que grava a solicitação em `bookings`; a interface informa que o horário só está confirmado após resposta. Mensagens seguem o fluxo de conversas já existente.
- Se não houver parceiro aprovado para o ID, a rota preserva o perfil social comum. Falhas na leitura exibem estado de erro recuperável, em vez de anunciar que um perfil profissional foi carregado.
- Ainda não existem no modelo consultado dados estruturados de formação/registro para exibição pública, avaliações verificadas, galeria profissional, serviços individualizados com preço, disponibilidade sincronizada de agenda, favoritos profissionais nessa tela, FAQ ou denúncia do perfil. A página não inventa esses dados; avaliação de credenciais e validade do selo são limitadas ao estado de aprovação existente.
- Validação local após essa alteração: 142 testes passaram e o build Vite concluiu. A leitura do perfil usa mock de serviço nos testes; nenhum cadastro ou conta real foi acessado nesta validação.

### O que já existe no código local

- A entrada profissional reaproveita a conta Fortalfy existente; o cadastro não cria outra identidade de login. Os links de categoria levam à autenticação e retornam para a categoria escolhida.
- Existem formulários separados por categoria, rascunho persistido em `professional_applications`, envio via RPC do servidor, fila administrativa, decisão com justificativa e perfil público condicionado à aprovação.
- O bucket `professional-documents` é configurado como privado, com limite de 10 MB e PDF/JPG/PNG. O acesso administrativo gera URL assinada curta e registra auditoria, segundo os scripts SQL versionados na raiz.
- A seleção inicial agora destaca as seis categorias de negócio solicitadas e mantém Empresa e Fortalfy Creator em “Outras categorias”, preservando esses fluxos existentes.
- O formulário foi reorganizado em quatro etapas: dados de contato, dados específicos da categoria, documentos privados e revisão/consentimento. Cada avanço persiste o rascunho; agora a etapa bloqueia avanço sem seus campos obrigatórios e a etapa documental bloqueia sem arquivo.
- Os testes locais validam a lista das seis categorias e a existência de campos de formulário para cada uma.

### Pendências concretas para cumprir o fluxo completo do anexo

- **Homologar a solicitação de parceria:** agora existe um fluxo separado no frontend/serviço e uma migração local (`20261028190000_professional_partnership_requests.sql`) com estados, fila administrativa, validação no RPC, RLS e histórico de decisões. A migração não foi aplicada; o fluxo depende da tabela profissional criada pelos scripts SQL existentes na raiz. Não há evidência local de quais scripts foram aplicados no Supabase conectado.
- **Consentimento e base legal:** o fluxo informa que interesse enviado não é aprovação nem contrato, mas não coleta aceite de termos de parceria/privacidade com links válidos. Os documentos institucionais auditados continuam ausentes; não inventei texto jurídico nem versionamento de consentimento.
- **Revisão por documento:** a tabela de documentos registra tipo e arquivo, mas a interface não apresenta um status individual como recebido, aprovado, recusado ou correção solicitada para cada documento. O estado atual é principalmente da candidatura inteira.
- **Histórico e aviso de mudança:** a nova solicitação grava decisões administrativas em tabela de auditoria e mostra o status/última justificativa quando o titular volta à área profissional. Ainda não há histórico visível completo nem notificação automática ao titular quando esse status muda; a fila administrativa também mostra apenas pendências para ação.
- **Coleta excessiva de endereço:** os campos comuns e a RPC de envio exigem país, estado, cidade, bairro, logradouro, número, CEP e tipo de endereço em todas as categorias, inclusive profissionais autônomos. Isso diverge do princípio de coletar apenas o necessário e da possibilidade de informar apenas área de atendimento.
- **Dados setoriais incompletos:** existem campos básicos específicos (por exemplo, CRN/CREF, especialidade, culinária, modalidade e horários), mas ainda não há fluxo completo para galerias/fotos, menu estruturado, catálogo/variações, disponibilidade, atendimento/entrega, planos e outros atributos do anexo.
- **Base legal não confirmada:** a tela atual pede aceite genérico de “políticas aplicáveis”; o material auditado não comprova termos gerais, privacidade e condições de parceria disponíveis e aprovados. Não devo criar texto jurídico ou afirmar consentimento informado sem esses documentos.
- **Validação de arquivo:** cliente e SQL conferem MIME declarado, extensão/tamanho aceitos e existência do objeto, mas não há evidência de análise de conteúdo real do arquivo ou varredura antimalware.
- **Validação ponta a ponta:** cadastro, confirmação de e-mail, upload, geração de URL assinada, revisão administrativa, histórico e notificação precisam ser exercitados com contas isoladas de homologação. Nenhuma conta real foi usada nesta revisão.

Essas pendências exigem implementação local de um fluxo de parceria separado e políticas testáveis, além de configuração/documentos e contas de homologação. Nenhum banco remoto foi alterado durante esta etapa.

## Achados prioritários

### P0 — FortalPass estava quebrado por rota ausente (corrigido localmente)

Na versão publicada observada durante a auditoria, `https://fortalfy.com.br/#/pass` abria “Página não encontrada”. A rota não constava no `<Routes>` de `web/src/App.jsx`, embora o menu, a landing page, botões, cards e links de retorno apontassem para `/pass`. A rota foi registrada localmente para renderizar `LivePassScreen`; o build, o teste de rotas e a abertura da prévia local confirmaram a tela. A publicação continua sem essa correção até um deploy autorizado.

**Estado e próximo passo:** a rota local aponta para `LivePassScreen` e os links internos foram cobertos por um teste estático. Antes de publicar, validar a navegação no ambiente de homologação e decidir se `PassScreen` deve ser removido ou mantido como componente legado.

### P1 — A publicação está atrás da versão local na entrada de conta

Na versão publicada, “Entrar” e “Começar agora” da landing apontam para `#/feed`; ali é necessário clicar novamente para abrir login ou cadastro. O checkout local já altera esses destinos para `#/profile` em `web/src/App.jsx`, mas a diferença aparece como alteração não publicada no Git. Portanto, o site ao vivo ainda tem a jornada antiga.

**Correção:** após validar o caminho direto para `#/profile`, publicar essa mudança junto com a correção da rota FortalPass. Não anunciar que a mudança está no ar antes do deploy.

### P1 — Faltam páginas institucionais essenciais para confiança

O rodapé público oferece “Termos e benefícios” e contato por `fortalfy@gmail.com`. A página de termos aberta é uma declaração de aceite para descontos; não substitui termos gerais de uso nem uma política de privacidade. A configuração de e-mail do projeto documenta o remetente `suporte@fortalfy.com.br`, diferente do endereço de contato visível no site. Não encontrei no frontend uma página de privacidade ou identificação institucional (razão social, CNPJ e canal responsável).

**Correção:** publicar termos de uso e privacidade com escopo claro sobre conta, mensagens, fotos, registros de treino/alimentação, notificações e localização; identificar a entidade responsável e canal para solicitações; padronizar um endereço de suporte no domínio. Revisar os textos com assessoria jurídica antes de apresentá-los como documentos finais.

### P1 — A vitrine promete mais disponibilidade do que a rede publicada entrega

Na inspeção pública, a FortalPass dá 404; FortalFood mostra anúncios identificados como demonstrativos e pede login para consultar cardápios; a Academy diz que ainda não há cursos; Fortal Live informa zero transmissões; a vitrine de academias parceiras diz que está sendo preparada; e a loja usa produtos de referência/demonstração sem vendedor e disponibilidade confirmados. Os avisos evitam fingir vendas ou conteúdo ativo, mas a quantidade de áreas vazias reduz a confiança na proposta de uma plataforma já operacional.

**Correção:** publicar primeiro um conjunto pequeno de serviços com oferta real e suporte operacional. Na página inicial, separar claramente “disponível agora”, “em fase piloto” e “em preparação”, com datas ou critérios concretos apenas quando confirmados. Não usar depoimentos, números de usuários, selos, ofertas ou parceiros sem comprovação e autorização.

### P1 — Fluxos reais de conta, e-mail e operação ainda precisam de validação de ponta a ponta

O documento `CONFIGURACAO_EMAILS_FORTALFY.md` registra que a entrega de confirmação/recuperação e a troca de senha ainda precisavam ser testadas com uma conta controlada. A auditoria anterior também registra que não houve teste com contas reais de cliente/profissional após a restrição de escrita em agendamentos. Navegar até os formulários não confirma cadastro, entrega de e-mail, recuperação, permissões ou consulta de histórico em produção.

**Correção:** manter contas controladas e validar cadastro, OTP, reenvio, recuperação, login, exclusão/alteração de perfil, publicação social, upload de mídia, pedido, cancelamento e jornada profissional. Registrar resultados, ambiente, data e limitações sem armazenar dados pessoais nos relatórios.

### P1 — Segurança do banco não está coberta por uma trilha única e verificável

O histórico do projeto contém vários scripts SQL na raiz e somente três arquivos em `supabase/migrations`. O workflow de GitHub Pages constrói e publica o frontend; ele não aplica nem valida as migrações do banco. O relatório V20 diz que a análise remota de RLS cobriu especificamente `public.bookings`, e recomenda revisar as demais tabelas. Logo, não há evidência local suficiente para afirmar que todas as tabelas/funcionalidades publicadas têm o mesmo schema e políticas de segurança esperados.

**Correção:** consolidar o histórico em migrações ordenadas e idempotentes, documentar quais foram aplicadas em cada ambiente e auditar RLS/grants/views/RPC/storage de cada domínio. Para agendamentos, manter transições de estado no servidor com papéis e campos permitidos; não reabrir escrita direta ampla no cliente.

## Melhorias importantes, sem evidência de incidente

### Qualidade e acessibilidade

O projeto já tem configurações de foco, movimento reduzido, estados de diálogo e preferências de acessibilidade; mesmo assim, a auditoria V20 registra que contraste automatizado, teclado e leitor de tela em claro/escuro não foram verificados de ponta a ponta. Criar uma passagem por teclado e leitor de tela para login, formulários, menus, diálogos, Feed, filtros e upload; medir contraste em ambos os temas e testar larguras pequenas.

### Testes e publicação (testes incluídos no workflow; smoke test ainda pendente)

Há testes unitários para serviços e lógica, e `.github/workflows/pages.yml` agora executa `npm test` antes do build. Ainda não há smoke test de navegador nem teste visual. Uma rota principal ausente passou anteriormente pelo workflow porque o build, sozinho, não confere se cada link de navegação tem destino.

**Próximo passo:** ampliar os testes para estados sem dados/erro/carregamento e adicionar um smoke test de navegador pós-build. O teste estático de rotas já verifica links JSX sem destino registrado, sem depender de uma conta de produção.

### Manutenção do frontend

O frontend concentra 14.043 linhas/986 KB de CSS em `web/src/styles.css`, 2.458 linhas/230 KB em `web/src/App.jsx` e 2.987 linhas/185 KB em `web/src/SocialScreens.jsx`. Há componentes antigos sem rota ativa, incluindo as implementações `PassScreen` e `LivePassScreen`. Esse tamanho aumenta o custo de encontrar regras efetivas e facilita divergência entre componentes antigos e atuais.

**Correção:** separar telas e estilos por domínio/rota, remover código comprovadamente sem uso e adotar limites para arquivos/componentes novos. Fazer isso de forma incremental, com testes de rotas e comparação visual para evitar regressões.

### GitHub e apresentação técnica

O repositório público ligado ao projeto aparece como `blassbooker-alt/VERISURE`, sem descrição, site ou tópicos no perfil público do GitHub. O nome não identifica Fortalfy e prejudica a apresentação para parceiros ou colaboradores que consultem o código.

**Correção:** adicionar descrição, URL oficial, tópicos e README de entrada com arquitetura, configuração segura, ambiente de demonstração, estado real das integrações e como contribuir. Avaliar renomear para Fortalfy; antes, revisar links, workflow, domínio e instruções de clonagem.

## O que já está bem encaminhado

- O Feed de visitante declara que não exibe atividade de demonstração como se fosse real.
- Loja, anúncios de alimentação, perfis de exemplo e campanhas identificam dados ilustrativos ou indisponibilidade.
- O aceite de benefícios esclarece que assinatura e checkout ainda não estão ativos e que percentuais previstos não são promessa de desconto real.
- O diário alimentar informa quando não há dados e distingue ausência de registro de consumo zero.
- A aprovação de perfis e o selo são baseados em campos de aprovação, em vez de atribuí-los visualmente a todas as contas.
- O código mostra intenção de restringir alterações sensíveis no servidor e documenta limitações em vários fluxos.

Essas práticas devem ser preservadas ao preencher as áreas vazias: conteúdo real, autorizado, com origem e disponibilidade confirmadas.

## Sequência recomendada

1. Corrigir e testar a rota `/pass` e todos os links que dependem dela.
2. Publicar a entrada de conta que já está ajustada no checkout local.
3. Publicar termos gerais, privacidade, identificação institucional e contato consistente.
4. Escolher quais áreas têm oferta operacional; rotular e reduzir destaque das áreas em preparação.
5. Validar autenticação/e-mails e fluxos de cliente/profissional com contas controladas.
6. Auditar RLS e permissões por tabela e organizar migrações aplicadas por ambiente.
7. Automatizar testes de rotas, estados da interface, acessibilidade e smoke test no workflow.
8. Organizar o repositório e refatorar os arquivos maiores gradualmente.

## Referências locais consultadas

- `web/src/App.jsx` — landing, mapa de rotas, navegação e telas antigas.
- `web/src/SocialScreens.jsx` — login/cadastro, Feed, Reels, mensagens e estados de visitante.
- `web/src/BenefitsTerms.jsx`, `web/src/shopData.js`, `web/src/WeeklyPlans.jsx` — termos/limitações de benefícios, catálogo e treino.
- `web/src/supabaseClient.js`, `supabase/migrations/` e scripts SQL na raiz — configuração de backend e histórico disponível.
- `.github/workflows/pages.yml` — build/deploy de GitHub Pages.
- `RELATORIO_AUDITORIA_V20.md` e `CONFIGURACAO_EMAILS_FORTALFY.md` — auditorias e pendências registradas anteriormente.

## Portfolio scope correction

The premium experience is now limited to `/partner/personal/:profileId` and `/partner/nutritionist/:profileId`, reached only from the Personal and Nutritionist directories. The generic `/profile/:profileId` social route and the Academy, restaurants, stores, and other partner routes retain their previous experience.

The profile lookup requires the expected category, approved status, and a public profile. Existing shared directory privacy filtering remains unchanged. Pages show stored information when available and identify reviews, credentials, methodology, and gallery as unavailable when real records do not exist. Appointment requests do not guarantee availability. Sharing uses the browser API or link copy; favorites are stored only on this device and do not sync.

Validation for this scope correction: 143 tests and the Vite build passed. Both category directories and their demo flows were checked in the local mobile preview. No approved real profile was available for browser validation of the premium page. No menu, remote database, or published site was changed.
