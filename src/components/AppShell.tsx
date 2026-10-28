import { FileText, Globe, Home, ListChecks, Menu, ShieldCheck, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useApp } from '../app/AppContext';
import { useI18n } from '../i18n';
import { LANGUAGES, type Language } from '../i18n/types';
import { Button, Dialog } from './ui';

export const LANGUAGE_LABELS: Record<Language, { flag: string; name: string }> = {
  tr: { flag: '🇹🇷', name: 'Türkçe' },
  de: { flag: '🇩🇪', name: 'Deutsch' },
  en: { flag: '🇬🇧', name: 'English' },
};

export function LanguageButtons({ onPick, current }: { onPick: (l: Language) => void; current?: Language | null }) {
  return (
    <div className="grid gap-3">
      {LANGUAGES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          onClick={() => onPick(l)}
          aria-current={current === l ? 'true' : undefined}
          className={`flex min-h-14 items-center gap-4 rounded-2xl border px-4 text-left text-lg font-semibold transition-colors ${
            current === l ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-slate-300 bg-white hover:bg-slate-50'
          }`}
        >
          <span className="text-2xl" aria-hidden>
            {LANGUAGE_LABELS[l].flag}
          </span>
          {LANGUAGE_LABELS[l].name}
        </button>
      ))}
    </div>
  );
}

export function DeleteDataDialog({ open, onClose, onDeleted }: { open: boolean; onClose: () => void; onDeleted: (message: string) => void }) {
  const { t } = useI18n();
  const { deleteEverything } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} title={t('delete.confirmTitle')} closeLabel={t('common.close')}>
      <p className="text-slate-700">{t('delete.confirmText')}</p>
      <div className="mt-5 grid gap-2">
        <Button
          variant="danger"
          busy={busy}
          icon={<Trash2 className="size-5" aria-hidden />}
          onClick={async () => {
            setBusy(true);
            const message = t('delete.done');
            try {
              await deleteEverything();
            } finally {
              setBusy(false);
              onClose();
              onDeleted(message);
            }
          }}
        >
          {t('delete.confirm')}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {t('delete.cancel')}
        </Button>
      </div>
    </Dialog>
  );
}

export function AppShell({ children, onToast }: { children: ReactNode; onToast: (message: string) => void }) {
  const { t, language, setLanguage } = useI18n();
  const { navigate, nav, furthestStep } = useApp();
  const [languageOpen, setLanguageOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const menuItem = (icon: ReactNode, label: string, onClick: () => void, danger = false) => (
    <button
      type="button"
      onClick={() => {
        setMenuOpen(false);
        onClick();
      }}
      className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left font-medium hover:bg-slate-100 ${danger ? 'text-red-700' : 'text-ink'}`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="pt-safe sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-3">
          <FileText className="size-6 shrink-0 text-brand-700" aria-hidden />
          <p className="min-w-0 flex-1 truncate font-bold text-brand-800">{t('app.name')}</p>
          <button
            type="button"
            onClick={() => setLanguageOpen(true)}
            className="flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
            aria-label={`${t('menu.language')}: ${language ? LANGUAGE_LABELS[language].name : ''}`}
          >
            <Globe className="size-5" aria-hidden />
            <span className="uppercase">{language}</span>
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex size-11 items-center justify-center rounded-xl text-brand-700 hover:bg-brand-50"
            aria-label={t('nav.menu')}
          >
            <Menu className="size-6" aria-hidden />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-8 pt-4">{children}</main>

      <Dialog open={languageOpen} onClose={() => setLanguageOpen(false)} title={t('menu.language')} closeLabel={t('common.close')}>
        <LanguageButtons
          current={language}
          onPick={(l) => {
            setLanguage(l);
            setLanguageOpen(false);
          }}
        />
      </Dialog>

      <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} title={t('nav.menu')} closeLabel={t('common.close')}>
        <nav className="grid gap-1">
          {menuItem(<Home className="size-5" aria-hidden />, t('nav.home'), () => navigate({ screen: 'welcome' }))}
          {furthestStep > 0 &&
            nav.screen !== 'review' &&
            menuItem(<ListChecks className="size-5" aria-hidden />, t('nav.review'), () => navigate({ screen: 'review' }))}
          {menuItem(<ShieldCheck className="size-5" aria-hidden />, t('privacy.title'), () => navigate({ screen: 'privacy' }))}
          <hr className="my-2 border-slate-200" />
          {menuItem(<Trash2 className="size-5" aria-hidden />, t('delete.button'), () => setDeleteOpen(true), true)}
        </nav>
      </Dialog>

      <DeleteDataDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onDeleted={onToast} />
    </div>
  );
}
