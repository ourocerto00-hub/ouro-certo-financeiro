# Fecha Real e fechamento mensal

O Fecha Real fica abaixo dos seis cartões do Dashboard e mostra toda a rede, independentemente do filtro de unidade.

- **Um lançamento simples:** somente o botão “Atualizar parcial do mês”, com gramas e lucro bruto faturado; sem justificativa manual. A competência selecionada aceita lançamentos antecipados, inclusive dezembro durante novembro. Os custos usados são os da competência escolhida, sem deslocar automaticamente as contas para outro mês.
- **Histórico acumulado:** todas as atualizações ficam registradas por competência, autor e horário. Editar preserva o evento original; apagar remove o lançamento da consulta ativa com evento de auditoria. Apagar o último faz o anterior voltar a valer; apagar todos retira o resultado daquele mês do gráfico. Registros de meses oficialmente fechados exigem reabertura antes de editar/apagar.
- **Acumulado informado:** soma somente o último valor ativo de cada competência. Atualizações sucessivas do mesmo mês não duplicam gramas. Os totais manuais históricos da versão anterior ficam separados e podem ser editados/apagados, sem somá-los automaticamente a competências que poderiam já estar incluídas.
- **Gráfico mensal:** um resultado por competência, utilizando o último parcial ativo ou o fechamento oficial vigente. Parciais são identificados e usam as obrigações atuais da competência; resultados oficiais continuam fixos. Não mostra cada atualização diária como se fosse outro mês.
- **Contas mensais:** mesma fonte `summary(state, month, 'all').total`: contas ativas por vencimento, remuneração por competência e despesas diárias. Inclui obrigações não pagas. Não soma de novo pagamentos de contas, salários ou vales. Contas pagas por data aparecem separadamente, apenas para consulta.
- **Logística:** contas do mês / gramas do mesmo mês, em R$/g. Zero ou ausência de gramas mostra “Não calculável”. Valores em centavos e miligramas inteiros, divisão com BigInt e arredondamento para centavo apenas na apresentação; quantidades aceitam até 0,001 g. Resultados fora do limite seguro são recusados.
- **Resultado:** lucro bruto externo - contas da competência. O bruto informado deve já descontar a compra do ouro no outro sistema. Resultado positivo tem sinal + e verde; negativo, sinal - e vermelho; zero é equilíbrio.

## Fechamento e correções

Disponível em qualquer dia e horário, inclusive para uma competência futura. Somente o administrador designado no servidor pode ver o Fecha Real, lançar, editar, apagar, fechar, reabrir e baixar seus PDFs. O administrador revisa gramas, lucro bruto e contas exatas, informa origem/justificativa e confirma uma declaração explícita. O custo é sugerido pelo sistema, pode ser ajustado sem alterar contas existentes e exige explicação se divergir ou se houver folhas ainda não conferidas.

O fechamento grava um retrato independente das obrigações, pagamentos informativos, pendências de folha, valores exatos, versão, autor, horário e justificativa. Mudanças posteriores nas obrigações não alteram esse retrato e produzem um alerta no painel. Para corrigir, reabrir com justificativa, revisar e confirmar novamente. A versão anterior permanece no histórico. O fechamento gerencial não bloqueia nem altera os fechamentos diários de caixa.

O administrador designado pode baixar um PDF parcial dos valores salvos antes de confirmar o fechamento oficial, em qualquer dia e horário. O parcial identifica “PARCIAL - NÃO OFICIAL”, usa os últimos valores salvos e as obrigações atuais da competência e não substitui uma versão oficial. Cada versão fechada também tem PDF A4 autenticado, gerado no servidor a partir do registro persistido. Versão vigente aparece como oficial; versões reabertas/substituídas são históricas. Inclui período, horário/fuso, contas, ouro do mês, logística, bruto, líquido e auditoria. Não exporta um formulário não salvo como oficial.

## Armazenamento e Railway

Sem migração de banco: campos opcionais são acrescentados ao JSON nas revisões já existentes. Estados antigos carregam sem mudança. O mesmo volume `/data` e `DATA_DIR` continuam necessários; nenhum comando de atualização deve apagar ou substituir banco ou uploads. Idempotência, revisão otimista, verificação de origem e sessão existentes cobrem as novas operações. Requisições concorrentes têm conflito 409 e não sobrescrevem um fechamento.

