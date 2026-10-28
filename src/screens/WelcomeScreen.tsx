import { ArrowRight, CheckCircle2, Download, Languages, Lock, PenLine, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../app/AppContext';
import { Alert, Button, Card, Dialog } from '../components/ui';
import { STEPS } from '../form/steps';
import { useI18n } from '../i18n';

export function WelcomeScreen() {
  const { t, locale } = useI18n();
  const { hasDraft, lastSaved, goToStep, nav, startOver, saveEnabled, setSaveEnabled, navigate } = useApp();
  const [confirmRestart, setConfirmRestart] = useState(false);

  const points = [
    { icon: <Languages className="size-5" aria-hidden />, text: t('welcome.point1') },
    { icon: <PenLine className="size-5" aria-hidden />, text: t('welcome.point2') },
    { icon: <Download className="size-5" aria-hidden />, text: t('welcome.point3') },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-brand-600">{t('app.subtitle')}</p>
        <h1 className="mt-1 text-2xl font-bold leading-tight text-brand-800">{t('welcome.heading')}</h1>
        <p className="mt-3 leading-relaxed text-slate-700">{t('welcome.lead')}</p>
      </div>

      <ul className="space-y-2">
        {points.map((p) => (
          <li key={p.text} className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">{p.icon}</span>
            <span className="font-medium">{p.text}</span>
          </li>
        ))}
      </ul>

      <Card className="space-y-2 bg-emerald-50/60 ring-emerald-200">
        <p className="flex items-center gap-2 font-semibold text-emerald-900">
          <Lock className="size-5" aria-hidden />
          {t('welcome.privacyTitle')}
        </p>
        <p className="text-sm leading-relaxed text-emerald-900">{t('welcome.privacyText')}</p>
        <button type="button" onClick={() => navigate({ screen: 'privacy' })} className="text-sm font-semibold text-brand-700 underline underline-offset-2">
          {t('welcome.privacyLink')}
        </button>
      </Card>

      <div className="space-y-3">
        {hasDraft ? (
          <>
            <Button block iconRight={<ArrowRight className="size-5" aria-hidden />} onClick={() => goToStep(nav.stepId)}>
              {t('welcome.resume')}
            </Button>
            {lastSaved && (
              <p className="flex items-center justify-center gap-1.5 text-sm text-slate-600">
                <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
                {t('welcome.lastSaved', {
                  date: lastSaved.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }),
                })}
              </p>
            )}
            <Button block variant="secondary" icon={<RotateCcw className="size-5" aria-hidden />} onClick={() => setConfirmRestart(true)}>
              {t('welcome.startOver')}
            </Button>
          </>
        ) : (
          <Button block iconRight={<ArrowRight className="size-5" aria-hidden />} onClick={() => goToStep(STEPS[0].id)}>
            {t('welcome.start')}
          </Button>
        )}
      </div>

      <Card>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={saveEnabled}
            onChange={(e) => void setSaveEnabled(e.target.checked)}
            className="mt-1 size-5 shrink-0 accent-brand-700"
          />
          <span>
            <span className="block font-semibold">{t('welcome.saveLocally')}</span>
            <span className="block text-sm text-slate-600">{t('welcome.saveLocallyHelp')}</span>
          </span>
        </label>
      </Card>

      <Alert tone="warning">{t('welcome.disclaimer')}</Alert>
      <p className="text-xs text-slate-500">{t('app.unofficial')}</p>

      <Dialog open={confirmRestart} onClose={() => setConfirmRestart(false)} title={t('welcome.startOver')} closeLabel={t('common.close')}>
        <p className="text-slate-700">{t('delete.confirmText')}</p>
        <div className="mt-5 grid gap-2">
          <Button
            variant="danger"
            onClick={async () => {
              setConfirmRestart(false);
              await startOver();
            }}
          >
            {t('delete.confirm')}
          </Button>
          <Button variant="secondary" onClick={() => setConfirmRestart(false)}>
            {t('delete.cancel')}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
