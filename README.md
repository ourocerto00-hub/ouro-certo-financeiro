# Ouro — Gestão Financeira

Aplicação inicial baseada no documento de requisitos e na referência visual fornecidos em 10/10/2026.

## Uso

1. Entrar individualmente com ChatGPT no site privado.
2. Em Bancos, editar os saldos e datas iniciais antes de criar movimentações.
3. Conferir as sete unidades em Configurações, cadastrar funcionários e despesas.
4. Informar gramas na competência e conferir a remuneração antes do pagamento.
5. Conferir diariamente os saldos reais e gerar os PDFs desejados.

O botão Ver demonstração carrega exemplos apenas na memória do navegador. Não grava registros reais. Os dados financeiros reais iniciam zerados.

## Implementado

- Nove módulos, filtros de competência/unidade, interface responsiva preta e dourada.
- Dois caixas, novas contas, despesas com unidade obrigatória e transferências sem custo.
- Contas recorrentes, pagamentos parciais, cancelamentos, categorias editáveis.
- Funcionários, comissões por grama com taxa histórica, vales e pagamento salarial.
- Fechamentos com divergências justificadas e bloqueio de movimentos retroativos.
- Comprovantes PDF/JPG/PNG de até 5 MB no armazenamento R2.
- Relatórios PDF paginados e exportação JSON de backup.
- Autorização de administradores no servidor, auditoria por revisões imutáveis e escrita atômica com controle de concorrência e idempotência.

## Arquitetura e diferenças do documento

A hospedagem Sites utiliza Vinext (compatível com convenções Next.js), D1/SQLite e R2. A identidade é individual via ChatGPT, não login/senha próprios do Supabase. O site permanece privado do proprietário; o cadastro de outro administrador não altera a política de acesso da hospedagem.

A persistência inicial mantém o estado financeiro completo em revisões imutáveis numa tabela relacional. Antes de ampliar o uso e o volume de dados, recomenda-se normalizar as entidades em tabelas próprias e realizar homologação com as rotinas reais da empresa. O histórico contém os estados anterior e posterior e permite reconstrução, mas ainda não há agendamento de backup externo ou restauração pela interface. A exportação é manual. Alterações em salários e vínculos de funcionário valem para futuras competências; não recalculam folhas existentes automaticamente.

## Verificação

`node --test app/engine.test.mjs` cobre precisão, atribuição de custos, vales, comissões, ausência versus zero, pagamento parcial, reversão, transferências, fechamentos e recorrência idempotente.

`npm run db:generate` gera migrações; `npm run build` compila; `npm run dev` inicia a prévia.

Valores são armazenados em centavos inteiros; gramas em miligramas. Nenhuma integração bancária ou com ERP está incluída. Os saldos dependem dos lançamentos e da conferência informada pelo administrador.
