import { ArrowLeft, Camera, Download, ExternalLink, Info, Pencil, PenLine, RefreshCw, Share2, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../app/AppContext';
import { Alert, Button, Card, Spinner } from '../components/ui';
import { useI18n } from '../i18n';
import { TemplateIntegrityError, loadPdfAssets } from '../pdf/assets';
import type { PreviewDocument } from '../pdf/preview';

/** Deliberately contains no personal data. */
const FILE_NAME = 'Antrag-Aufenthaltstitel-Hamburg.pdf';
const ZOOM_LEVELS = [1, 1.5, 2.25];

function PdfPreview({ bytes }: { bytes: Uint8Array }) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvases = useRef<Array<HTMLCanvasElement | null>>([]);
  const [doc, setDoc] = useState<PreviewDocument | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(0);
  const [width, setWidth] = useState(0);
  const [renderedKey, setRenderedKey] = useState<string | null>(null);

  useEffect(() => {
    let opened: PreviewDocument | null = null;
    let cancelled = false;
    // PDF.js is large; it is only loaded when a preview is shown.
    import('../pdf/preview')
      .then(({ openPreview }) => openPreview(bytes))
      .then((d) => {
        opened = d;
        if (cancelled) void d.destroy();
        else setDoc(d);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      void opened?.destroy();
    };
  }, [bytes]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // clientWidth includes the container's 8px padding on each side
    const measure = () => setWidth(Math.max(0, el.clientWidth - 16));
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, []);

  const zoom = ZOOM_LEVELS[zoomIndex];
  const renderKey = `${Math.round(width)}-${zoom}`;
  useEffect(() => {
    if (!doc || width === 0) return;
    let stale = false;
    // The template's printed text consists of high-resolution image masks, so
    // rendering takes a moment: pages are shown only once fully rendered.
    (async () => {
      for (let i = 1; i <= doc.numPages && !stale; i++) {
        const canvas = canvases.current[i - 1];
        if (canvas) await doc.renderPage(i, canvas, Math.floor(width * zoom));
      }
      if (!stale) setRenderedKey(renderKey);
    })().catch(() => !stale && setFailed(true));
    return () => {
      stale = true;
    };
  }, [doc, renderKey, width, zoom]);

  if (failed) return <Alert tone="warning">{t('result.previewError')}</Alert>;

  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-2">
        <Button variant="secondary" size="sm" aria-label={t('result.zoomOut')} disabled={zoomIndex === 0} onClick={() => setZoomIndex((z) => z - 1)}>
          <ZoomOut className="size-5" aria-hidden />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          aria-label={t('result.zoomIn')}
          disabled={zoomIndex === ZOOM_LEVELS.length - 1}
          onClick={() => setZoomIndex((z) => z + 1)}
        >
          <ZoomIn className="size-5" aria-hidden />
        </Button>
      </div>
      <div
        ref={containerRef}
        data-rendered={renderedKey === renderKey || undefined}
        aria-busy={renderedKey !== renderKey}
        className="relative max-h-[75dvh] min-h-64 overflow-auto rounded-xl bg-slate-300 p-2 ring-1 ring-slate-300"
      >
        {renderedKey !== renderKey && (
          <div className="absolute inset-0 z-10 flex items-start justify-center bg-slate-200/90">
            <Spinner label={t('common.loading')} />
          </div>
        )}
        {doc &&
          Array.from({ length: doc.numPages }, (_, i) => (
            <canvas
              key={`${i}-${renderKey}`}
              ref={(el) => {
                canvases.current[i] = el;
              }}
              role="img"
              aria-label={t('a11y.pdfPage', { n: i + 1 })}
              className="mb-2 block bg-white shadow last:mb-0"
            />
          ))}
      </div>
    </div>
  );
}

type State =
  | { status: 'generating' }
  | { status: 'ready'; bytes: Uint8Array; url: string }
  | { status: 'error'; kind: 'integrity' | 'fit' | 'other' };

