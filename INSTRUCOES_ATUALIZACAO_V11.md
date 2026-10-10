# Ouro Certo V11: atualização integrada

Base: backup `ouro-certo-financeiro-backut.zip` fornecido pelo usuário; melhorias da V10 integradas sem substituição integral.

## Alterações
- Modais renderizados em portal e CSS de centralização/rolagem.
- Dashboard com seletores de mês e ano; campos de data utilizam o calendário nativo quando disponível.
- Contas recorrentes geradas ao abrir meses futuros, incluindo intermediários (sem duplicar registros por parent/mês).
- APIs de lançamentos e uploads usam `checkOrigin` baseada em `APP_URL` (domínio público exato).
- `server/runtime.ts`: banco carregado sob demanda com criação idempotente das tabelas e índices, preservando o histórico e a pasta de comprovantes.
- Tipagem de upload usando `instanceof File` (corrige o erro TS da versão anterior).

## Publicação
1. Mantenha um backup do repositório Git, inclusive do diretório `.git` local.
2. Na pasta do projeto clonada pelo GitHub Desktop, substitua os arquivos de código pelos deste pacote. Não apague `.git`, nem copie pastas de dados/segredos.
3. Faça commit e push após verificar a lista de arquivos alterados. Railway fará deploy automático.
4. Confira `APP_URL=https://SEU-DOMINIO`, `DATA_DIR=/data` e volume `/data` no Railway.
5. Teste login, lançamento de entrada, conta avulsa, recorrência após saltar meses, modais em celular e desktop, origens inválidas e recuperação após restart.

**Importante:** o estado do Railway pode estar mais recente que o backup; verifique diffs com `git diff` antes do push. Compilação completa e testes em produção não foram homologados neste pacote.
