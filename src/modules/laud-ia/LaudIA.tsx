import { PageHeader } from '../../components/PageHeader';
import { SharedLaudIA } from './SharedLaudIA';
import { BrainCircuit } from 'lucide-react';

export function LaudIA() {
  return (
    <div className="module-container">
      <PageHeader
        title="Personalização LAUD.IA"
        subtitle="Gerencie seu estilo de redação, personalize diretrizes por especialidade e monitore a telemetria do seu copiloto clínico."
        icon={BrainCircuit}
      />
      <SharedLaudIA readOnly={true} />
    </div>
  );
}
