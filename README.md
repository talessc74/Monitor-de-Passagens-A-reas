# Monitor de Passagens Aéreas

Rastreador de preços de passagens aéreas com alertas por e-mail, alimentado por Gemini AI.

## Como rodar

```bash
npm install
cp .env.example .env   # preencha GEMINI_API_KEY
npm run dev            # http://localhost:3000
```

## Governança

Este projeto opera sob ARGUS + XDRS. Consulte `CLAUDE.md` antes de contribuir.

Após clonar, restaure os arquivos gerenciados de governança:

```bash
npm install
npx argus-xdrs-governance   # extrai seeds, AGENTS.md, CLAUDE.md, .xdrs/_core
make check                  # verifica integridade
```
