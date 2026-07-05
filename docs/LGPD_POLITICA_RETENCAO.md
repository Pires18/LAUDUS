# Política de Retenção e Expurgo de Dados — LAUD.US

**Versão:** 2.0 · **Vigência a partir de:** 2026-07-06 · **Status:** vivo · **Operadora:** Kist Serviços Médicos LTDA (CNPJ 46.706.765/0001-42)

> ⚠️ **Rascunho técnico revisado — ainda requer validação jurídica e definição de negócio antes de execução.** Os prazos abaixo seguem a orientação usual do Conselho Federal de Medicina para guarda de prontuário; a implementação de qualquer rotina de exclusão automática é destrutiva e não foi codificada — carece de decisão explícita do responsável pelo produto antes de ligar qualquer expurgo automático.
>
> **Nota sobre a fase de testes restrita:** enquanto o LAUD.US estiver em fase de testes (ver Termos de Uso §1.3), dados podem ser resetados/migrados manualmente para ajuste da plataforma, mediante aviso — essa possibilidade é distinta e não substitui os prazos de retenção regulares descritos abaixo, que valem a partir do início da operação comercial plena.

## 1. Objeto

Definir por quanto tempo os dados tratados pelo LAUD.US são retidos e o processo para eliminação/anonimização ao final do prazo, em conformidade com a LGPD (art. 15/16) e as normas do CFM sobre prontuário médico.

## 2. Prazos de retenção

| Categoria de dado | Prazo de retenção recomendado | Base |
|---|---|---|
| **Laudo/prontuário médico** (exame, laudo, imagem DICOM associada) | Mínimo 20 anos a partir do último atendimento | Resolução CFM nº 1.821/2007 (guarda de prontuário em meio digital) |
| **Dados de conta do usuário profissional** (cadastro, CRM/RQE) | Enquanto a conta estiver ativa + 5 anos após encerramento (obrigações fiscais/contratuais) | Prazo geral de prescrição civil (Código Civil, art. 206) |
| **Dados de cobrança/faturamento** | 5 anos | Legislação fiscal brasileira |
| **Logs de auditoria de acesso** (`audit_logs`) | 5 anos | Suporte a investigação de incidentes de segurança/LGPD |
| **Dados de sessão/telemetria técnica (Sentry)** | 90 dias (configuração do próprio Sentry) | Finalidade puramente técnica, não há razão para reter além disso |

## 3. Processo de eliminação/anonimização

- **Encerramento de conta pelo usuário:** os dados de pacientes permanecem sob guarda pelo prazo do item 2 (a obrigação de guarda de prontuário é do profissional/clínica, não do produto); o cadastro do usuário profissional é marcado como inativo, não excluído, até o prazo aplicável.
- **Solicitação de exclusão pelo titular (paciente):** conforme LGPD art. 18, VI, a solicitação deve ser direcionada ao profissional/clínica responsável (controlador). O LAUD.US, como operador, deve oferecer uma via técnica para o controlador localizar e, quando legalmente possível, anonimizar ou excluir os dados do paciente identificado — **ainda não implementada em código** (ver seção 5, ação P2).
- **Fim do prazo de retenção:** ao final do prazo de guarda do prontuário, o dado deve ser anonimizado (preferencialmente) ou eliminado, conforme decisão do controlador (profissional/clínica).

## 4. O que já existe hoje (implementado)

- Anonimização automática de dados de paciente **antes de qualquer envio à IA** (não é retenção, é minimização em tempo de uso) — `src/modules/ai/training/anonymize.ts`.
- Trilha de auditoria de acesso a prontuário/laudo (`audit_logs`, via `logPatientAccess`).
- Limpeza automática de `pending_checkouts` com mais de 7 dias (rotina técnica, não dado de paciente) — `api/reset-monthly-reports.ts`.

## 5. Pendências (decisão de produto/negócio, não apenas técnicas)

- **P1 — Processo formal de atendimento a solicitação de titular:** definir fluxo (manual, no início; ou tela dedicada depois) para o controlador (profissional/clínica) atender pedidos de acesso/correção/exclusão de dados de paciente.
- **P2 — Rotina de expurgo ao fim do prazo legal:** hoje **não existe** rotina automática de exclusão/anonimização de dados após os prazos da seção 2 — decisão consciente para evitar apagar dado ainda sob obrigação legal de guarda. Antes de implementar qualquer exclusão automática, validar com jurídico o prazo exato aplicável a cada tipo de clínica/especialidade.
- **P3 — Criptografia de campo para CPF/RG:** dado sensível hoje protegido apenas por regra de acesso (Firestore Rules), não por criptografia em nível de campo. Avaliar custo/benefício de cifrar esses campos especificamente.

## 6. Contato

Dúvidas sobre esta política, ou solicitações ao Encarregado de Dados (DPO), podem ser encaminhadas para **contato.laudus@gmail.com**.
