# 🗺️ Arquitetura e Padrões de Engenharia — LAUD.US (v3.0.0)

Este documento serve como a especificação técnica oficial da arquitetura do sistema **LAUD.US**, descrevendo os padrões de design, fluxo de dados, lógica do motor de Inteligência Artificial e integrações periféricas.

---

## 1. Organização do Código (Feature-Scoping)

O projeto é estruturado seguindo o padrão de **Feature-Scoping (Módulos de Negócio)**. Todo o código específico de uma funcionalidade — incluindo visualizações (Views), modais de formulário, hooks específicos e estilos locais — reside no diretório do seu respectivo módulo em `src/modules/`. Isso garante o isolamento, a facilidade de manutenção e evita acoplamento desnecessário.

### Estrutura Global:
- **`src/components/`**: Componentes puramente apresentacionais ou utilitários globais de UI (ex: `Modal.tsx`, `Button.tsx`, `PageHeader.tsx`, `Toast.tsx`).
- **`src/hooks/`**: Hooks globais para gerenciar estados transversais à aplicação (ex: controle de autenticação e listeners genéricos do Firestore).
- **`src/lib/`**: Inicialização de bibliotecas externas de infraestrutura. Ex: [firebase.ts](file:///Users/matheuskistenmackerpires/Desktop/laudos-us/src/lib/firebase.ts).
- **`src/store/`**: Estado global da aplicação com **Zustand** e a camada de banco de dados [db.ts](file:///Users/matheuskistenmackerpires/Desktop/laudos-us/src/store/db.ts).
- **`src/modules/`**: Módulos de negócio isolados.
- **`src/types.ts`**: Repositório central de tipos e contratos TypeScript.

---

## 2. Fluxo de Dados e Persistência Multi-Tenant

Para atender à conformidade regulatória de segurança de dados de saúde (LGPD/HIPAA), o LAUD.US implementa isolamento de dados a nível de usuário físico autenticado (Multi-tenant isolado por UID).

```
Banco de Dados Firestore (Estrutura NoSQL)
├── Coleção Global: users/ (Cadastro e licenciamento dos médicos)
│   └── {uid}/
│       ├── Coleção scoped: exams/ (Laudos do médico)
│       ├── Coleção scoped: patients/ (Pacientes do médico)
│       ├── Coleção scoped: templates/ (Máscaras de laudo customizadas do médico)
│       └── Documento único: settings/app (Configurações locais do médico)
├── Coleção Global: audit_logs/ (Auditoria e segurança do sistema)
├── Coleção Global: support_tickets/ (Mensagens de suporte integradas)
└── Coleção Global: plans/ (Definições de planos e licenças de acesso)
```

### Regras de Acesso à Dados em `src/store/db.ts`:
- **`getUserPath(collectionName)`**: Garante que o caminho de escrita ou leitura seja sempre prefixado com `users/{uid}/{collectionName}`. Qualquer operação em exames ou pacientes sem usuário autenticado lança uma exceção imediata.
- **Auditoria de Escrita (`addItem`, `updateItem`)**: Centraliza as alterações injetando de maneira automática os timestamps Unix (`createdAt`, `updatedAt`) de precisão em milissegundos.
- **Herança de Configurações de Sistema**: A função `getSettings()` implementa um fallback hierárquico. Ao ler as configurações locais do médico autenticado, ela mescla as customizações locais do profissional (CRM, RQE, nome) com os prompts mestres publicados globalmente pelo e-mail do administrador do sistema (`matheuskpires@gmail.com`). Isso permite atualizações em tempo real das diretrizes da IA sem a necessidade de novos deploys.

---

## 3. A Engine LAUD.IA e Copiloto (Inteligência Artificial)

O motor de inteligência artificial reside em [gemini.ts](file:///Users/matheuskistenmackerpires/Desktop/laudos-us/src/modules/ai/gemini.ts) e opera com suporte duplo (Gemini/Claude). A construção do prompt é altamente estruturada e dividida em duas grandes camadas para tirar proveito do cache de tokens do provedor de nuvem (System Instruction Cache):

```
                        ╔══════════════════════════════════════════════╗
                        ║           SYSTEM INSTRUCTION (Estático)      ║
                        ║ 1. Prompt Mestre                             ║
                        ║ 2. Doutrina de Normalidade do Médico         ║
                        ║ 3. Protocolo da Especialidade (Área Médica)  ║
                        ║ 4. Instruções Globais e Regras Rígidas       ║
                        ╚══════════════════════════════════════════════╝
                                               │
                                               ▼
  ╔══════════════════════════════════════════════════════════════════════════════════╗
  ║                               USER MESSAGE (Dinâmico)                            ║
  ║ 1. Contexto do Paciente (Nome, Sexo, Idade calculada com base na data do exame)  ║
  ║ 2. Dados Clínicos (Indicação, Anamnese detalhada)                                ║
  ║ 3. Histórico de Estilo (Até 15KB de laudos anteriores como base de estilo)       ║
  ║ 4. Notas Adicionais / Comando do Médico                                          ║
  ║ 5. Máscara HTML de Referência (Estrutura física do laudo)                         ║
  ╚══════════════════════════════════════════════════════════════════════════════════╝
```

### Otimizações do Ciclo de Geração:
1. **Separação de Contexto Estático (Prompt Caching)**:
   - No Gemini 2.5, o `systemInstruction` é passado como parâmetro específico do modelo, ativando o cache automático.
   - No Claude, a estrutura de array `system` recebe a flag `cache_control: { type: 'ephemeral' }`.
   - Isso reduz drasticamente o tempo de resposta e o custo de tokens em prompts grandes (que contêm múltiplos exemplos clínicos).
2. **Ciclo de Refinamento e Cascata Tripartite (N1 a N4)**:
   - Regido por regras de consistência clínica rígidas: qualquer achado patológico incluído na **Análise** deve obrigatoriamente repercutir em um bullet na **Conclusão** e em uma conduta correlata nas **Recomendações**.
   - As recomendações seguem os níveis de risco clínico: `N1` (Rotina), `N2` (Acompanhamento em curto prazo), `N3` (Especialista urgente) e `N4` (Emergência imediata).
3. **Modo Copiloto (Redação Incremental)**:
   - Quando o médico envia instruções incrementais por voz ou texto ("exclua vesícula", "coloque nódulo de 2cm no fígado"), a IA entra no modo Copiloto.
   - O output é restrito estruturalmente através de marcadores rígidos:
     - `=== CONVERSA ===`: Frase clínica resumindo a ação (máx. 15 palavras).
     - `=== PROPOSTA ===`: O código HTML do laudo integral com a alteração mesclada cirurgicamente no parágrafo do órgão correspondente.
4. **Higienização do Output (`stripScratchpad`)**:
   - Defesa multicamadas contra vazamentos de raciocínio da IA (Chain of Thought / XML tags). Remove seções `<scratchpad>`, caixas de código markdown (fences ` ```html `) e qualquer resíduo textual que preceda a primeira tag de cabeçalho (`<h1>` ou `<h2>`).

---

## 4. Biblioteca e Registro de Calculadoras Clínicas

Todas as calculadoras médicas residem em `src/modules/calculators/components/` e são catalogadas no arquivo de registro central [registry.tsx](file:///Users/matheuskistenmackerpires/Desktop/laudos-us/src/modules/calculators/registry.tsx).

- **Padrão de Interface Comum**: Cada calculadora deve exportar um formulário interativo estruturado, disparando um evento de retorno contendo o resultado textual (HTML/Texto plano) e os valores numéricos brutos.
- **Inserção no Editor**: Ao finalizar o cálculo dentro da modal no editor de laudo, o resultado gerado é inserido de forma automática no cursor do TipTap, populando a análise física do laudo com as medições corretas (ex: volume prostático de 45g, idade gestacional de 12 semanas e 3 dias com DDP corrigida).

---

## 5. Fluxo de Exportação e Layouts de Impressão

### Exportador de Arquivos Word (`docxExport.ts`):
- O módulo de exportação analisa o código HTML gerado pelo editor de texto rico TipTap e converte os nós da árvore DOM em estruturas nativas da biblioteca `docx` de maneira sequencial:
  - Tags `<h2>` e `<h3>` viram elementos `Paragraph` com estilo de cabeçalho `HeadingLevel.HEADING_2` / `HeadingLevel.HEADING_3`.
  - Tags `<strong>`, `<em>` e `<u>` viram objetos `TextRun` com propriedades de formatação (bold, italic, underline).
  - Tags `<ul>` e `<ol>` viram elementos estruturados com numeração e marcadores do Office Open XML (OOXML).
- Insere cabeçalhos e rodapés específicos da clínica, bloco de dados do paciente e carimbo de assinatura médica com CRM/RQE ao final do arquivo.

### Layout de Impressão de Imagens (`PrintImagesLayout.tsx`):
- Gerencia o layout físico de impressão de imagens DICOM capturadas diretamente do PACS.
- Organiza a folha de impressão em uma grade fotográfica otimizada para laudos radiológicos (grade de 2 colunas com 3 linhas por página, totalizando até 6 fotos por folha) com alto contraste e margens corretas de corte de impressora.