export function ResultScreen() {
  const { t } = useI18n();
  const { form, signature, navigate } = useApp();
  const [state, setState] = useState<State>({ status: 'generating' });
  const [attempt, setAttempt] = useState(0);
  const signOnPaper = form.getValues('signing.signOnPaper');

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    setState({ status: 'generating' });
    (async () => {
      try {
        const [assets, { generatePdf }] = await Promise.all([loadPdfAssets(), import('../pdf/engine')]);
        const result = await generatePdf(assets, form.getValues(), { signaturePng: signOnPaper ? null : signature });
        if (cancelled) return;
        if (result.problems.length > 0) {
          setState({ status: 'error', kind: 'fit' });
          return;
        }
        url = URL.createObjectURL(new Blob([result.bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' }));
        setState({ status: 'ready', bytes: result.bytes, url });
      } catch (error) {
        if (!cancelled) setState({ status: 'error', kind: error instanceof TemplateIntegrityError ? 'integrity' : 'other' });
      }
    })();
    return () => {
      cancelled = true;
      // The completed PDF only ever exists in memory; release it when leaving.
      if (url) URL.revokeObjectURL(url);
    };
  }, [attempt, form, signature, signOnPaper]);

  const download = useCallback(() => {
    if (state.status !== 'ready') return;
    const a = document.createElement('a');
    a.href = state.url;
    a.download = FILE_NAME;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [state]);

  const file = state.status === 'ready' ? new File([state.bytes.slice().buffer as ArrayBuffer], FILE_NAME, { type: 'application/pdf' }) : null;
  const canShare = Boolean(file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] }));

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: FILE_NAME });
    } catch {
      /* cancelled by the user */
    }
  };

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" icon={<ArrowLeft className="size-4" aria-hidden />} onClick={() => navigate({ screen: 'sign' })} className="-ml-2">
        {t('nav.back')}
      </Button>
      <h1 className="text-2xl font-bold text-brand-800">{t('result.title')}</h1>

      {state.status === 'generating' && <Spinner label={t('result.generating')} />}

      {state.status === 'error' && (
        <Alert tone="error" role="alert" title={t('result.error')}>
          <p>{state.kind === 'integrity' ? t('result.integrityError') : state.kind === 'fit' ? t('result.fitError') : ''}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {state.kind === 'fit' ? (
              <Button size="sm" variant="secondary" icon={<Pencil className="size-4" aria-hidden />} onClick={() => navigate({ screen: 'review' })}>
                {t('nav.review')}
              </Button>
            ) : (
              <Button size="sm" variant="secondary" icon={<RefreshCw className="size-4" aria-hidden />} onClick={() => setAttempt((a) => a + 1)}>
                {t('result.retry')}
              </Button>
            )}
          </div>
        </Alert>
      )}

      {state.status === 'ready' && (
        <>
          <Alert tone="success" role="status">
            {t('result.ready')}
          </Alert>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button block icon={<Download className="size-5" aria-hidden />} onClick={download}>
              {t('result.download')}
            </Button>
            {canShare ? (
              <Button block variant="secondary" icon={<Share2 className="size-5" aria-hidden />} onClick={() => void share()}>
                {t('result.share')}
              </Button>
            ) : (
              <Button block variant="secondary" icon={<ExternalLink className="size-5" aria-hidden />} onClick={() => window.open(state.url, '_blank', 'noopener')}>
                {t('result.open')}
              </Button>
            )}
          </div>
          <PdfPreview bytes={state.bytes} />
          <p className="flex gap-2 text-sm text-slate-600">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t('result.privacyHint')}
          </p>
        </>
      )}

      <Card className="space-y-3">
        <h2 className="text-lg font-bold">{t('result.next')}</h2>
        <ul className="space-y-2">
          <li className="flex gap-2">
            <Camera className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
            {t('result.nextPhoto')}
          </li>
          {signOnPaper && (
            <li className="flex gap-2">
              <PenLine className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
              {t('result.nextSignPaper')}
            </li>
          )}
          <li className="flex gap-2">
            <Info className="mt-0.5 size-5 shrink-0 text-brand-700" aria-hidden />
            {t('result.nextSubmit')}
          </li>
        </ul>
      </Card>

      <Button variant="secondary" block icon={<Pencil className="size-5" aria-hidden />} onClick={() => navigate({ screen: 'review' })}>
        {t('result.edit')}
      </Button>
    </div>
  );
}
