# LAUD.US — Landing Institucional

Site de marketing **separado** do aplicativo (que continua em outro domínio/subdomínio,
ex. `app.laudus.com.br`, com login/dashboard). Sem framework, sem build — HTML + CSS
puro, para deploy instantâneo em qualquer host estático (Vercel, Netlify, GitHub Pages).

## Estrutura

- `index.html` — página única (hero, funcionalidades, planos, FAQ, rodapé)
- `style.css` — estilos (paleta reaproveitada do design system do app: brand/ink)
- `termos.html` / `privacidade.html` — versões públicas dos documentos de
  `docs/legal/TERMOS_DE_USO.md` e `docs/legal/POLITICA_DE_PRIVACIDADE.md`

## Deploy (Vercel, recomendado)

1. Crie um **novo projeto Vercel** apontando para este diretório (`landing/`) como
   root directory — **não** o mesmo projeto do app, para manter domínios/deploys
   independentes.
2. Sem build command necessário (site estático). Output directory: `.` (raiz).
3. Configure o domínio principal (ex. `laudus.com.br`) neste projeto; mantenha o
   domínio do app (ex. `app.laudus.com.br` ou o domínio Vercel atual) apontando
   para o projeto do aplicativo React.
4. Os botões "Entrar" / "Criar conta grátis" apontam para a URL do app — ajuste a
   constante `APP_URL` no topo de `index.html` antes do primeiro deploy.

## Pendências do usuário (fora do escopo de código)

- Registrar/configurar o domínio institucional escolhido.
- Preencher CNPJ e dados de contato reais no rodapé (`index.html`, seção `<footer>`).
- Validar juridicamente o conteúdo de `termos.html`/`privacidade.html` antes de publicar
  (mesmo aviso que já está em `docs/legal/*.md`).
