# Arquitetura e Padrões LAUD.US

Este documento descreve os padrões técnicos e arquiteturais do sistema LAUD.US para garantir consistência e escalabilidade.

## 1. Estrutura de Diretórios

O projeto segue uma arquitetura baseada em funcionalidades (features/modules):

- `src/components`: Componentes de UI globais e reutilizáveis (Botões, Modais, Toasts).
- `src/modules`: Módulos de negócio independentes. Cada módulo deve conter sua lógica, componentes específicos e sub-diretórios se necessário.
- `src/store`: Estado global gerenciado com **Zustand**. O arquivo `db.ts` centraliza a comunicação com o Firebase Firestore.
- `src/hooks`: Hooks customizados reutilizáveis (ex: `useFirestore`).
- `src/lib`: Configuração de bibliotecas externas (Firebase, Google API).
- `src/types.ts`: Definições de tipos TypeScript globais.

## 2. Padrões de Código

### 2.1 Tipagem (TypeScript)
- Use tipos rigorosos. Evite `any`.
- Defina interfaces para todos os documentos do Firestore em `src/types.ts`.
- Use `Partial<T>` para atualizações parciais.

### 2.2 Componentes React
- Use componentes funcionais com Arrow Functions ou declarações `function`.
- Mantenha os componentes pequenos e focados.
- Use `lucide-react` para todos os ícones.
- Aplique animações com `framer-motion` para melhorar a experiência (micro-interações).

### 2.3 Estilização (Tailwind CSS)
- Use apenas classes do Tailwind.
- Siga a paleta de cores definida em `tailwind.config.js`:
  - `brand-*`: Cores da marca (azul clínico).
  - `ink-*`: Tons de cinza para textos e fundos neutros.
- Use sombras padronizadas: `shadow-soft`, `shadow-medium`, `shadow-premium`.

## 3. Fluxo de Dados e Persistência

### 3.1 Firebase Firestore
- O acesso aos dados é sempre "User-Scoped": `users/{uid}/{collection}/{docId}`.
- Use as funções auxiliares em `src/store/db.ts` (`addItem`, `updateItem`, `getItem`, etc.) para garantir que os timestamps (`createdAt`, `updatedAt`) sejam atualizados automaticamente.
- Use `useCollection` ou `useDocument` para sincronização em tempo real (Realtime Listeners).

### 3.2 Estado Global (Zustand)
- Use o `useApp` store para estado de UI global (navegação, toasts, configurações do usuário).
- Evite colocar dados de negócio pesados no estado global se eles puderem ser acessados diretamente via Firestore hooks.

## 4. LAUD.IA (Inteligência Artificial)

O motor de IA usa o Google Gemini. O prompt é construído dinamicamente em `src/modules/ai/gemini.ts` combinando:
1. **Prompt Mestre**: Instruções globais.
2. **Prompts de Área/Exame**: Especificidades clínicas.
3. **Máscara**: Estrutura física do laudo.
4. **Achados**: Dados coletados no formulário.

## 5. Padronização de UI (Checklist)

Ao criar uma nova tela ou componente, garanta:
- [ ] Uso do `PageHeader` para títulos de página.
- [ ] Responsividade total (mobile-first).
- [ ] Feedback visual para ações de carregamento (`Loader2`) e erro.
- [ ] Uso consistente de bordas (`border-ink-100`) e fundos (`bg-ink-50`).
