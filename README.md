# Ouro Certo V13

Sistema de gestão financeira com Next.js, Node.js e SQLite persistente. Registra operações; não executa transferências bancárias reais.

## Novidades da V13

- Onze relatórios PDF em A4, preto, dourado e branco, com marca, cabeçalhos, tabelas, totais, quebra de linhas e páginas numeradas.
- PDFs dos caixas com saldo inicial do período, entradas, saídas e saldo esperado. O botão PDF no caixa usa a conta e o dia selecionados, mesmo sem fechamento. Os relatórios de fechamento incluem saldo real, diferença, responsável e justificativa quando registrados.
- Tela Contas Pagas com despesas, contas, salários e vales. É uma consulta das saídas já existentes, sem uma segunda tabela de pagamentos.
- Vale pago gera uma única saída no Caixa de Pagamentos e reduz o saldo salarial da competência. Cancelar pela tela de vales ou pelo caixa estorna ambos os vínculos e retira o pagamento dos totais ativos.
- Comissão padrão preservada em R$ 10,00 por grama, com até três casas decimais de produção. As folhas anteriores mantêm a taxa histórica. Taxas futuras continuam configuráveis, conforme a V12.
- Bloqueio imediato de submissões simultâneas no navegador. No servidor, requestId identifica repetições e a revisão impede gravações concorrentes sobre estado antigo.

## Executar localmente

Requer Node.js 22.13 ou superior (CI configurada com Node.js 24).

1. Execute `npm ci` na raiz do projeto.
2. Copie `.env.example` para `.env.local`. Preencha `BOOTSTRAP_SECRET` com um segredo próprio e mantenha `APP_URL=http://localhost:3000` para desenvolvimento.
3. Execute `npm run dev` e acesse `/login` para criar o primeiro administrador.
4. Em Bancos, configure a data e o saldo inicial de cada conta antes das movimentações. Cadastre funcionários, unidades e categorias; depois registre contas, vales e produção.

Para validar: `npm test`, `npm run lint` e `npm run build`. Para executar a versão compilada: `npm start`. Em produção, configure uma URL HTTPS e o armazenamento persistente, conforme README_RAILWAY.md.

## Publicar no GitHub e Railway

Extraia o ZIP e publique **o conteúdo da pasta Ouro_Certo_V13 na raiz do repositório**, incluindo `.github`, `.gitignore` e `.env.example`. Não publique a pasta externa como um nível extra. O workflow do GitHub executa instalação, testes, lint e build.

O GitHub armazena o código. A aplicação com login, SQLite e APIs deve ser hospedada em um serviço Node.js, como Railway; GitHub Pages não executa este servidor.

## Dados e atualização da V12

Não há mudança de esquema nem migração destrutiva. Mantenha o mesmo volume `DATA_DIR` e faça backup do arquivo SQLite e da pasta uploads antes de substituir o código. A V13 usa os lançamentos e vínculos de vales da V12; não cria saídas retroativas adicionais. Não altere o saldo inicial de contas com histórico.

Contas Pagas e totais financeiros desconsideram cancelamentos; o PDF de Contas a Pagar mantém as contas canceladas visíveis, com sua situação e valor cancelado separados; os registros originais e a auditoria permanecem disponíveis. Os filtros de unidade e categoria se aplicam a custos e pagamentos. Saldos de caixa são centralizados e os PDFs de caixa mostram todos os movimentos da conta, evitando conciliações com filtros incompletos. Transferências são entradas/saídas por conta, mas não custos operacionais.

Contas a Pagar e seu PDF usam a mesma seleção de contas por período, unidade, categoria e busca, incluindo contas pagas e canceladas. Os totais de contas ativas, pago, saldo pendente e valor cancelado são apresentados separadamente. Salários permanecem na tabela própria e no relatório Salários e Comissões. Custos mostram obrigações previstas na competência e valores pagos acumulados; Contas Pagas mostra saídas na data do pagamento. Salários e Comissões considera as competências que cruzam o intervalo selecionado. O saldo inicial dos PDFs inclui o saldo cadastrado e movimentos anteriores ao período; saldo esperado = inicial + entradas - saídas.

## Verificação

Veja RELATORIO_TESTES_V13.md e CORRECAO_PDF_CONTAS_A_PAGAR.md (correção e regressão do PDF de contas). A entrega exclui node_modules, build, bancos, comprovantes reais, arquivos de ambiente com segredos e dados usados nos testes.

Documentos de versões anteriores são referências históricas. Para instalar e publicar a V13, siga este README e README_RAILWAY.md.
