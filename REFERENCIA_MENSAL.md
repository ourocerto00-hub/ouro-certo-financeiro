# Mês de referência e datas financeiras

## Regra aprovada

Todos os cartões do dashboard usam o mesmo mês de referência:

- **Contas Mensais** = contas ativas da referência + remuneração bruta da folha (fixo e comissão calculada) + despesas diárias da referência.
- **Contas Pagas** = pagamentos internos e externos vinculados à referência, incluindo vales e pagamentos salariais, mesmo quando pagos em outro mês.
- **Contas Pendentes** = Contas Mensais − Contas Pagas.
- **Vales Pagos** detalha a parcela dos vales já incluída em Contas Pagas. Não é custo adicional à remuneração.

Um Pix pago em novembro com referência dezembro entra no custo e no pago de dezembro. O caixa continua mostrando a saída em novembro. Pagar uma conta não adiciona outra despesa ao custo; o pagamento quita a obrigação existente.

Se os pagamentos superarem a remuneração e demais custos conhecidos, a diferença do dashboard pode ser negativa. O painel exibe a diferença e um aviso para conferir adiantamentos e comissões ainda não informadas. O piso zero individual de `salaryDue` continua protegendo a operação de pagar salário; ele não é usado para esconder a diferença no dashboard.

## Campos e herança da referência

- Contas: `referenceMonth` (`AAAA-MM`) define o custo; `date` continua sendo vencimento.
- Despesas diárias: `referenceMonth` define o custo; `date` é a data real do pagamento.
- Folhas e vales: `month` continua definindo a referência salarial.
- Pagamentos de contas e salários herdam a referência da obrigação vinculada. O cliente não pode atribuir outra referência a uma parcela para desviar a quitação.
- O detalhamento de pagamentos usa a unidade da obrigação/folha; os movimentos originais do caixa não são reescritos se a unidade da folha mudar.
- `createdAt` dos novos registros financeiros é preenchido pelo servidor, independentemente das datas escolhidas pelo usuário. Não é aceito do formulário e não muda ao editar o registro. A revisão continua preservando antes/depois, autoria e horário da alteração.

O novo formulário permite escolher referência e vencimento/pagamento separadamente. A data automática do lançamento é exibida no histórico e nos PDFs, no horário de Cuiabá.

## Compatibilidade e preservação

Nenhuma migração de datas, banco ou volume é executada. Para registros legados sem `referenceMonth`, a leitura mantém o mês já representado pela data armazenada. Horários antigos ausentes aparecem como “Não registrado (legado)”; não são inventados nem substituídos pela data de implantação.

Ao corrigir somente a data real de uma despesa legada, a referência anterior é preservada explicitamente. A referência só muda quando informada na edição. As datas antigas deslocadas manualmente para outro mês precisam ser conferidas com comprovantes; este código não tenta inferir a data bancária verdadeira.

Recorrências são identificadas por origem e referência para não duplicar obrigações. O deslocamento entre mês de referência e mês do vencimento é mantido ao gerar o próximo mês; a quitação não é replicada. Cancelamentos de um mês não cancelam automaticamente outros registros já gerados.

Fechamentos gerenciais oficiais existentes conservam seus valores salvos. Novos fechamentos registram `calculationBasis: reference-month-v1`; PDFs históricos identificam o critério antigo de pagamentos quando esse marcador não existe.

## Relatórios e filtros

Sem filtros de datas reais, Contas a Pagar, Contas Pagas e relatórios de custos usam o mês de referência selecionado. Filtros de datas preenchidos restringem também vencimento/pagamento real. O PDF Resumo Financeiro Geral sem filtros adicionais apresenta a mesma equação do dashboard. Relatórios de caixa continuam usando exclusivamente a data real dos movimentos.

## Verificação antes de publicação

`npm test`, `npm run lint`, `npm run build`, `node scripts/test-management-integration.mjs` e `node scripts/test-bill-payments-integration.mjs` devem passar. As integrações iniciam apenas servidores locais com bancos SQLite novos em `work/`; nunca conectam à produção. Os novos testes cobrem referência em outro mês, vales antecipados, comissões, parcelas mistas, cancelamentos, datas automáticas, leitura legada, recorrências e PDFs.

A publicação desta PR altera o critério dos indicadores e seleções mensais conforme a regra acima. Não corrige ou apaga lançamentos reais. Deploy é uma etapa posterior à revisão e validação.
