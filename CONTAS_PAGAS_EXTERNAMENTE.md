# Contas a pagar e pagamentos externos

Em **Contas a Pagar → Nova conta**, escolha:

- **Pagamento pelo caixa do sistema**: cria uma obrigação pendente. O cadastro não debita nenhum saldo. Depois, use **Pagar** para informar a conta financeira, a data e o valor da parcela.
- **Conta já paga por fora**: registra a conta e sua quitação integral, com data do pagamento e origem externa opcional. O valor total, descrição, categoria e unidade ficam vinculados ao pagamento. A situação será **Paga (externamente)**, sem possibilidade de pagar novamente uma obrigação quitada.

Para quitação parcial, crie a obrigação e use **Pagar**. Cada parcela pode ter origem interna ou externa. A soma das parcelas não pode ultrapassar o valor da conta. A situação distingue pagamentos externos e mistos; somente as parcelas internas debitam o caixa.

Pagamentos externos ficam em `state.externalPayments`, com valor positivo em centavos, vínculo à conta a pagar, data, origem, descrição, unidade, categoria, comprovante, responsável e data de criação. Não criam conta bancária nem registro em `state.movements`. Estados antigos sem essa coleção continuam válidos. A coleção é adicionada apenas quando necessária, dentro da revisão financeira já usada pelo aplicativo; não há migração de banco nem regravação de registros anteriores.

O custo mensal considera a conta a pagar uma vez, pela data de vencimento, conforme a regra existente. Contas Pagas e o KPI de pagamentos consideram a data de cada pagamento. Contas Pagas e seu PDF compartilham os filtros por período, unidade, categoria, origem e busca. Custos por unidade, resumo e Fecha Real aproveitam a mesma conta original; pagamentos não acrescentam um segundo custo. Fechamentos oficiais históricos mantêm seus valores salvos.

Para corrigir uma quitação externa, cancele o pagamento em **Contas Pagas**, informando uma justificativa. O registro original, responsável e data do cancelamento permanecem na coleção e nas revisões auditáveis. O saldo da obrigação reabre e nenhum saldo de caixa é estornado. Para excluir também a obrigação dos custos, cancele a conta após cancelar todos os seus pagamentos. O histórico de pagamentos externos cancelados está em Contas Pagas. Recorrências futuras ficam pendentes e não copiam os pagamentos da conta anterior.

## Validação antes de publicação

```sh
npm ci
npm test
npm run lint
npm run build
node scripts/test-management-integration.mjs
node scripts/test-bill-payments-integration.mjs
```

As integrações criam bancos SQLite novos em `work/`, iniciam servidores apenas em `127.0.0.1` e conferem persistência após reinício. Não usam a Railway nem dados reais. A integração de contas valida também perfil financeiro, idempotência, revisão obsoleta, débito único, parcelas mistas, cancelamento e auditoria.

## Publicação segura no serviço existente

Revisar o PR antes de mesclar em `main`: a Railway acompanha essa branch e a mesclagem pode disparar publicação automática. Confirmar backup consistente de SQLite e uploads antes da publicação. Preservar o projeto `0153c4bf-9532-45c0-8e7b-70393910cfca`, serviço `2563bf4d-7514-47f7-b4cd-c613ccbd1bf6`, volume existente em `/data`, variáveis e usuários. Não recriar o serviço nem reinicializar o banco. Depois de publicar, conferir os fluxos com lançamentos de teste autorizados; não inserir dados fictícios na produção para validar o PR.
