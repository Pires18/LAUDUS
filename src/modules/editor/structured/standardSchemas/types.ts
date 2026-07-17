import { StructuredSection } from '../../../../types';

/** Definição de um MODELO PADRÃO de formulário estruturado por exame. */
export interface StandardSchemaDef {
  /** Nome do modelo (para exibição/identificação). */
  name: string;
  /**
   * Regex casada contra o nome da máscara NORMALIZADO (minúsculas, sem
   * acentos). Cópias pessoais ("X (Personalizada)") também casam. A lista de
   * cada área é ordenada do mais específico para o mais genérico.
   */
  match: RegExp;
  /** Fábrica das seções — retorna instâncias novas a cada chamada. */
  sections: () => StructuredSection[];
}
