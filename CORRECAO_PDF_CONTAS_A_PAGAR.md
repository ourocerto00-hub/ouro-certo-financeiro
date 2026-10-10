# Correção do PDF de Contas a Pagar - Ouro Certo V13

## Causa encontrada no código

A tabela em `app/finance.jsx` selecionava contas pelo mês, unidade e busca, mantendo contas pagas e canceladas. O relatório de índice 0 em `app/reports.mjs` fazia uma seleção diferente: datas inicial/final próprias, categoria, apenas contas ativas e somente as que ainda tinham saldo pendente. A busca da tela não era enviada ao relatório. Assim, uma conta totalmente paga podia aparecer na tabela e desaparecer do PDF; com todas pagas, nenhum registro era exportado. Um período ou uma categoria mantidos na tela de relatórios também podiam eliminar as contas sem que esses filtros estivessem visíveis na seção Contas a Pagar.

Isso foi reproduzido antes da correção: o teste cadastrou e quitou uma conta em memória, confirmou uma linha na seleção da tabela e encontrou zero linhas no relatório. Resultado inicial: falha `0 !== 1`. Depois da correção, o mesmo teste passou e conferiu descrição e situação no PDF.

Também foi encontrado um caminho que produz literalmente apenas cabeçalho e rodapé: `buildPDF(title, report)` aceitava silenciosamente um array de linhas do contrato antigo, mas iterava somente `report.sections`. Um array não tem sections. A entrada pública `app/pdf.mjs` continuava descrita como compatível, sem adaptar esse formato. A chamada atual de `finance.jsx` usa um relatório estruturado; portanto, esse segundo problema é uma falha independente de compatibilidade, e não foi presumido como a causa única do sintoma da tela. Ambos os caminhos agora têm testes e correção.

## Comportamento corrigido

- A tabela e o PDF de contas usam o mesmo seletor puro, com período inclusivo, unidade, categoria e busca.
- Datas e categoria aparecem na seção Contas a Pagar, junto ao botão PDF. Datas em branco usam o mês selecionado. O botão Limpar filtros remove datas, categoria e busca; a unidade continua controlada no filtro superior.
- O PDF contém todas as contas exibidas, incluindo pagas, parciais e canceladas. Mostra descrição, unidade, vencimento, categoria, valor, pago/saldo e situação.
- Os totais da tela e do PDF são os mesmos: valor das contas ativas, total pago, saldo pendente e valor cancelado. Contas canceladas aparecem no histórico, mas não compõem valores devidos.
- Salários, comissões e vales permanecem nas suas tabelas e relatórios próprios. Eles não são misturados como linhas de conta na exportação da tabela de contas.
- Entradas antigas em formato de linhas são adaptadas; conteúdo inválido gera erro explícito. Filtros sem resultados geram mensagem visível e totais zerados, em vez de um documento aparentemente vazio.
- Cabeçalhos de coluna quebram linhas quando necessário; datas têm espaço suficiente. Linhas comuns ficam inteiras; registros maiores que uma página são continuados sem perda de texto. Os cabeçalhos se repetem, os totais são preservados e o design preto, dourado e branco permanece.

## Arquivos alterados

| Arquivo | Alteração |
| --- | --- |
| `app/finance.jsx` | Seleção compartilhada, filtros visíveis, exportação na própria seção, descrição, situação e totais consistentes. |
| `app/reports.mjs` | Remove divergência da seleção do relatório de contas; exporta campos, situações e totais; valida períodos reais. |
| `app/pdf-v13.mjs` | Adapta formato antigo, valida o contrato, mostra estado vazio, ajusta cabeçalhos, mensagens e paginação. |
| `app/bills-view.mjs` (novo) | Seletor de contas, validação de período, situações e totais, sem escrever ou modificar dados. |
| `app/bills-pdf.test.mjs` (novo) | Oito testes de regressão, filtros, campos/totais, preservação, formato antigo, vazio e paginação. |
| `README.md` | Documenta a seleção consistente e a apresentação das contas canceladas. |
| `RELATORIO_TESTES_V13.md` | Atualiza o total para 34 testes e referencia esta correção. |
| `CORRECAO_PDF_CONTAS_A_PAGAR.md` (novo) | Este relatório de causa, mudanças e validação. |

## Resultados de validação

- `npm test`: **34 aprovados, zero falhas**. Inclui os 26 testes anteriores de vales, comissões, caixa, pagamentos, transferências e comprovantes.
- `npm run build`: **aprovado**, Next.js 16.3.4 / webpack, incluindo TypeScript e geração de páginas/rotas. O ambiente Windows apresentou um erro de criação concorrente de diretórios gerados; após preparar esses diretórios locais, o build da versão final passou. Essa preparação não foi incluída como dependência do projeto.
- `npm run lint`: **zero erros**, um aviso já existente sobre dependências do useEffect de preparação de competências. A checagem dos arquivos finais também passou, com o mesmo aviso.
- Teste no Chrome com a versão compilada: quatro contas da unidade selecionada aparecem tanto na tabela quanto no PDF, incluindo a paga; filtros de período/categoria reduzem ambos a duas contas; a busca reduz ambos à mesma conta. Nenhum erro JavaScript e nenhuma requisição de escrita financeira foram observados.
- O teste de interface usou dados financeiros somente em memória e um banco isolado apenas para a autenticação de teste. Nenhum dado financeiro foi gravado nesse teste.
- Os PDFs gerados pelo botão foram capturados a partir do Blob do próprio navegador, reabertos e renderizados. O sandbox do Chrome cancela a gravação direta do download; a validação do conteúdo não dependeu dessa gravação.
- Seis PDFs conferidos por leitores independentes: **29 páginas**, incluindo um caso extenso com **24 páginas**. Todas as contas, a última linha e os totais foram encontrados; nenhum caractere fora das margens; texto branco apenas sobre fundos pretos. As páginas curta, vazia e finais foram inspecionadas visualmente.

## Preservação e entrega

Nenhuma API de gravação financeira, migração ou alteração de esquema foi executada. Os hashes de 21 arquivos existentes, incluindo SQLite/WAL/SHM e o núcleo financeiro/persistência, permanecem idênticos aos anteriores. `app/engine.mjs`, `server/runtime.ts`, a API de estado, esquema, package.json e package-lock não foram alterados.

O ZIP corrigido contém o projeto completo e este relatório, sem dependências instaladas, build, SQLite, comprovantes ou segredos. O ZIP anterior foi preservado. Nenhuma publicação no GitHub ou Railway foi realizada.
