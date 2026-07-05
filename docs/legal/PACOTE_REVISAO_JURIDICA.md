# Pacote para Revisão Jurídica — LAUD.US

**Preparado em:** 2026-07-05 · **Atualizado em:** 2026-07-06 (v2 dos documentos, contexto de operação solo) · **Destinatário:** advogado(a) especializado(a) em direito digital/proteção de dados (LGPD) e, idealmente, com familiaridade em regulação de saúde (CFM/telemedicina/prontuário eletrônico).

Este documento organiza o que um profissional jurídico precisa para revisar os documentos legais do LAUD.US antes de publicação definitiva. Não é uma opinião jurídica — é o contexto técnico/operacional necessário para embasar uma.

---

## 1. Documentos a revisar

1. [Termos de Uso](TERMOS_DE_USO.md) — v2.0
2. [Política de Privacidade](POLITICA_DE_PRIVACIDADE.md) — v2.0
3. [Política de Retenção LGPD](../LGPD_POLITICA_RETENCAO.md) — v2.0

Todos os três já refletem, com boa fidelidade, o que o sistema **realmente faz** hoje (não são texto genérico de template) — foram escritos a partir de leitura direta do código, já contêm a identificação da operadora (razão social/CNPJ) e uma seção específica sobre a fase de testes restrita. O que falta é validação jurídica: linguagem contratual apropriada, adequação regulatória, e cobertura de riscos que só um advogado identificaria.

---

## 2. Contexto operacional atual (importante para a revisão)

- **Operação solo:** o sistema será operado inicialmente por uma única pessoa (médico), através da PJ **Kist Serviços Médicos LTDA** (CNPJ 46.706.765/0001-42).
- **Fase de testes restrita:** lançamento inicial para público limitado/convidado, não uma operação comercial ampla — já refletido nos Termos (§1.3) como "Programa de Testes Restrito", com cláusula de responsabilidade limitada e aviso de possível reset/instabilidade nesta fase.
- **O que é o LAUD.US (contexto para quem não viu o produto):** SaaS brasileiro (assinatura mensal/semestral/anual + add-ons) para profissionais de saúde (majoritariamente médicos ultrassonografistas) gerarem laudos de exames de imagem com apoio de inteligência artificial. Fluxo: profissional agenda o exame → aparelho de ultrassom envia imagens para um servidor PACS gerenciado pelo LAUD.US → profissional revisa as imagens e usa IA (Google Gemini) para redigir o laudo → revisa/edita/assina → exporta em PDF ou Google Docs.
- **Natureza dos dados envolvidos:** dados de saúde de terceiros (pacientes dos médicos-clientes) — categoria sensível pela LGPD (art. 5º, II e art. 11).

---

## 3. Papéis (controlador/operador) — para confirmar o enquadramento

- **Profissional de saúde / clínica (cliente pagante do LAUD.US):** tratado como **controlador** dos dados de pacientes — é quem decide coletar, tratar e reter o dado de saúde do paciente, no exercício da relação assistencial.
- **Kist Serviços Médicos LTDA (a operadora do LAUD.US):** tratada como **operadora**, processando os dados só conforme instrução/uso contratado pelo controlador.
- **Google (Firebase + Gemini):** subcontratado/suboperador da Kist Serviços Médicos LTDA.

**Pergunta 1 para o advogado:** esse enquadramento de três camadas (paciente → controlador/médico-cliente → operadora/Kist Serviços Médicos → suboperador/Google) está correto e é suficiente, ou a LGPD exige alguma formalização adicional entre essas camadas (ex.: contrato de suboperação com o Google, aviso mais explícito ao paciente sobre o suboperador)?

**Pergunta 2 para o advogado (específica da operação solo):** a razão social da operadora ("Kist Serviços Médicos LTDA") sugere uma sociedade médica. Como o serviço contratado aqui é **fornecimento de software** (não ato médico) — já explicitado no §1.2 dos Termos — há algum risco de confusão regulatória (perante o CFM/CRM ou perante o fisco/enquadramento de CNAE) em uma "sociedade de serviços médicos" atuar comercialmente como fornecedora de SaaS para terceiros médicos? Vale revisar se o CNAE da empresa cobre essa atividade, e se há alguma implicação ética (CFM) de um médico oferecer uma ferramenta comercial a colegas de profissão (ex.: regras de publicidade médica, Resolução CFM nº 1.974/2011 e atualizações).

---

## 4. Pontos que precisam especificamente de julgamento jurídico

### 4.1 Base legal para IA processar dado de saúde
O texto assume base legal em "execução de contrato/tutela da saúde" (LGPD art. 11, II, "f") para o profissional processar dados do paciente via IA. **Pergunta:** essa base é suficiente para o uso de um modelo de IA de terceiro (Google Gemini) especificamente, mesmo com a anonimização aplicada (ver §4.2), ou é recomendável exigir consentimento explícito do paciente para ESSA finalidade específica (uso de IA)?

### 4.2 Anonimização como mitigador
**O que o sistema faz de fato (verificado no código):** antes de qualquer chamada à API do Gemini, o sistema remove automaticamente nome, CPF, RG, telefone e e-mail do paciente do texto enviado — preserva idade, sexo, medidas e histórico clínico textual (que pode conter informação re-identificável indiretamente, ex. "paciente com endometriose diagnosticada em 2019"). **Pergunta:** essa anonimização é suficiente para tirar o tratamento da categoria de "dado pessoal sensível" perante a IA (art. 12 LGPD, dado anonimizado deixa de ser dado pessoal), ou o dado clínico residual ainda é considerado pessoal/sensível mesmo sem identificadores diretos?

