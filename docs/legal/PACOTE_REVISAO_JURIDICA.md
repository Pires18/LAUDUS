# Pacote para Revisão Jurídica — LAUD.US

**Preparado em:** 2026-07-05 · **Destinatário:** advogado(a) especializado(a) em direito digital/proteção de dados (LGPD) e, idealmente, com familiaridade em regulação de saúde (CFM/telemedicina/prontuário eletrônico).

Este documento organiza o que um profissional jurídico precisa para revisar os documentos legais do LAUD.US antes de publicação definitiva. Não é uma opinião jurídica — é o contexto técnico/operacional necessário para embasar uma.

---

## 1. Documentos a revisar

1. [Termos de Uso](TERMOS_DE_USO.md) — v1.0, rascunho técnico
2. [Política de Privacidade](POLITICA_DE_PRIVACIDADE.md) — v1.0, rascunho técnico
3. [Política de Retenção LGPD](../LGPD_POLITICA_RETENCAO.md) — v1.0, rascunho técnico

Todos os três já refletem, com boa fidelidade, o que o sistema **realmente faz** hoje (não são texto genérico de template) — foram escritos a partir de leitura direta do código. O que falta é validação jurídica: linguagem contratual apropriada, adequação regulatória, e cobertura de riscos que só um advogado identificaria.

---

## 2. O que é o LAUD.US (contexto para quem não viu o produto)

SaaS brasileiro (assinatura mensal/semestral/anual + add-ons) para profissionais de saúde (majoritariamente médicos ultrassonografistas) gerarem laudos de exames de imagem com apoio de inteligência artificial. Fluxo: profissional agenda o exame → aparelho de ultrassom envia imagens para um servidor PACS gerenciado pelo LAUD.US → profissional revisa as imagens e usa IA (Google Gemini) para redigir o laudo → revisa/edita/assina → exporta em PDF ou Google Docs.

**Natureza dos dados envolvidos:** dados de saúde de terceiros (pacientes dos médicos-clientes) — categoria sensível pela LGPD (art. 5º, II e art. 11).

---

## 3. Papéis (controlador/operador) — para confirmar o enquadramento

- **Profissional de saúde / clínica (cliente pagante do LAUD.US):** tratamos como **controlador** dos dados de pacientes — é quem decide coletar, tratar e reter o dado de saúde do paciente, no exercício da relação assistencial.
- **LAUD.US (a plataforma):** tratamos como **operador**, processando os dados só conforme instrução/uso contratado pelo controlador.
- **Google (Firebase + Gemini):** subcontratado/suboperador do LAUD.US.

**Pergunta para o advogado:** esse enquadramento de três camadas (paciente → controlador/médico → operador/LAUD.US → suboperador/Google) está correto e é suficiente, ou a LGPD exige alguma formalização adicional entre essas camadas (ex.: contrato de suboperação com o Google, aviso mais explícito ao paciente sobre o suboperador)?

---

## 4. Pontos que precisam especificamente de julgamento jurídico

### 4.1 Base legal para IA processar dado de saúde
Hoje o texto assume base legal em "execução de contrato/tutela da saúde" (LGPD art. 11, II, "f") para o profissional processar dados do paciente via IA. **Pergunta:** essa base é suficiente para o uso de um modelo de IA de terceiro (Google Gemini) especificamente, mesmo com a anonimização aplicada (ver §4.2), ou é recomendável exigir consentimento explícito do paciente para ESSA finalidade específica (uso de IA)?

### 4.2 Anonimização como mitigador
**O que o sistema faz de fato (verificado no código):** antes de qualquer chamada à API do Gemini, o sistema remove automaticamente nome, CPF, RG, telefone e e-mail do paciente do texto enviado — preserva idade, sexo, medidas e histórico clínico textual (que pode conter informação re-identificável indiretamente, ex. "paciente com endometriose diagnosticada em 2019"). **Pergunta:** essa anonimização é suficiente para tirar o tratamento da categoria de "dado pessoal sensível" perante a IA (art. 12 LGPD, dado anonimizado deixa de ser dado pessoal), ou o dado clínico residual ainda é considerado pessoal/sensível mesmo sem identificadores diretos?

### 4.3 Transferência internacional de dados
Firebase (Google Cloud) e Gemini processam os dados em infraestrutura do Google, que pode envolver servidores fora do Brasil. **Pergunta:** isso configura transferência internacional de dados sujeita ao art. 33 da LGPD? Se sim, que cláusulas contratuais (com o Google) ou avisos ao usuário/paciente são necessários? (Nota: ainda não formalizamos um DPA — Data Processing Agreement — específico com o Google; hoje o LAUD.US opera sob os termos padrão de Firebase/Google Cloud.)

