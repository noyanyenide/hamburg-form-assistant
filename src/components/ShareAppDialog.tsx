import { Check, Copy, Share2 } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { Button, Dialog } from './ui';

/** Public address of the app itself (never contains any answers). */
export function appUrl(): string {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href;
}

export function ShareAppDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const url = appUrl();

  useEffect(() => {
    if (!open) return;
    setCopied(false);
    QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 4, color: { dark: '#0b2e4b', light: '#ffffff' } })
      .then((svg) => setQr(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`))
      .catch(() => setQr(null));
  }, [open, url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const canShare = typeof navigator.share === 'function';

  return (
    <Dialog open={open} onClose={onClose} title={t('share.title')} closeLabel={t('common.close')}>
      <p className="text-slate-700">{t('share.text')}</p>
      <div className="mt-4 flex justify-center">
        {qr && <img src={qr} alt={t('share.qrAlt')} className="size-60 rounded-xl ring-1 ring-slate-200" />}
      </div>
      <p className="mt-3 break-all text-center text-sm font-medium text-brand-800">{url}</p>
      <div className="mt-4 grid gap-2">
        {canShare && (
          <Button icon={<Share2 className="size-5" aria-hidden />} onClick={() => void navigator.share({ url, title: t('app.name') }).catch(() => undefined)}>
            {t('share.share')}
          </Button>
        )}
        <Button variant="secondary" icon={copied ? <Check className="size-5" aria-hidden /> : <Copy className="size-5" aria-hidden />} onClick={() => void copy()}>
          {copied ? t('share.copied') : t('share.copy')}
        </Button>
      </div>
    </Dialog>
  );
}
