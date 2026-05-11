# Sistema de Laudos Ultrassonográficos

Sistema pessoal e local para geração de laudos de ultrassom com auxílio de IA (Google Gemini).
Roda 100% no seu navegador — todos os dados ficam armazenados localmente (IndexedDB).

---

## ⚡ Instalação rápida

Pré-requisito: ter o **Node.js 18+** instalado ([nodejs.org](https://nodejs.org)).

```bash
# 1. Instalar dependências
npm install

# 2. Rodar em modo desenvolvimento
npm run dev
```

O sistema abrirá automaticamente em `http://localhost:5173`.

Para gerar uma versão de produção:
```bash
npm run build
npm run preview
```

---

## 🔑 Configurando a API do Gemini

1. Acesse [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Faça login com sua conta Google
3. Clique em **Create API key** → copie a chave
4. No sistema, vá em **Configurações** → cole a API Key → **Salvar**

A API tem **camada gratuita generosa** (suficiente para uso pessoal).
A chave é armazenada apenas no seu navegador.

---

## 🩺 Fluxo de uso

### 1. Configure suas máscaras
Em **Máscaras** → carregue as 7 de exemplo (uma por área) ou crie do zero.
Cada máscara contém:
- Estrutura do laudo (Título, Técnica, Análise, Conclusão, Classificação, Recomendações)
- Campos de formulário customizados (caixas, dropdowns, medidas, etc)
- Instruções específicas para a IA

### 2. Cadastre seus pacientes
Em **Pacientes** → cadastre dados completos (identificação, contato, endereço, convênio, histórico).

### 3. Crie um novo laudo
Em **Novo Laudo** (ou no botão "+ Novo Laudo" da Worklist):
1. Selecione **área + máscara**
2. Selecione (ou crie) o **paciente**
3. Adicione **médico solicitante** e **indicação clínica**
4. Sistema abre o **editor**

### 4. No editor
- À esquerda: **formulário dinâmico** com os campos da máscara
- À direita: **rich text editor** com o laudo
- Clique em **"Gerar Laudo com IA"** para a IA produzir o laudo
- Edite livremente o resultado
- **Auto-save** ativo — não precisa salvar manualmente
- Mude o status: **Pendente → Em Andamento → Finalizado**

### 5. Exportação
- **Copiar** (formatado para colar em Google Docs)
- **Exportar .docx** (download de arquivo Word com cabeçalho da clínica e assinatura)

---

## 📂 Estrutura do projeto

```
src/
├── components/        # UI compartilhada (Sidebar, Modal, Toast)
├── modules/
│   ├── worklist/      # Lista de exames
│   ├── patients/      # Cadastro de pacientes
│   ├── forms/         # Novo Exame + DynamicForm
│   ├── editor/        # ExamEditor + RichEditor (TipTap)
│   ├── ai/            # Integração Gemini
│   ├── export/        # Exportação .docx
│   ├── templates/     # Editor de máscaras
│   └── settings/      # Configurações
├── data/              # Templates iniciais (seed)
├── store/             # IndexedDB (Dexie) + Zustand
├── utils/             # Helpers
└── types.ts           # Tipos centrais
```

### Stack técnica
- **React 18** + **TypeScript** + **Vite 6**
- **Tailwind CSS** (tema custom)
- **Dexie 4** (IndexedDB) para persistência local
- **Zustand** para estado global
- **TipTap** para editor rich text
- **@google/generative-ai** SDK
- **docx** + **file-saver** para exportação .docx
- **lucide-react** para ícones

---

## 🔒 Sobre privacidade

- **Tudo é local**: os dados ficam no IndexedDB do seu navegador
- **Sem servidor próprio**: não há backend deste sistema
- **Apenas uma chamada externa**: a API do Gemini, quando você clica em "Gerar Laudo"
  - Os dados enviados ao Gemini são: máscara, achados do formulário, dados básicos do paciente (nome, DN), indicação clínica
  - **Atenção**: se for usar com pacientes reais, considere o termo de uso do Google Gemini e ajuste para anonimizar dados sensíveis se necessário

⚠️ **Faça backups periódicos**: Configurações → Exportar backup (.json). Limpar o cache do navegador apaga tudo.

---

## 🗺️ Roadmap (ideias futuras)

Itens pensados mas não incluídos no MVP:

- [ ] **Calculadoras** integradas:
  - Idade gestacional por DUM e por biometria
  - Percentis fetais (Hadlock, Intergrowth-21st)
  - Dopplervelocimetria (índices de pulsatilidade)
  - Volume tireoidiano
  - Relação cintura-quadril
- [ ] **Sincronização opcional com Google Drive** (multi-dispositivo)
- [ ] **Imagens no laudo** (anexar, redimensionar, anotar)
- [ ] **Histórico clínico longitudinal** com comparação automática
- [ ] **Templates por instituição** (separar máscaras de clínicas diferentes)
- [ ] **Modo offline real** (PWA) para tablet à beira do paciente
- [ ] **Atalhos de teclado** para preenchimento rápido
- [ ] **Importação de DICOM SR** (se aplicável)
- [ ] **Worklist DICOM** (integração com modalidade — projeto avançado)

---

## 🛠️ Solução de problemas

**O laudo gerado vem em "modo demo"**
→ Configure a API Key do Gemini em Configurações.

**"API Key inválida"**
→ Verifique se copiou a chave completa (sem espaços) e se está com cota disponível em [aistudio.google.com](https://aistudio.google.com).

**Os dados sumiram após limpar o navegador**
→ É a natureza do IndexedDB. Use **Configurações → Exportar backup** regularmente.

**Quero migrar para outro computador**
→ Configurações → Exportar backup → no novo computador, Importar backup.

---

## 📄 Licença

Uso pessoal. Modifique livremente.
