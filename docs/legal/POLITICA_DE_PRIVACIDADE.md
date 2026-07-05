# Política de Privacidade — LAUD.US

**Versão:** 2.0 · **Vigência a partir de:** 2026-07-06 · **Operadora:** Kist Serviços Médicos LTDA (CNPJ 46.706.765/0001-42)

> ⚠️ **Rascunho técnico revisado — ainda requer validação jurídica final** antes de publicação definitiva, em especial quanto ao enquadramento de transferência internacional (§6) e à suficiência da base legal para uso de IA sobre dado de saúde (§4). O conteúdo reflete o tratamento de dados realmente implementado no sistema nesta versão.

## 1. Identificação da operadora e papéis (controlador/operador)

Esta Política de Privacidade é publicada por **Kist Serviços Médicos LTDA**, CNPJ 46.706.765/0001-42 ("LAUD.US" ou "operadora"), fornecedora da plataforma de software descrita nos [Termos de Uso](TERMOS_DE_USO.md).

- O **profissional de saúde ou clínica cadastrada** no LAUD.US é o **controlador** dos dados de pacientes inseridos na plataforma (LGPD, art. 5º, VI) — é quem decide coletar, tratar e reter o dado de saúde do paciente, no exercício da sua própria relação assistencial.
- O **LAUD.US (Kist Serviços Médicos LTDA)** atua como **operador**, tratando os dados exclusivamente conforme as instruções do controlador e a finalidade contratada (fornecimento do software).
- O **Google** (Firebase/Gemini) atua como **suboperador** da Kist Serviços Médicos LTDA, nos termos descritos na seção 6.

**Encarregado de Dados (DPO), nos termos do art. 41 da LGPD:** contato **contato.laudus@gmail.com**.

## 2. Dados coletados

**Do profissional/usuário da plataforma:** nome, e-mail, CRM/RQE, telefone, dados de clínica(s), dados de pagamento (processados por terceiro, ver seção 6).

**Do paciente (inseridos pelo profissional):** nome, CPF/RG (quando aplicável), data de nascimento, sexo, contato, histórico clínico, exames, imagens DICOM e laudos.

## 3. Finalidade do tratamento

- Prestação do serviço contratado: geração assistida de laudos, gestão de pacientes, agenda e integração PACS/DICOM.
- Cumprimento de obrigações legais/regulatórias aplicáveis a prontuários e laudos médicos.
- Cobrança e gestão da assinatura.

## 4. Base legal (LGPD art. 7º e art. 11 — dado sensível de saúde)

O tratamento de dados de saúde do paciente é realizado com base na **execução de contrato/tutela da saúde** pelo profissional responsável (art. 11, II, "f"), sendo o profissional/clínica responsável por obter o consentimento ou base legal adequada junto ao paciente, conforme sua relação assistencial — **o LAUD.US não coleta nem processa consentimento do paciente diretamente**; essa é uma responsabilidade do profissional controlador, fora do fluxo de cadastro da plataforma. O tratamento dos dados do **usuário da plataforma** (profissional) é baseado na execução do contrato de prestação de serviço SaaS (art. 7º, V) e no consentimento registrado no cadastro (checkbox de aceite dos Termos, com registro de versão/data).

**Sobre o uso de inteligência artificial:** antes de qualquer chamada ao modelo de IA (Google Gemini), o sistema remove automaticamente identificadores diretos do paciente (nome, CPF, RG, telefone, e-mail), preservando apenas dado clínico necessário (idade, sexo, medidas, histórico textual). Essa minimização reduz — mas o usuário profissional deve estar ciente de que não necessariamente elimina por completo — o risco de reidentificação a partir de informação clínica residual.

## 5. Dados de saúde e a relação com o paciente

O paciente cujo dado é tratado na plataforma **não é o contratante do LAUD.US** — é o profissional/clínica quem contrata o serviço, na qualidade de controlador dos dados do paciente. Cabe ao profissional, na sua relação assistencial, informar o paciente sobre o uso de ferramentas de apoio (incluindo IA) na elaboração do laudo, e obter a base legal/consentimento cabível para o tratamento de seus dados nesta plataforma, conforme as normas éticas e legais aplicáveis ao exercício da medicina.

## 6. Compartilhamento com terceiros (suboperadores)