A implementação oficial da tela é `app/finance.jsx`. A cópia antiga `app/finance.tsx`, divergente e com erros de lint, foi removida; `page.tsx` importa explicitamente o JSX atualizado, preservando Contas Pagas, filtros, PDFs e bloqueio de submissão simultânea da V13.

## Verificação local

Executar `npm ci`, `npm test`, `npm run lint` e `npm run build`. Após o build, `node scripts/test-management-integration.mjs` inicia um servidor apenas em loopback e cria um SQLite novo em `work/management-http-*`, testa HTTP, permissões, conflito, reabertura, PDF e persistência após reinício e encerra o servidor. Não recebe URL de produção nem usa o banco existente. Os PDFs de teste ficam nessa pasta ignorada pelo Git. A checagem de lint mantém somente um aviso preexistente de dependências do efeito da tela financeira.


## Revisão visual e limites

Revisão no navegador em 1280 px e 390 px: formulário mensal salvo, fechamento de outubro confirmado com dados fictícios, resultado negativo em vermelho e sinal explícito; sem rolagem horizontal da página nem valores cortados nos seis indicadores. A revisão identificou valores monetários quebrados em colunas muito estreitas; o painel passou a usar três colunas no desktop e uma no celular. Os campos têm rótulos e confirmação vinculada, sem depender apenas da cor. Os PDFs A4 positivo e negativo foram abertos, renderizados e inspecionados, com cabeçalhos repetidos e paginação. Mantido o estilo escuro e dourado existente; não foi fornecido contexto de marca adicional.

Esta verificação usa dados fictícios e não atesta os números reais da empresa. Não houve login, lançamentos, migração ou alteração de variáveis/volume no Railway de produção. O fechamento oficial depende de conferência humana dos valores no outro sistema; não há integração automática com o fechamento da matriz.


## Vales por competência salarial

A lista Vales e Adiantamentos, seu total ativo e o PDF de vales selecionam a competência `advance.month`, independentemente da data do pagamento. Um vale da competência 2026-12 pago em novembro aparece em dezembro; a mesma regra vale para todos os meses e anos, incluindo janeiro do próximo ano. Cancelados ficam visíveis no histórico da tela, fora do total ativo e do PDF. Unidade e busca continuam aplicadas. O PDF identifica que o período é de competências, com a data de pagamento apenas informativa.

Os caixas, Contas Pagas e o cartão do Dashboard continuam por data efetiva do pagamento, agora identificada no cartão. A correção não altera registros, datas, competências, saldos ou deduções salariais, nem cria saídas adicionais. Foram testados todos os doze meses, a virada de ano, cancelamentos, unidade, busca, PDF e um vale de dezembro pago em novembro.


## Acesso exclusivo ao Fecha Real

Configurar `FECHA_REAL_ADMIN_EMAIL` apenas no serviço do Gestão Financeira, usando o e-mail de login da conta autorizada. Essa conta também precisa ter perfil `admin`. A identidade é conferida no servidor pela sessão autenticada e pelo e-mail configurado, nunca pelo nome de exibição ou por campos enviados pelo navegador. A configuração não contém um e-mail pessoal no repositório. Se estiver ausente ou vazia, o acesso permanece bloqueado.

Os demais usuários, inclusive outros administradores, não recebem os campos `management*` no estado corrente, nas respostas de gravação ou nos detalhes de revisões. A consulta de auditoria omite as operações reservadas. Todas as operações de Fecha Real e ambos os PDFs exigem a identidade autorizada; uma requisição repetida também é negada antes da verificação de idempotência. O servidor continua usando o estado completo ao gravar outros módulos, preservando os dados reservados mesmo quando o cliente não os recebe.

Fechamento oficial não depende mais do último dia do mês: a decisão e a confirmação são do administrador designado. Reabertura, edição e uma nova confirmação preservam todas as versões oficiais anteriores. Os testes HTTP incluem um segundo administrador com o mesmo nome de exibição, um usuário financeiro, consultas de estado/auditoria/revisões, respostas normais e repetidas, operações reservadas, PDF parcial e oficial, fechamento futuro e preservação de dados ao gravar módulos comuns.
