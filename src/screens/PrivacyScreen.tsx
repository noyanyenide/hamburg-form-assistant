import { ArrowLeft, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../app/AppContext';
import { DeleteDataDialog } from '../components/AppShell';
import { Button, Card } from '../components/ui';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/types';

const POINTS: MessageKey[] = ['privacy.p1', 'privacy.p2', 'privacy.p3', 'privacy.p4', 'privacy.p5', 'privacy.p6', 'privacy.p7', 'privacy.p8'];

export function PrivacyScreen({ onToast }: { onToast: (message: string) => void }) {
  const { t } = useI18n();
  const { saveEnabled, setSaveEnabled } = useApp();
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" icon={<ArrowLeft className="size-4" aria-hidden />} onClick={() => window.history.back()} className="-ml-2">
        {t('nav.back')}
      </Button>
      <h1 className="flex items-center gap-2 text-2xl font-bold text-brand-800">
        <ShieldCheck className="size-7" aria-hidden />
        {t('privacy.title')}
      </h1>
      <Card>
        <ul className="list-disc space-y-3 pl-5 leading-relaxed text-slate-800">
          {POINTS.map((p) => (
            <li key={p}>{t(p)}</li>
          ))}
        </ul>
      </Card>
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
      <Card className="space-y-3">
        <h2 className="text-lg font-bold">{t('privacy.deleteTitle')}</h2>
        <p className="text-slate-700">{t('privacy.deleteText')}</p>
        <Button variant="dangerOutline" icon={<Trash2 className="size-5" aria-hidden />} onClick={() => setDeleteOpen(true)} block>
          {t('delete.button')}
        </Button>
      </Card>
      <p className="text-xs text-slate-500">{t('app.unofficial')}</p>
      <DeleteDataDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onDeleted={onToast} />
    </div>
  );
}
