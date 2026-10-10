# Verificação da V13 - 10/10/2026

## Resultado

- `npm test`: **26 testes aprovados, zero falhas**.
- `npm run build`: **aprovado**, Next.js 16.3.4 / webpack, incluindo TypeScript, geração de páginas e rotas de API.
- `tsc --noEmit`: **aprovado**.
- `npm run lint`: **zero erros**, um aviso da rotina de preparação de competências sobre dependências do useEffect, herdada da V12.
- Servidor de produção: iniciou com PORT configurado e respondeu às APIs e à interface autenticada.

## Regras financeiras

Testados precisão em centavos, atribuição de despesas à unidade, comissão padrão de R$ 10/g, produção fracionada, distinção entre zero e gramas não informadas, pagamentos parciais, recorrências, taxas históricas, transferências, divergências e bloqueios de fechamento.

Cenário V13: salário fixo de R$ 2.500,00 + 12,345 g x R$ 10,00 = R$ 2.623,45. O vale de R$ 500,00 gera uma saída, um registro em Contas Pagas e saldo salarial de R$ 2.123,45. Pagar esse saldo resulta em R$ 2.623,45 de saídas totais, exatamente a remuneração bruta; o vale não é lançado novamente. Cancelar o vale pela tela de vales ou pelo movimento recompõe os saldos e exclui o registro dos totais ativos, mantendo o histórico.

## Integração HTTP com SQLite de teste

Validada em servidor de produção iniciado com banco isolado e administrador fictício:

- Autenticação e criação dos registros pelo servidor.
- Reenvio do mesmo requestId três vezes, mantendo uma única saída e a mesma revisão.
- Rejeição de uma gravação com revisão obsoleta (HTTP 409).
- Estorno do vale e recomposição do caixa e da folha.
- Novo vale e pagamento do salário líquido, sem saldo pendente nem duplicidade.
- Duas gravações concorrentes na mesma revisão: uma aceita e outra rejeitada, sem perda de atualização.

O script reproduzível está em `scripts/test-integration.mjs`. Requer um servidor com banco de teste vazio e as variáveis TEST_BASE_URL, TEST_ORIGIN e TEST_BOOTSTRAP_SECRET correspondentes à configuração desse servidor. Não integra a rotina `npm test`, porque cria usuários e registros no banco de teste.

## PDFs e interface

- Onze tipos de relatório gerados e reabertos por leitores PDF independentes.
- Revisão visual de páginas em preto, dourado e branco, com acentos, cabeçalhos, tabelas, totais, rodapés e paginação.
- Caso extenso de Contas Pagas com nove páginas; registros longos e palavras sem espaços com quebra de linha.
- Conjunto final de 23 páginas verificado: nenhum caractere fora das margens.
- PDFs de caixa com movimentos mesmo sem fechamento, saldo inicial, entradas, saídas e saldo esperado; conciliação sem filtro parcial de unidade ou categoria.
- Transferência entre caixas preserva o saldo esperado consolidado e não entra como custo.
- Navegação autenticada no Chrome: Contas Pagas mostra um único vale; Caixa de Pagamentos mostra a mesma saída. Nenhum erro JavaScript registrado.
- Layout revisado em 1440 x 1000 e 390 x 844, sem rolagem horizontal da página (tabelas têm rolagem interna).
- Botão PDF dispara o download no navegador e gera um documento válido. O sandbox do Chrome de teste cancelou a gravação direta do download; os bytes do Blob gerado pelo próprio botão foram salvos pelo executor, reabertos e renderizados. Confirmado PDF diário com R$ 10.000,00 inicial, R$ 500,00 de saída e R$ 9.500,00 esperado.

## Pacote e publicação

Código versionado como 13.0.0; dependências da V12 preservadas no package-lock. Incluídos README atualizado, exemplo de ambiente, instruções de atualização com volume persistente e workflow do GitHub (testes, lint e build).

O ZIP não contém node_modules, .next, SQLite, comprovantes, dados de teste ou arquivos de ambiente com segredos. A entrega prepara o código para publicação; não foi feito deploy nem acesso a um serviço real no GitHub/Railway.
