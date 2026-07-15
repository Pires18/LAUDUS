#!/usr/bin/env bash
#
# Abre e mergeia o Pull Request da branch de correções de Medicina Fetal.
#
# Funciona com QUALQUER um destes métodos de autenticação (detecta sozinho):
#   1) GitHub CLI:  gh (autenticado via `gh auth login`)
#   2) Token:       GH_TOKEN ou GITHUB_TOKEN no ambiente (usa a API via curl)
#
# Uso:
#   ./scripts/abrir-mergear-pr.sh                 # branch atual -> main
#   BRANCH=minha-branch BASE=main ./scripts/abrir-mergear-pr.sh
#   MERGE_METHOD=squash ./scripts/abrir-mergear-pr.sh
#   NO_MERGE=1 ./scripts/abrir-mergear-pr.sh      # só abre o PR, não mergeia
#
set -euo pipefail

# ─── Configuração (com defaults sensatos) ───────────────────────────────────
BRANCH="${BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
BASE="${BASE:-main}"
MERGE_METHOD="${MERGE_METHOD:-merge}"   # merge | squash | rebase
NO_MERGE="${NO_MERGE:-}"

# owner/repo a partir do remote origin (suporta https e ssh)
ORIGIN_URL="$(git remote get-url origin)"
REPO="$(printf '%s' "$ORIGIN_URL" | sed -E 's#.*github\.com[:/]+##; s#\.git$##')"

TITLE="${TITLE:-fix(medicina-fetal): correções da auditoria completa do módulo}"
read -r -d '' BODY <<'EOF' || true
Correções decorrentes da auditoria completa do módulo de Medicina Fetal
(posterior ao PR #6).

- Regressões da sessão: trava de IG do PSV-ACM (18–40 sem) e números do
  ducto venoso (Hecher).
- Harmonização clínica: FCE/bradicardia (<110), unidades das máscaras
  (Neuro mm; Gemelar MBV cm), tabela CRL→IG (Robinson-Fleming), RCP <0,75,
  FCF 1T, gap do ILA.
- Integração do motor estruturado: discordância gemelar ligada (pfe1/pfe2),
  derivação morta de BPP removida, sectionId alinhado ao heading, RCP por
  percentil, IP-DV e EFW por sexo ligados; timing de Barcelona corrigido.

480 testes verdes · tsc limpo.
EOF

echo "▶ Repo: $REPO | branch: $BRANCH → base: $BASE | merge: ${NO_MERGE:+(desabilitado)}${NO_MERGE:-$MERGE_METHOD}"

# ─── 1) Garantir que a branch está no remote ────────────────────────────────
echo "▶ Enviando a branch para o origin (se necessário)…"
if ! git push -u origin "$BRANCH" 2>/dev/null; then
  echo "  ⚠ push não executado aqui (sem credenciais?). Prossigo — a branch pode já estar no remote."
fi

# ─── 2) Método de autenticação ──────────────────────────────────────────────
TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"

api() { # api <METHOD> <path> [json-body]
  local method="$1" path="$2" body="${3:-}"
  local args=(-sS -X "$method"
    -H "Authorization: Bearer $TOKEN"
    -H "Accept: application/vnd.github+json"
    -H "X-GitHub-Api-Version: 2022-11-28")
  [ -n "$body" ] && args+=(-d "$body")
  curl "${args[@]}" "https://api.github.com/repos/$REPO$path"
}

json() { # json <key> — extrai um campo simples do stdin (via python3, senão grep)
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$1','') if isinstance(d,dict) else '')" 2>/dev/null || true
  else
    grep -oE "\"$1\"[[:space:]]*:[[:space:]]*[0-9]+" | head -1 | grep -oE '[0-9]+' || true
  fi
}

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  # ─── Caminho gh CLI ───────────────────────────────────────────────────────
  echo "▶ Usando o GitHub CLI (gh)."
  if ! gh pr view "$BRANCH" >/dev/null 2>&1; then
    gh pr create --repo "$REPO" --base "$BASE" --head "$BRANCH" --title "$TITLE" --body "$BODY"
  else
    echo "  PR já existe para $BRANCH."
  fi
  if [ -z "$NO_MERGE" ]; then
    gh pr merge "$BRANCH" --repo "$REPO" "--$MERGE_METHOD" --delete-branch=false
    echo "✓ PR mergeado em $BASE."
  fi

elif [ -n "$TOKEN" ]; then
  # ─── Caminho API via curl ─────────────────────────────────────────────────
  echo "▶ Usando a API do GitHub (token)."
  OWNER="${REPO%%/*}"
  CREATE_BODY="$(printf '{"title":%s,"head":%s,"base":%s,"body":%s}' \
    "$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$TITLE")" \
    "$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$BRANCH")" \
    "$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$BASE")" \
    "$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$BODY")")"

  RESP="$(api POST /pulls "$CREATE_BODY")"
  NUM="$(printf '%s' "$RESP" | json number)"
  if [ -z "$NUM" ]; then
    echo "  PR não criado (talvez já exista). Procurando PR aberto para $BRANCH…"
    RESP="$(api GET "/pulls?state=open&head=$OWNER:$BRANCH&base=$BASE")"
    NUM="$(printf '%s' "$RESP" | python3 -c 'import sys,json; a=json.load(sys.stdin); print(a[0]["number"] if a else "")' 2>/dev/null || true)"
  fi
  [ -z "$NUM" ] && { echo "✗ Não foi possível obter o número do PR. Resposta:"; printf '%s\n' "$RESP" | head -20; exit 1; }
  echo "  PR #$NUM"
  if [ -z "$NO_MERGE" ]; then
    MERGE_RESP="$(api PUT "/pulls/$NUM/merge" "{\"merge_method\":\"$MERGE_METHOD\"}")"
    if printf '%s' "$MERGE_RESP" | grep -q '"merged": *true'; then
      echo "✓ PR #$NUM mergeado em $BASE."
    else
      echo "✗ Falha ao mergear. Resposta:"; printf '%s\n' "$MERGE_RESP" | head -20; exit 1
    fi
  fi

else
  # ─── Sem autenticação disponível ──────────────────────────────────────────
  echo "✗ Sem 'gh' autenticado e sem GH_TOKEN/GITHUB_TOKEN."
  echo "  Configure UM destes e rode de novo:"
  echo "    • gh:    brew install gh && gh auth login"
  echo "    • token: export GH_TOKEN=<seu_token_com_escopo_repo>"
  echo ""
  echo "  Ou abra manualmente:"
  echo "    https://github.com/$REPO/compare/$BASE...$BRANCH?expand=1"
  exit 2
fi
