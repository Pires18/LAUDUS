// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PlaygroundPanel } from '../modules/laud-ia/components/PlaygroundPanel';
import type { ReportTemplate } from '../types';

afterEach(cleanup);

const templates = [
  { id: 't1', name: 'Tireoide', area: 'cabeca-pescoco' },
] as unknown as ReportTemplate[];

/** Props base do playground; cada teste sobrescreve o que precisa. */
function baseProps(overrides: Partial<React.ComponentProps<typeof PlaygroundPanel>> = {}) {
  return {
    templateSubTab: 'exams' as const,
    selectedAreaFilter: '' as const,
    templates,
    selectedTemplateId: '',
    setSelectedTemplateId: vi.fn(),
    notes: '',
    setNotes: vi.fn(),
    onRun: vi.fn(),
    isTesting: false,
    result: '',
    score: null,
    scratchpad: '',
    ...overrides,
  };
}

describe('<PlaygroundPanel />', () => {
  it('estado vazio: mostra o convite para simular e nenhum laudo', () => {
    render(<PlaygroundPanel {...baseProps()} />);
    expect(screen.getByText(/Simule o laudo para ver os resultados/i)).toBeTruthy();
    expect(screen.queryByText(/Laudo Gerado/i)).toBeNull();
  });

  it('digitar nas notas dispara setNotes com o valor', () => {
    const setNotes = vi.fn();
    render(<PlaygroundPanel {...baseProps({ setNotes })} />);
    const textarea = screen.getByPlaceholderText(/Digite notas médicas de teste/i);
    fireEvent.change(textarea, { target: { value: 'nódulo TI-RADS 3' } });
    expect(setNotes).toHaveBeenCalledWith('nódulo TI-RADS 3');
  });

  it('botão Simular fica desabilitado sem máscara selecionada', () => {
    render(<PlaygroundPanel {...baseProps({ selectedTemplateId: '' })} />);
    expect((screen.getByRole('button', { name: /Simular Laudo/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('com máscara selecionada, o botão habilita e o clique chama onRun', () => {
    const onRun = vi.fn();
    render(<PlaygroundPanel {...baseProps({ selectedTemplateId: 't1', onRun })} />);
    const button = screen.getByRole('button', { name: /Simular Laudo/i }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it('enquanto testa, mostra "Simulando..." e "Chamando IA..."', () => {
    render(<PlaygroundPanel {...baseProps({ isTesting: true, selectedTemplateId: 't1' })} />);
    expect(screen.getByText(/Simulando/i)).toBeTruthy();
    expect(screen.getByText(/Chamando IA/i)).toBeTruthy();
  });

  it('com resultado: renderiza o laudo (HTML), o scratchpad e a nota da auditoria', () => {
    render(
      <PlaygroundPanel
        {...baseProps({
          result: '<p>Tireoide de dimensões normais.</p>',
          score: { score: 92, issues: [] },
          scratchpad: 'passo 1: medir lobos',
        })}
      />,
    );
    expect(screen.getByText(/Tireoide de dimensões normais/i)).toBeTruthy();
    expect(screen.getByText(/passo 1: medir lobos/i)).toBeTruthy();
    expect(screen.getByText(/Nota: 92\/100/i)).toBeTruthy();
    expect(screen.getByText(/Sem erros de conformidade/i)).toBeTruthy();
  });

  it('com issues na auditoria, lista cada mensagem', () => {
    render(
      <PlaygroundPanel
        {...baseProps({
          result: '<p>x</p>',
          score: {
            score: 60,
            issues: [
              { severity: 'error', message: 'Faltou a conclusão TI-RADS' },
              { severity: 'warning', message: 'Medidas em unidade ambígua' },
            ],
          },
        })}
      />,
    );
    expect(screen.getByText(/Nota: 60\/100/i)).toBeTruthy();
    expect(screen.getByText(/Faltou a conclusão TI-RADS/i)).toBeTruthy();
    expect(screen.getByText(/Medidas em unidade ambígua/i)).toBeTruthy();
  });
});
