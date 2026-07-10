import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Activity, RotateCw, LayoutDashboard } from 'lucide-react';
import i18n from '../i18n';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
}

// Catches any render/runtime error in the React tree and shows a friendly fallback
// instead of a blank white screen. Must be a class component (error boundaries only
// work as classes). Wraps the whole app.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface for debugging; a real deployment would forward this to an error service.
    console.error('Unhandled error caught by ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const t = i18n.t.bind(i18n);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-center px-6">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Activity size={19} className="text-white" />
          </div>
          <span className="text-lg font-bold text-white tracking-tight">ProTracker</span>
        </div>

        <div className="inline-flex p-4 rounded-2xl bg-red-500/10 mb-5">
          <RotateCw size={32} className="text-red-500" />
        </div>
        <h1 className="text-2xl font-black text-white">{t('ui.somethingWrong', 'Something went wrong')}</h1>
        <p className="mt-2 text-sm text-gray-400 max-w-sm leading-relaxed">
          {t('ui.errorBoundaryDesc', 'We hit an unexpected error. Our team has been notified. You can head back to your dashboard or reload the page.')}
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-all cursor-pointer"
          >
            <LayoutDashboard size={16} /> {t('nav.goToDashboard', 'Go to Dashboard')}
          </a>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-semibold transition-all cursor-pointer"
          >
            <RotateCw size={16} /> {t('ui.reloadPage', 'Reload Page')}
          </button>
        </div>
      </div>
    );
  }
}
