# Publicação da V13 no Railway

1. Publique o conteúdo de Ouro_Certo_V13 na raiz de um repositório GitHub e conecte esse repositório ao Railway.
2. Use um serviço Node.js com uma réplica. Crie um volume persistente e monte-o em `/data` antes de usar o sistema.
3. Configure `DATA_DIR=/data`, `APP_URL=https://seu-dominio-publico` e `BOOTSTRAP_SECRET` com um segredo próprio. A origem configurada deve corresponder à URL acessada pelo usuário. Railway fornece PORT automaticamente; na ausência de APP_URL, o servidor usa RAILWAY_PUBLIC_DOMAIN quando disponível.
4. Instalação/build: `npm ci && npm run build`. Inicialização: `npm start`. O script start respeita PORT e funciona também no Windows.
5. Acesse `/login`, selecione o primeiro acesso e crie o administrador com o segredo configurado. Os próximos usuários são cadastrados em Configurações.
6. Para atualizar uma V12 existente, preserve o volume, DATA_DIR e usuários. Não repita a criação do administrador. Faça backup do banco e dos uploads antes do deploy.
7. Confira um vale, o saldo do caixa, Contas Pagas, a comissão e um PDF; reinicie o serviço e confirme a persistência dos dados.

O volume contém `ouro-certo.sqlite` e `uploads`. Faça backups externos periódicos; uma cópia consistente de SQLite em modo WAL deve incluir o estado atual do banco (use backup SQLite ou pare o serviço antes de copiar os arquivos). O ZIP não contém banco ou segredos. Não use múltiplas réplicas compartilhando o arquivo SQLite.

A validação local não publica o serviço no Railway nem no GitHub. O workflow incluído valida o código em cada push e pull request.