### 4.3 Transferência internacional de dados
Firebase (Google Cloud) e Gemini processam os dados em infraestrutura do Google, que pode envolver servidores fora do Brasil — já sinalizado explicitamente na Política de Privacidade v2.0 (§6) como pendência de formalização. **Pergunta:** isso configura transferência internacional de dados sujeita ao art. 33 da LGPD? Se sim, que cláusulas contratuais (com o Google) ou avisos ao usuário/paciente são necessários, e isso é bloqueador para operar mesmo em fase de testes restrita, ou pode ser formalizado em paralelo?

### 4.4 Retenção — prazo e base normativa
O texto usa 20 anos como prazo de guarda de prontuário, citando a Resolução CFM nº 1.821/2007 (que trata de prontuário em meio digital, mas foi editada antes de resoluções mais recentes sobre prontuário eletrônico, como a Resolução CFM nº 2.299/2021 e atualizações posteriores). **Pergunta:** o prazo/norma citados ainda são os vigentes e aplicáveis a um laudo de imagem gerado numa plataforma terceirizada (não o prontuário completo do paciente, que fica com o médico), ou a operadora, como operadora de dados, tem uma obrigação de retenção diferente da do médico como controlador?

### 4.5 Assinatura do laudo — validade jurídica
Hoje o sistema permite anexar uma **imagem escaneada** da assinatura do médico no rodapé do PDF — não é assinatura digital com certificado ICP-Brasil. Já avisado explicitamente ao usuário nos Termos v2.0 (§3). **Pergunta:** um laudo médico assinado só dessa forma tem validade jurídica plena como documento médico oficial, ou isso expõe o médico/a operadora a risco de contestação da autenticidade do documento? É aceitável operar assim durante a fase de testes restrita, com o aviso já incluído nos Termos, ou isso deveria bloquear até a implementação de assinatura ICP-Brasil (desenho pronto em `docs/roadmaps/ASSINATURA_ICP_BRASIL.md`, pendente de escolha de fornecedor)?

### 4.6 Consentimento do PACIENTE vs aceite do MÉDICO
O checkbox de aceite de Termos/Privacidade é assinado pelo **profissional/cliente pagante**, não pelo paciente. O consentimento (ou base legal equivalente) do paciente para ter seus dados processados pela plataforma é responsabilidade do médico/clínica na relação assistencial, fora do fluxo de cadastro do LAUD.US — já explicitado no §5 da Política de Privacidade v2.0. **Pergunta:** essa divisão de responsabilidade está redigida de forma juridicamente suficiente, ou é recomendável reforçar ainda mais essa cláusula?

### 4.7 Alegações de SLA/segurança na tela de login e limitação de responsabilidade na fase de testes
A tela de login e a landing exibem selos como "HIPAA · AES-256 · LGPD" e "SLA Clínico 99.99%". Os Termos v2.0 (§1.3 e §7) já limitam a responsabilidade da operadora ao valor pago pelo usuário durante a fase de testes e nos 12 meses anteriores ao fato gerador em geral. **Pergunta:** essa cláusula de limitação é redigida de forma válida perante o CDC (quando aplicável) e o direito civil brasileiro? E as alegações de selo ("HIPAA" — lei americana — e "SLA 99.99%") são compatíveis com uma operação ainda em fase de testes, ou deveriam ser removidas/qualificadas até a operação comercial plena, para evitar risco de propaganda enganosa?

---

## 5. O que já está tecnicamente implementado (para calibrar o texto conforme a realidade)

- Anonimização automática antes de qualquer chamada de IA (`src/modules/ai/training/anonymize.ts`).
- Trilha de auditoria de acesso a prontuário/laudo (`logPatientAccess`, `audit_logs`).
- Checkbox obrigatório de aceite de Termos/Privacidade no cadastro, com registro de versão e timestamp (`users/{uid}.termsAcceptedAt/termsVersion`) — versão atual "2.0", força novo aceite de quem já tinha aceitado a v1.0.
- Verificação de e-mail obrigatória (contas e-mail/senha) antes de gerar laudos com IA.
- Criptografia de credenciais de integração DICOM por usuário.
- Isolamento de dados por clínica com proteção contra reatribuição indevida entre clínicas de donos diferentes (RBAC de equipe multiusuário).
- **Não implementado ainda:** assinatura digital ICP-Brasil, portal de solicitação de titular de dados (paciente), rotina automática de expurgo/anonimização ao fim do prazo de retenção, DPA formal com o Google.

---

## 6. Resumo do que precisamos do advogado

1. Validar/ajustar a linguagem contratual dos 3 documentos v2.0 (já identificam a operadora e a fase de testes — falta o refinamento jurídico final).
2. Responder às 2 perguntas da seção 3 (enquadramento controlador/operador + questão específica da sociedade médica operando SaaS) e às 7 perguntas da seção 4.
3. Indicar se algum destes pontos é bloqueador para iniciar a fase de testes restrita hoje, ou se pode ser endereçado em paralelo (ex.: ICP-Brasil e DPA formal com o Google podem vir depois; base legal de IA e enquadramento CFM da operadora provavelmente não podem esperar).
