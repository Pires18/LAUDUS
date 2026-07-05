# Assinatura Digital ICP-Brasil — Plano de Integração

**Status:** spec pronta, aguardando decisão de fornecedor + credenciais do usuário · **Criado em:** 2026-07-05

## Por que isso importa

Hoje o LAUD.US só suporta uma **imagem de assinatura escaneada** (upload em Settings → Centro de PDF, `signatureImageUrl`), exibida no rodapé do PDF. Isso não tem o mesmo valor jurídico de uma assinatura digital com certificado ICP-Brasil — o CFM recomenda assinatura eletrônica válida para laudos médicos com força de documento assinado.

## Por que não foi implementado agora

Uma integração real com certificado digital exige:
1. **Escolha de fornecedor** (decisão de produto/custo, não técnica) — as duas opções líderes no Brasil são:
   - **ClickSign** — API REST, aceita certificado ICP-Brasil e assinatura eletrônica avançada; plano por documento assinado.
   - **D4Sign** — API REST similar, também com opção ICP-Brasil; historicamente mais usado por setor jurídico/saúde.
2. **Conta e credenciais** (API token) do fornecedor escolhido — o usuário precisa criar a conta e gerar o token; nenhum código funciona sem isso.
3. Adivinhar o contrato exato da API sem a conta/documentação ativa arrisca produzir uma integração que parece pronta mas falha silenciosamente em produção — pior do que não ter a feature.

Por isso, este documento entrega o **desenho pronto para implementar** assim que o fornecedor for escolhido, em vez de código não-testável.

## Desenho da integração (a implementar quando houver conta)

1. **Modelo de dados** (`Exam`): adicionar `signatureProvider?: 'clicksign' | 'd4sign'`, `signatureStatus?: 'none' | 'pending' | 'signed' | 'failed'`, `signatureRequestId?: string`, `signedPdfUrl?: string`.
2. **Endpoint servidor** `api/sign-report.ts` (Admin SDK, autenticado):
   - Recebe `examId`; gera o PDF final do laudo (reaproveitar pipeline de export existente, `src/modules/export/`).
   - Envia o PDF ao provedor via API REST com os dados do profissional (nome, CRM, e-mail) como signatário.
   - Grava `signatureStatus: 'pending'` e `signatureRequestId` no exame.
3. **Webhook do provedor** `api/sign-report-webhook.ts`: recebe callback de assinatura concluída, baixa o PDF assinado, sobe para o Firebase Storage, grava `signedPdfUrl` e `signatureStatus: 'signed'`.
4. **UI:** em Settings → Centro de PDF, seção "Assinatura Digital (ICP-Brasil)" com estado "Não configurado" até haver token; no editor de laudo, botão "Assinar digitalmente" habilitado só quando configurado, mostrando status (pendente/assinado) com link para o PDF assinado.
5. **Fallback:** a imagem de assinatura escaneada continua disponível para laudos que não passarem pelo fluxo ICP-Brasil — a UI deve deixar claro qual dos dois modos foi usado em cada laudo.

## Ação necessária do usuário antes de qualquer código

1. Escolher o fornecedor (ClickSign ou D4Sign) — avaliar custo por documento assinado e volume mensal esperado de laudos.
2. Criar a conta e gerar o token de API de produção.
3. Confirmar que o plano do CFM aceito para o tipo de assinatura oferecido pelo fornecedor atende a exigência de laudo assinado digitalmente (validar com jurídico/CFM se necessário).

Assim que isso estiver definido, a implementação do desenho acima é direta (endpoints + webhook + UI já mapeados).
