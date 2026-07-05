# Política de Privacidade — LAUD.US

**Versão:** 1.0 · **Vigência a partir de:** 2026-07-05

> ⚠️ **Rascunho técnico — requer revisão jurídica** antes de publicação definitiva. O conteúdo reflete o tratamento de dados realmente implementado no sistema nesta versão (ver `docs/DOCUMENTACAO_OFICIAL.md` e `docs/AUDITORIA_COMPLETA_2026-07.md`), mas a formalização como política vinculante deve ser validada por profissional jurídico especializado em LGPD/saúde digital.

## 1. Controlador e dados de contato

O profissional de saúde ou clínica cadastrada no LAUD.US é o **controlador** dos dados de pacientes inseridos na plataforma (Lei nº 13.709/2018, art. 5º, VI). O LAUD.US atua como **operador**, processando os dados exclusivamente conforme as instruções do controlador e a finalidade contratada.

## 2. Dados coletados

**Do profissional/usuário da plataforma:** nome, e-mail, CRM/RQE, telefone, dados de clínica(s), dados de pagamento (processados por terceiro, ver seção 5).

**Do paciente (inseridos pelo profissional):** nome, CPF/RG (quando aplicável), data de nascimento, sexo, contato, histórico clínico, exames, imagens DICOM e laudos.

## 3. Finalidade do tratamento

- Prestação do serviço contratado: geração assistida de laudos, gestão de pacientes, agenda e integração PACS/DICOM.
- Cumprimento de obrigações legais/regulatórias aplicáveis a prontuários e laudos médicos.
- Cobrança e gestão da assinatura.

## 4. Base legal (LGPD art. 7º e art. 11º — dado sensível de saúde)

O tratamento de dados de saúde do paciente é realizado com base na **execução de contrato/tutela da saúde** pelo profissional responsável (art. 11, II, "f"), sendo o profissional/clínica responsável por obter o consentimento ou base legal adequada junto ao paciente, conforme sua relação assistencial. O tratamento dos dados do **usuário da plataforma** (profissional) é baseado na execução do contrato de prestação de serviço SaaS (art. 7º, V) e, quando aplicável, no consentimento registrado no cadastro.

## 5. Compartilhamento com terceiros

| Terceiro | Finalidade | Dados envolvidos |
|---|---|---|
| **Google (Firebase)** | Hospedagem de banco de dados, autenticação e armazenamento de arquivos | Todos os dados da plataforma |
| **Google (Gemini API)** | Geração assistida de texto de laudo via IA | Dados clínicos **anonimizados antes do envio** (nome, CPF, RG, telefone e e-mail do paciente são removidos previamente; idade, sexo e medidas são preservados) |
| **AbacatePay** | Processamento de pagamentos da assinatura | Dados de cobrança do usuário profissional (não dados de pacientes) |
| **Sentry** (quando ativado) | Monitoramento de erros técnicos | Metadados técnicos, com redação automática de e-mail/CPF/telefone antes do envio |

Não compartilhamos dados de pacientes com terceiros para fins de marketing ou publicidade.

## 6. Medidas de segurança implementadas

- Autenticação obrigatória e regras de acesso por usuário/clínica no banco de dados (Firestore Security Rules).
- Trilha de auditoria de acesso a prontuários e laudos (registro de quem visualizou qual dado, quando).
- Senhas de integração DICOM armazenadas com criptografia AES-256.
- Cabeçalhos de segurança HTTP e política de segurança de conteúdo (CSP) no servidor.
- Minimização de dados enviados à IA (pseudonimização automática antes de qualquer chamada ao modelo de linguagem).

## 7. Retenção e exclusão de dados

O prazo de retenção segue a política descrita em `docs/LGPD_POLITICA_RETENCAO.md`, alinhada às recomendações do Conselho Federal de Medicina para guarda de prontuário médico. O titular do dado (paciente) pode solicitar informações sobre o tratamento de seus dados diretamente ao profissional/clínica responsável (controlador).

## 8. Direitos do titular (LGPD art. 18)

O titular dos dados (paciente ou usuário profissional) tem direito a: confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação e informação sobre compartilhamento com terceiros. Solicitações devem ser direcionadas ao profissional/clínica responsável pelo prontuário (controlador) ou, no caso de dados do usuário profissional, ao suporte da plataforma.

## 9. Cookies e dados de navegação

A plataforma utiliza armazenamento local do navegador (localStorage) para manter sessão e preferências de uso — não utilizamos cookies de rastreamento publicitário de terceiros.

## 10. Alterações desta política

Alterações materiais serão comunicadas e exigirão novo aceite do usuário antes do próximo uso da plataforma.

## 11. Contato

Solicitações relacionadas a dados pessoais podem ser encaminhadas ao canal de suporte da plataforma.
