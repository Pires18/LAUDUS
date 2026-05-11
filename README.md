# LAUD.US — Sistema de Laudos Ultrassonográficos Premium

Sistema profissional para geração e gerenciamento de laudos de ultrassonografia com auxílio de Inteligência Artificial (Google Gemini). Totalmente responsivo, seguro e sincronizado via Firebase.

---

## 🚀 Tecnologias Core
- **Frontend**: React 18 + TypeScript + Vite 6
- **Backend**: Firebase Firestore + Authentication
- **Estilização**: Tailwind CSS (Tema Premium Customizado)
- **IA**: Google Gemini (SDK `@google/generative-ai`)
- **Estado**: Zustand + Firestore Sync
- **Editor**: TipTap (Rich Text Engine)
- **Exportação**: Docx (Geração de arquivos Word profissionais)

---

## ⚡ Instalação e Desenvolvimento

1. **Clonar e Instalar**:
   ```bash
   npm install
   ```

2. **Configuração**:
   - Crie um arquivo `.env.local` baseado na estrutura do Firebase.
   - Adicione suas credenciais do Firebase.

3. **Rodar Local**:
   ```bash
   npm run dev
   ```

---

## 🩺 Arquitetura do Sistema

O sistema é organizado em módulos funcionais independentes em `src/modules/`:

- **Dashboard**: Visão geral e métricas de exames.
- **Worklist**: Gerenciamento central de exames e status (Pendente, Em Andamento, Finalizado).
- **Editor**: O coração do sistema. Integra formulários dinâmicos com o editor de texto rico.
- **LAUD.IA**: Motor de IA que transforma achados de formulários em textos médicos estruturados.
- **Patients**: Base de dados de pacientes com histórico e detalhes.
- **Templates (Máscaras)**: Editor visual para criar estruturas de laudos e formulários personalizados.
- **Calculators**: Biblioteca de calculadoras clínicas (Fetal, Tireoide, Próstata, etc).
- **Clinics**: Suporte multi-clínica para cabeçalhos e logotipos distintos.

---

## 🔒 Segurança e Privacidade

- **Authentication**: Acesso restrito via Firebase Auth.
- **Isolamento de Dados**: Cada usuário possui seu próprio "espaço" no Firestore (User-Scoped).
- **Processamento de IA**: Os dados enviados ao Gemini são via API e não são usados para treinamento público (conforme termos do Google AI Studio).
- **Backups**: Sincronização em tempo real com a nuvem, garantindo que nenhum dado seja perdido ao limpar o cache do navegador.

---

## 🛠️ Padronização e Estilo de Código

Para manter o sistema consistente, seguimos estas diretrizes:
1. **Componentes**: Devem ser funcionais, usar `lucide-react` para ícones e classes do Tailwind baseadas nos tokens (`brand`, `ink`).
2. **Estado**: Global no Zustand, persistido/sincronizado no Firestore via `db.ts`.
3. **Tipagem**: TypeScript rigoroso. Evitar `any` a todo custo.
4. **Nomenclatura**: CamelCase para componentes e arquivos `.tsx`, camelCase para funções e constantes.

---

## 🗺️ Roadmap Atualizado

- [x] **Migração para Firebase**: Persistência em nuvem e multi-dispositivo.
- [x] **LAUD.IA 2.0**: Prompts customizáveis por área e por exame.
- [x] **Sistema de Calculadoras**: Integração dinâmica nos formulários.
- [ ] **Modo Offline**: Sincronização via Service Workers (PWA).
- [ ] **Assinatura Digital**: Integração com certificados ICP-Brasil.
- [ ] **DICOM Viewer**: Visualização básica de imagens anexadas.

---

## 📄 Licença

Uso profissional e pessoal. Desenvolvido para máxima eficiência clínica.
