import { RefreshCw, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { AppProvider, useApp } from './app/AppContext';
import { AppShell } from './components/AppShell';
import { Button, Spinner } from './components/ui';
import { I18nProvider, useI18n } from './i18n';
import { LanguageScreen } from './screens/LanguageScreen';
import { PrivacyScreen } from './screens/PrivacyScreen';
import { ResultScreen } from './screens/ResultScreen';
import { ReviewScreen } from './screens/ReviewScreen';
import { SignScreen } from './screens/SignScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { WizardScreen } from './screens/WizardScreen';

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 6000);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);
  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4" role="status" aria-live="polite">
      <div className="flex max-w-md items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
        <span>{message}</span>
        <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-white/10" aria-label="OK">
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function UpdateBanner() {
  const { t } = useI18n();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-[max(0.5rem,env(safe-area-inset-top))]" role="status">
      <div className="flex max-w-md items-center gap-3 rounded-xl bg-brand-800 px-4 py-2 text-sm text-white shadow-lg">
        <span>{t('update.available')}</span>
        <Button size="sm" variant="secondary" icon={<RefreshCw className="size-4" aria-hidden />} onClick={() => void updateServiceWorker(true)}>
          {t('update.reload')}
        </Button>
        <button type="button" onClick={() => setNeedRefresh(false)} className="rounded-lg p-1 hover:bg-white/10" aria-label={t('common.close')}>
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function Screens() {
  const { t, language } = useI18n();
  const { ready, nav } = useApp();
  const [toast, setToast] = useState<string | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  let content;
  if (!ready) content = <Spinner label={t('common.loading')} />;
  else if (!language || nav.screen === 'language') content = null;
  else {
    switch (nav.screen) {
      case 'wizard':
        content = <WizardScreen />;
        break;
      case 'review':
        content = <ReviewScreen />;
        break;
      case 'sign':
        content = <SignScreen />;
        break;
      case 'result':
        content = <ResultScreen />;
        break;
      case 'privacy':
        content = <PrivacyScreen onToast={setToast} />;
        break;
      default:
        content = <WelcomeScreen />;
    }
  }

  return (
    <>
      {ready && (!language || nav.screen === 'language') ? <LanguageScreen /> : <AppShell onToast={setToast}>{content}</AppShell>}
      {toast && <Toast message={toast} onClose={closeToast} />}
      <UpdateBanner />
    </>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppProvider>
        <Screens />
      </AppProvider>
    </I18nProvider>
  );
}
