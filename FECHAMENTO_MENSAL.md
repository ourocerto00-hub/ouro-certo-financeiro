# Painel gerencial e fechamento mensal

O painel fica abaixo dos seis cartões do Dashboard e mostra toda a rede, independentemente do filtro de unidade.

- **Acumulado histórico:** gramas manuais com data de referência e histórico de correções. Não entram no denominador mensal. Não se somam meses automaticamente, evitando duplicar um saldo anterior desconhecido.
- **Parcial mensal:** gramas compradas e lucro bruto faturado informados manualmente para a competência. A produção salarial não é usada como quantidade de compras: funcionários de salário fixo podem não ter gramas lançadas.
- **Contas mensais:** mesma fonte `summary(state, month, 'all').total`: contas ativas por vencimento, remuneração por competência e despesas diárias. Inclui obrigações não pagas. Não soma de novo pagamentos de contas, salários ou vales. Contas pagas por data aparecem separadamente, apenas para consulta.
- **Logística:** contas do mês / gramas do mesmo mês, em R$/g. Zero ou ausência de gramas mostra “Não calculável”. Valores em centavos e miligramas inteiros, divisão com BigInt e arredondamento para centavo apenas na apresentação; quantidades aceitam até 0,001 g. Resultados fora do limite seguro são recusados.
- **Resultado:** lucro bruto externo - contas da competência. O bruto informado deve já descontar a compra do ouro no outro sistema. Resultado positivo tem sinal + e verde; negativo, sinal - e vermelho; zero é equilíbrio.

## Fechamento e correções

Disponível a partir do último dia da competência no fuso America/Cuiaba, sem encerrar automaticamente. Financeiro pode atualizar parciais e acumulado; somente administrador pode fechar ou reabrir. O administrador revisa gramas, lucro bruto e contas exatas, informa origem/justificativa e confirma uma declaração explícita. O custo é sugerido pelo sistema, pode ser ajustado sem alterar contas existentes e exige explicação se divergir ou se houver folhas ainda não conferidas.

O fechamento grava um retrato independente das obrigações, pagamentos informativos, pendências de folha, valores exatos, versão, autor, horário e justificativa. Mudanças posteriores nas obrigações não alteram esse retrato e produzem um alerta no painel. Para corrigir, reabrir com justificativa, revisar e confirmar novamente. A versão anterior permanece no histórico. O fechamento gerencial não bloqueia nem altera os fechamentos diários de caixa.

Cada versão fechada tem PDF A4 autenticado, gerado no servidor a partir do registro persistido. Versão vigente aparece como oficial; versões reabertas/substituídas são históricas. Inclui período, horário/fuso, contas, ouro do mês, logística, bruto, líquido e auditoria. Não exporta um formulário não salvo como oficial.

## Armazenamento e Railway

Sem migração de banco: campos opcionais são acrescentados ao JSON nas revisões já existentes. Estados antigos carregam sem mudança. O mesmo volume `/data` e `DATA_DIR` continuam necessários; nenhum comando de atualização deve apagar ou substituir banco ou uploads. Idempotência, revisão otimista, verificação de origem e sessão existentes cobrem as novas operações. Requisições concorrentes têm conflito 409 e não sobrescrevem um fechamento.

A implementação oficial da tela é `app/finance.jsx`. A cópia antiga `app/finance.tsx`, divergente e com erros de lint, foi removida; `page.tsx` importa explicitamente o JSX atualizado, preservando Contas Pagas, filtros, PDFs e bloqueio de submissão simultânea da V13.

## Verificação local

Executar `npm ci`, `npm test`, `npm run lint` e `npm run build`. Após o build, `node scripts/test-management-integration.mjs` inicia um servidor apenas em loopback e cria um SQLite novo em `work/management-http-*`, testa HTTP, permissões, conflito, reabertura, PDF e persistência após reinício e encerra o servidor. Não recebe URL de produção nem usa o banco existente. Os PDFs de teste ficam nessa pasta ignorada pelo Git. A checagem de lint mantém somente um aviso preexistente de dependências do efeito da tela financeira.


## Revisão visual e limites

Revisão no navegador em 1280 px e 390 px: formulário mensal salvo, fechamento de outubro confirmado com dados fictícios, resultado negativo em vermelho e sinal explícito; sem rolagem horizontal da página nem valores cortados nos seis indicadores. A revisão identificou valores monetários quebrados em colunas muito estreitas; o painel passou a usar três colunas no desktop e uma no celular. Os campos têm rótulos e confirmação vinculada, sem depender apenas da cor. Os PDFs A4 positivo e negativo foram abertos, renderizados e inspecionados, com cabeçalhos repetidos e paginação. Mantido o estilo escuro e dourado existente; não foi fornecido contexto de marca adicional.

Esta verificação usa dados fictícios e não atesta os números reais da empresa. Não houve login, lançamentos, migração ou alteração de variáveis/volume no Railway de produção. O fechamento oficial depende de conferência humana dos valores no outro sistema; não há integração automática com o fechamento da matriz.
