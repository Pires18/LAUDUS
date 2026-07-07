import { Stethoscope, Flower2, Baby, ScanSearch, Bone, Waves, ToyBrick, Syringe, Dna, Ribbon, type LucideProps, type LucideIcon } from 'lucide-react';
import { EXAM_AREAS } from '../types';

interface AreaIconProps extends LucideProps {
  /** Aceita ExamArea ou qualquer string — exibe fallback se não encontrar */
  area: string;
}

// Mapa estático (nomes importados diretamente) em vez de `import * as LucideIcons`
// + lookup dinâmico por string: o import de namespace impedia o Rollup de
// tree-shakear o pacote (3904 ícones exportados, ~200 usados no app inteiro) —
// tudo que não é referenciado por nome explícito acabava no bundle de produção
// mesmo assim, porque o bundler não consegue provar estaticamente quais chaves
// de `LucideIcons[nome]` são acessadas em runtime. Precisa bater 1:1 com os
// valores de `icon` em EXAM_AREAS (src/types.ts).
const AREA_ICONS: Record<string, LucideIcon> = {
  Stethoscope, Flower2, Baby, ScanSearch, Bone, Waves, ToyBrick, Syringe, Dna, Ribbon,
};

/**
 * Componente centralizado para renderizar o ícone de uma área clínica específica.
 * Garante que a identidade visual seja consistente em todo o sistema.
 */
export function AreaIcon({ area, ...props }: AreaIconProps) {
  const areaMeta = EXAM_AREAS.find(a => a.id === area);
  const IconComponent = (areaMeta && AREA_ICONS[areaMeta.icon]) || Stethoscope;
  return <IconComponent {...props} />;
}
