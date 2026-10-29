# Preparação do repositório GitHub

**Repositório previsto:** https://github.com/VyktorCorner/VySCSh

Os arquivos foram montados localmente; **não foram enviados automaticamente ao GitHub**. Se o repositório é privado, configure seu Git para ter acesso a ele.

## Importar arquivos

No Windows, instale Git e Node.js 22+. Clone a branch principal e copie para dentro do clone o conteúdo do ZIP de entrega (sem criar uma pasta `VySCSh` extra):

```powershell
git clone https://github.com/VyktorCorner/VySCSh.git
cd VySCSh
# Copie aqui os arquivos extraídos do ZIP
npm install
npm run check
npm test
npm run build
git add .
git commit -m "feat(mvp): Windows Radmin P2P screensharing"
git push origin HEAD
```

O `npm install` gera `package-lock.json`, que **deve ser versionado**. Recomendamos Node 22 e a instalação limpa com `npm ci` nos builds seguintes.

## Metadados sugeridos para o repositório

- **Nome:** `VySCSh`
- **Descrição:** `Private P2P screen sharing for coding and games — Windows / Electron / React / WebRTC`
- **Topics:** `webrtc`, `screensharing`, `p2p`, `electron`, `react`, `typescript`, `windows`, `radmin-vpn`
- **Visibilidade:** privado enquanto o MVP for validado e as medidas de segurança forem revisadas.

## Configurações do GitHub

- Branch principal: `main` (ou a atual do repositório, sem forçar).
- Proteção de branch: obrigar checks e revisão antes de merge quando houver colaboradores.
- Não salvar chaves Radmin ou senhas de sala em GitHub Secrets; elas são geradas por sessão.
- GitHub Actions: `.github/workflows/ci.yml` executa checagem de TypeScript, build e testes.
- Issues: use os templates `bug_report.yml` e `feature_request.yml`.
- Releases: após testes em 2 Windows reais, publicar `.exe` pelo fluxo de release escolhido.
- Definir uma licença antes de distribuir/publicar código para terceiros.

## Convenção de commits

- `feat:` nova função
- `fix:` correção
- `refactor:` reorganização sem mudança funcional
- `test:` testes
- `docs:` documentação
- `ci:` automação

Sugestão de primeira release: `v0.1.0-alpha.1`, **somente após teste real no Windows**.
