import * as LucideIcons from 'lucide-react';
import { EXAM_AREAS } from '../types';

interface AreaIconProps extends LucideIcons.LucideProps {
  /** Aceita ExamArea ou qualquer string — exibe fallback se não encontrar */
  area: string;
}

/**
 * Componente centralizado para renderizar o ícone de uma área clínica específica.
 * Garante que a identidade visual seja consistente em todo o sistema.
 */
export function AreaIcon({ area, ...props }: AreaIconProps) {
  const areaMeta = EXAM_AREAS.find(a => a.id === area);
  
  if (!areaMeta) {
    return <LucideIcons.Stethoscope {...props} />;
  }

  // O ícone é armazenado como string no EXAM_AREAS (ex: 'Stethoscope')
  // Buscamos o componente correspondente no objeto LucideIcons
  const icons = LucideIcons as unknown as Record<string, LucideIcons.LucideIcon>;
  const IconComponent = icons[areaMeta.icon] || LucideIcons.Stethoscope;

  return <IconComponent {...props} />;
}