### 4.4 Retenção — prazo e base normativa
O rascunho usa 20 anos como prazo de guarda de prontuário, citando a Resolução CFM nº 1.821/2007 (que trata de prontuário em meio digital, mas foi editada antes de resoluções mais recentes sobre prontuário eletrônico, como a Resolução CFM nº 2.299/2021 e atualizações posteriores). **Pergunta:** o prazo/norma citados ainda são os vigentes e aplicáveis a um laudo de imagem gerado numa plataforma terceirizada (não o prontuário completo do paciente, que fica com o médico), ou o LAUD.US como operador tem uma obrigação de retenção diferente da do médico como controlador?

### 4.5 Assinatura do laudo — validade jurídica
Hoje o sistema permite anexar uma **imagem escaneada** da assinatura do médico no rodapé do PDF — não é assinatura digital com certificado ICP-Brasil. **Pergunta:** um laudo médico assinado só dessa forma tem validade jurídica plena como documento médico oficial, ou isso expõe o médico/a plataforma a risco de contestação da autenticidade do documento? (Já identificamos a lacuna — desenho de integração com ClickSign/D4Sign documentado em `docs/roadmaps/ASSINATURA_ICP_BRASIL.md` — mas a implementação está pendente de decisão de fornecedor.)

### 4.6 Consentimento do PACIENTE vs aceite do MÉDICO
O checkbox de aceite de Termos/Privacidade implementado hoje é assinado pelo **profissional/cliente pagante**, não pelo paciente. O consentimento (ou base legal equivalente) do paciente para ter seus dados processados pela plataforma é responsabilidade do médico/clínica na relação assistencial, fora do fluxo de cadastro do LAUD.US. **Pergunta:** essa divisão de responsabilidade está clara o suficiente no texto dos Termos, ou é recomendável adicionar uma cláusula mais explícita responsabilizando o profissional por obter a base legal adequada junto ao paciente?

### 4.7 Alegações de SLA/segurança na tela de login
A tela de login e a landing exibem selos como "HIPAA · AES-256 · LGPD" e "SLA Clínico 99.99%". **Pergunta:** essas são alegações que criam obrigação contratual/responsabilidade caso não sejam cumpridas à risca (ex.: HIPAA é uma lei americana — a plataforma realmente atende a todos os requisitos técnicos e administrativos da HIPAA, ou o selo deveria ser removido/qualificado para evitar propaganda enganosa)?

### 4.8 Entidade jurídica e CNPJ
O rodapé da landing institucional (`landing/index.html`) tem um placeholder `CNPJ: [preencher antes do deploy]`. **Pergunta/ação:** confirmar a razão social/CNPJ que efetivamente vai figurar como contratante nos Termos de Uso antes da publicação — isso é pré-requisito para o documento ter validade contratual.

---

## 5. O que já está tecnicamente implementado (para calibrar o texto conforme a realidade)

- Anonimização automática antes de qualquer chamada de IA (`src/modules/ai/training/anonymize.ts`).
- Trilha de auditoria de acesso a prontuário/laudo (`logPatientAccess`, `audit_logs`).
- Checkbox obrigatório de aceite de Termos/Privacidade no cadastro, com registro de versão e timestamp (`users/{uid}.termsAcceptedAt/termsVersion`).
- Verificação de e-mail obrigatória (contas e-mail/senha) antes de gerar laudos com IA.
- Criptografia de credenciais de integração DICOM por usuário.
- **Não implementado ainda:** assinatura digital ICP-Brasil, portal de solicitação de titular de dados (paciente), rotina automática de expurgo/anonimização ao fim do prazo de retenção, DPA formal com o Google.

---

## 6. Resumo do que precisamos do advogado

1. Validar/ajustar a linguagem contratual dos 3 documentos (não são peças jurídicas finais, são rascunhos técnicos).
2. Responder às 8 perguntas da seção 4 — cada uma pode mudar o texto ou exigir uma feature adicional.
3. Confirmar a razão social/CNPJ a constar nos documentos.
4. Indicar se algum destes pontos é bloqueador para operar comercialmente hoje, ou se pode ser endereçado em fases (ex.: ICP-Brasil pode vir depois, mas base legal de IA não pode).
