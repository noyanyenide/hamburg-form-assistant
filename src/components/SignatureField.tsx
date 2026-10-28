import { Eraser, PenLine, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import SignaturePad from 'signature_pad';
import { useI18n } from '../i18n';
import { Button } from './ui';

const INK = '#0b1f5c';

/** Crops the drawing to its strokes (plus a small margin) and returns PNG bytes. */
async function exportTrimmedPng(canvas: HTMLCanvasElement): Promise<Uint8Array | null> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  const margin = Math.round(4 * (window.devicePixelRatio || 1));
  minX = Math.max(0, minX - margin);
  minY = Math.max(0, minY - margin);
  maxX = Math.min(width - 1, maxX + margin);
  maxY = Math.min(height - 1, maxY + margin);
  const out = document.createElement('canvas');
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext('2d')?.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
  if (!blob) return null;
  return new Uint8Array(await blob.arrayBuffer());
}

interface Props {
  /** Previously saved signature (PNG bytes), shown instead of the pad until re-signing. */
  saved: Uint8Array | null;
  onChange: (png: Uint8Array | null) => void;
  invalid?: boolean;
  describedBy?: string;
}

export function SignatureField({ saved, onChange, invalid, describedBy }: Props) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [editing, setEditing] = useState(!saved);
  const [savedUrl, setSavedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!saved) {
      setSavedUrl(null);
      return;
    }
    const url = URL.createObjectURL(new Blob([saved.slice().buffer as ArrayBuffer], { type: 'image/png' }));
    setSavedUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [saved]);

  const emit = useCallback(async () => {
    const canvas = canvasRef.current;
    const pad = padRef.current;
    if (!canvas || !pad) return;
    const empty = pad.isEmpty();
    setIsEmpty(empty);
    onChange(empty ? null : await exportTrimmedPng(canvas));
  }, [onChange]);

  useEffect(() => {
    if (!editing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pad = new SignaturePad(canvas, { penColor: INK, minWidth: 0.9, maxWidth: 2.8, throttle: 8 });
    padRef.current = pad;

    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const strokes = pad.toData();
      const { width, height } = canvas.getBoundingClientRect();
      if (width === 0) return;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.getContext('2d')?.scale(ratio, ratio);
      pad.clear();
      if (strokes.length) pad.fromData(strokes);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const onEnd = () => void emit();
    pad.addEventListener('endStroke', onEnd);
    return () => {
      observer.disconnect();
      pad.removeEventListener('endStroke', onEnd);
      pad.off();
      padRef.current = null;
    };
  }, [editing, emit]);

  const clear = () => {
    padRef.current?.clear();
    setIsEmpty(true);
    onChange(null);
  };

  const undo = () => {
    const pad = padRef.current;
    if (!pad) return;
    const data = pad.toData();
    data.pop();
    pad.fromData(data);
    void emit();
  };

  if (!editing && savedUrl) {
    return (
      <div className="space-y-3">
        <div className="flex h-44 items-center justify-center rounded-2xl border-2 border-slate-300 bg-white p-4">
          <img src={savedUrl} alt={t('sign.signatureLabel')} className="max-h-full max-w-full object-contain" />
        </div>
        <Button
          variant="secondary"
          icon={<PenLine className="size-5" aria-hidden />}
          onClick={() => {
            onChange(null);
            setEditing(true);
          }}
        >
          {t('sign.clear')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className={`relative rounded-2xl border-2 bg-white ${invalid ? 'border-red-600' : 'border-slate-300'}`}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={t('a11y.signaturePad')}
          aria-describedby={describedBy}
          className="touch-none-strict block h-44 w-full cursor-crosshair rounded-2xl sm:h-52"
        />
        {/* printed guide line, like on the paper form */}
        <div className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-slate-400" aria-hidden />
        {isEmpty && (
          <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-sm text-slate-400" aria-hidden>
            {t('sign.placeholder')}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" icon={<Undo2 className="size-4" aria-hidden />} onClick={undo} disabled={isEmpty}>
          {t('sign.undo')}
        </Button>
        <Button variant="secondary" size="sm" icon={<Eraser className="size-4" aria-hidden />} onClick={clear} disabled={isEmpty}>
          {t('sign.clear')}
        </Button>
      </div>
    </div>
  );
}
