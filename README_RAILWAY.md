# Ouro Certo V8 — Railway (Node.js + SQLite persistente)

Esta variante substitui a execução Cloudflare Workers por Next.js em Node.js, troca D1 por SQLite local persistente e R2 por arquivos em disco persistente. O site é um SISTEMA DE REGISTRO FINANCEIRO, não movimenta dinheiro real.

## Deploy Railway
1. Publique o conteúdo da pasta `financeiro` como diretório-raiz do serviço (ou configure Root Directory = `financeiro`).
2. Crie um **Railway Volume** e monte em `/data` ANTES do primeiro lançamento. Sem o volume, dados e comprovantes podem desaparecer após redeploy.
3. Defina `DATA_DIR=/data` e `BOOTSTRAP_SECRET` forte e novo nas variáveis do serviço. Nunca use a chave antiga compartilhada no chat. Não coloque segredo nos arquivos do projeto.
4. Defina `PORT` pelo Railway (ele fornece automaticamente). Instale/compile com `npm ci && npm run build`, inicie com `npm run start`.
5. Acesse `/login`, escolha configuração inicial e crie o primeiro administrador. Depois crie usuários financeiros no painel.
6. Teste login, logout, permissões, registros, comprovantes, backups e persistência após reiniciar antes do uso real.

## Observações
- Não migra automaticamente o banco D1 local ou remoto existente. Dados pré-existentes requerem migração específica.
- A opção de usar arquivo SQLite é adequada para um único serviço Railway com volume persistente e **uma réplica**; não use múltiplas réplicas compartilhando esse arquivo.
- Faça backups externos periódicos do volume, incluindo `ouro-certo.sqlite` e a pasta `uploads`.
- O import original `cloudflare:workers` foi substituído por `server/runtime.ts`, que fornece uma interface compatível apenas com as operações usadas neste projeto.
- Testes de implantação com volume/URL Railway requerem configuração no próprio Railway.
