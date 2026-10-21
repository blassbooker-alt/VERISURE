# FortalCreator: integrações e estado

## Recursos existentes reutilizados

A candidatura de Creator usa o cadastro profissional já existente (`kind = influenciador`): rascunhos e estado no Supabase, revisão por contas com papel `admin` no `app_metadata`, histórico de decisões, evidências de revisão e upload para o bucket privado `professional-documents`. O portal valida CPF, idade mínima de 18 anos, links HTTPS, documentos e consentimento antes do envio. A revisão de audiência é manual; a política atual de seguidores tem padrão de 100.000 e pode ser configurada pela administração.

O item Creator consulta o estado atual dessa candidatura e encaminha para `/professional/manage?category=influenciador`, preservando o editor em etapas, revisão, envio e acompanhamento existentes. É necessário aplicar as migrações de perfis profissionais e `FORTALFY_PROFESSIONAL_ONBOARDING_V2.sql` no projeto Supabase de destino e configurar o bucket/políticas correspondentes.

Foi criada a migração aditiva `FORTALFY_CREATOR_PROGRAM_V1.sql` para configuração de níveis e snapshots de métricas, autorização de professores, cursos/aulas/matrículas e histórico de pedidos, agenda/inscrições de lives e campanhas/candidaturas com trilha de decisões. RLS limita dados pessoais ao titular/equipe autorizada; matrículas gratuitas, inscrição em lives restritas e candidatura a campanhas são validadas por funções no servidor. Admins podem conceder papel de professor e gerir configuração/oportunidades. Professores autorizados podem criar cursos e agendas como rascunhos.

As telas Creator consultam essas tabelas, permitem inscrição gratuita, criam rascunhos de curso/aula, agendam lives sem transmitir e permitem publicar candidaturas em campanhas para criadores aprovados. Para ativar, aplicar a nova migração após as duas migrações citadas e validar no ambiente Supabase real.

## Dependências ainda abertas

1. **Reconhecimento facial:** não há fornecedor conectado. A aprovação existente é revisão manual de documentos e evidências; não declarar verificação biométrica concluída.
2. **Níveis Creator:** Start/Pro/Oficial e critérios configuráveis estão no esquema; valores iniciais permanecem inativos e sem métricas. Um processo confiável de ingestão/cálculo/atribuição precisa alimentar snapshots. Cursos e lives ficam fora do cálculo.
3. **Academia Creator:** catálogo, aulas protegidas, papel de professor, inscrições gratuitas e histórico de pedidos têm esquema/serviços. Não há checkout para cursos; cursos pagos permanecem sem botão de pagamento, e os pedidos só poderão ser ativados por integração de gateway/webhook.
4. **Lives privadas:** agenda e inscrições Creator têm esquema/RLS, incluindo validação de criador aprovado quando exigida. Não há provedor de vídeo nem emissão de tokens privados, portanto as inscrições não concedem acesso a uma transmissão.
5. **Campanhas e collabs:** publicação de oportunidades, candidaturas de criadores aprovados e decisões administrativas têm suporte no esquema. Não há integração logística, remuneração, inventário de produtos ou acompanhamento de entrega.

O Supabase de outras áreas e o checkout Mercado Pago da loja não ativam checkout de cursos automaticamente. Não simular pagamentos, métricas, transmissões ou reconhecimento facial.
