import { Component, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Cloud } from 'lucide-react';
import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
  inline?: boolean;
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error('ErrorBoundary caught:', error);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.inline) {
        return (
          <div className="flex flex-col items-center justify-center gap-3 py-16 px-8 text-center">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-500" />
            </div>
            <p className="text-sm font-semibold text-ink-700">
              Erro ao carregar{this.props.label ? ` ${this.props.label}` : ''}
            </p>
            <button
              onClick={this.handleRetry}
              className="text-xs text-brand-600 hover:text-brand-700 font-semibold flex items-center gap-1"
            >
              <RotateCcw size={12} />
              Tentar novamente
            </button>
          </div>
        );
      }
      return (
        <div className="min-h-screen bg-ink-50 flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-medium border border-ink-100 p-8 text-center animate-scale-in">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-5">
              <AlertTriangle size={28} className="text-red-500" />
            </div>
            <h1 className="text-xl font-semibold text-ink-900 mb-2">
              Algo deu errado
            </h1>
            <p className="text-sm text-ink-600 mb-6 leading-relaxed">
              Ocorreu um erro inesperado na aplicação. Seus dados estão seguros
              no navegador. Tente recarregar a página.
            </p>

            {this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-xs text-ink-500 cursor-pointer hover:text-ink-700">
                  Detalhes técnicos
                </summary>
                <pre className="mt-2 p-3 bg-ink-50 rounded-lg text-xs text-ink-600 overflow-auto max-h-32 font-mono">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={this.handleReload}
                className="btn-primary w-full justify-center"
              >
                <RotateCcw size={15} />
                Recarregar Aplicação
              </button>
              <button
                onClick={() => alert('Fique tranquilo, seus dados estão salvos na nuvem do LAUD.US (Firebase). Tente recarregar a página.')}
                className="btn-secondary w-full justify-center"
              >
                <Cloud size={15} />
                Dados Seguros na Nuvem
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
