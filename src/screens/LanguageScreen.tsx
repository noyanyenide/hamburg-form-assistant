import { FileText } from 'lucide-react';
import { useApp } from '../app/AppContext';
import { LanguageButtons } from '../components/AppShell';
import { useI18n } from '../i18n';

/** First screen: shown in all three languages at once, before any choice is made. */
export function LanguageScreen() {
  const { setLanguage } = useI18n();
  const { navigate } = useApp();
  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <span className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-brand-700 text-white">
          <FileText className="size-8" aria-hidden />
        </span>
        <h1 className="text-2xl font-bold text-brand-800">
          <span lang="tr" className="block">Dilinizi seçin</span>
          <span lang="de" className="block">Sprache wählen</span>
          <span lang="en" className="block">Choose your language</span>
        </h1>
      </div>
      <LanguageButtons
        onPick={(l) => {
          setLanguage(l);
          navigate({ screen: 'welcome' });
        }}
      />
      <p className="mt-8 text-center text-xs text-slate-500">
        <span lang="tr" className="block">Hamburg oturum izni dilekçesi için doldurma yardımcısı</span>
        <span lang="de" className="block">Ausfüllhilfe für den Hamburger Antrag auf einen Aufenthaltstitel</span>
        <span lang="en" className="block">Form helper for the Hamburg residence permit application</span>
      </p>
    </main>
  );
}