| Terceiro | Finalidade | Dados envolvidos | Localização do processamento |
|---|---|---|---|
| **Google (Firebase)** | Hospedagem de banco de dados, autenticação e armazenamento de arquivos | Todos os dados da plataforma | Infraestrutura global do Google Cloud (pode incluir processamento fora do Brasil) |
| **Google (Gemini API)** | Geração assistida de texto de laudo via IA | Dados clínicos **anonimizados antes do envio** (nome, CPF, RG, telefone e e-mail do paciente são removidos previamente; idade, sexo e medidas são preservados) | Infraestrutura global do Google Cloud |
| **AbacatePay** | Processamento de pagamentos da assinatura | Dados de cobrança do usuário profissional (não dados de pacientes) | Brasil |
| **Sentry** (quando ativado) | Monitoramento de erros técnicos | Metadados técnicos, com redação automática de e-mail/CPF/telefone antes do envio | Conforme configuração do provedor |

**Transferência internacional de dados (LGPD art. 33):** o uso de infraestrutura do Google (Firebase/Gemini) pode envolver processamento de dados em servidores localizados fora do Brasil. A operadora está formalizando o enquadramento contratual dessa transferência (contrato de suboperação/DPA com o Google) — enquanto essa formalização não é concluída, o usuário profissional deve considerar esse fator ao decidir inserir dados de pacientes na plataforma durante a fase de testes.

Não compartilhamos dados de pacientes com terceiros para fins de marketing ou publicidade.

## 7. Medidas de segurança implementadas

- Autenticação obrigatória e regras de acesso por usuário/clínica no banco de dados (Firestore Security Rules), incluindo isolamento entre clínicas e proteção contra reatribuição indevida de registros entre clínicas de donos diferentes.
- Trilha de auditoria de acesso a prontuários e laudos (registro de quem visualizou qual dado, quando).
- Senhas de integração DICOM armazenadas com criptografia AES-256.
- Cabeçalhos de segurança HTTP e política de segurança de conteúdo (CSP) no servidor.
- Minimização de dados enviados à IA (pseudonimização automática antes de qualquer chamada ao modelo de linguagem).
- Verificação de e-mail obrigatória para geração de laudos com IA (contas cadastradas por e-mail/senha).

## 8. Retenção e exclusão de dados

O prazo de retenção segue a política descrita na [Política de Retenção de Dados](../LGPD_POLITICA_RETENCAO.md), alinhada às recomendações do Conselho Federal de Medicina para guarda de prontuário médico. O titular do dado (paciente) pode solicitar informações sobre o tratamento de seus dados diretamente ao profissional/clínica responsável (controlador) — que é quem detém a relação assistencial e a obrigação legal correspondente.

## 9. Direitos do titular (LGPD art. 18)

O titular dos dados (paciente ou usuário profissional) tem direito a: confirmação de tratamento, acesso, correção, anonimização, portabilidade, eliminação e informação sobre compartilhamento com terceiros.

- **Dados de paciente:** solicitações devem ser direcionadas ao profissional/clínica responsável pelo prontuário (controlador). A plataforma oferece ao controlador os meios técnicos para atender a essas solicitações (exportação, correção, exclusão de registros), mas não atende diretamente o paciente, por não ter relação contratual direta com ele.
- **Dados do usuário profissional:** solicitações podem ser direcionadas a **contato.laudus@gmail.com**.

## 10. Cookies e dados de navegação

A plataforma utiliza armazenamento local do navegador (localStorage) para manter sessão e preferências de uso — não utilizamos cookies de rastreamento publicitário de terceiros.

## 11. Incidentes de segurança

Em caso de incidente de segurança que possa acarretar risco ou dano relevante aos titulares, a operadora comunicará a Autoridade Nacional de Proteção de Dados (ANPD) e os titulares afetados (por meio dos controladores, no caso de dados de pacientes), na forma e prazo exigidos pela LGPD (art. 48).

## 12. Alterações desta política

Alterações materiais serão comunicadas e exigirão novo aceite do usuário antes do próximo uso da plataforma.

## 13. Contato

Solicitações relacionadas a dados pessoais, ou dúvidas sobre esta política, podem ser encaminhadas para **contato.laudus@gmail.com**.
