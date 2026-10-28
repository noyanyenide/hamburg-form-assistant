import { AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';
import { forwardRef, useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerOutline';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-800 disabled:bg-slate-300 disabled:text-slate-500',
  secondary:
    'bg-white text-brand-700 ring-1 ring-inset ring-brand-200 hover:bg-brand-50 active:bg-brand-100 disabled:text-slate-400 disabled:ring-slate-200',
  ghost: 'bg-transparent text-brand-700 hover:bg-brand-50 active:bg-brand-100 disabled:text-slate-400',
  danger: 'bg-red-700 text-white hover:bg-red-800 active:bg-red-800 disabled:bg-slate-300',
  dangerOutline: 'bg-white text-red-700 ring-1 ring-inset ring-red-200 hover:bg-red-50 active:bg-red-100',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
  iconRight?: ReactNode;
  block?: boolean;
  busy?: boolean;
  size?: 'md' | 'sm';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', icon, iconRight, block, busy, size = 'md', className = '', children, disabled, type = 'button', ...rest },
  ref,
) {
  const sizing = size === 'sm' ? 'min-h-10 px-3 text-sm' : 'min-h-12 px-5 text-base';
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed ${sizing} ${VARIANTS[variant]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : icon}
      {children}
      {iconRight}
    </button>
  );
});

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 ${className}`}>{children}</div>;
}

type Tone = 'info' | 'warning' | 'error' | 'success';

const TONES: Record<Tone, { box: string; icon: ReactNode }> = {
  info: { box: 'bg-brand-50 text-brand-800 ring-brand-100', icon: <Info className="size-5 shrink-0" aria-hidden /> },
  warning: { box: 'bg-amber-50 text-amber-900 ring-amber-200', icon: <AlertTriangle className="size-5 shrink-0" aria-hidden /> },
  error: { box: 'bg-red-50 text-red-900 ring-red-200', icon: <AlertTriangle className="size-5 shrink-0" aria-hidden /> },
  success: { box: 'bg-emerald-50 text-emerald-900 ring-emerald-200', icon: <CheckCircle2 className="size-5 shrink-0" aria-hidden /> },
};

export function Alert({
  tone = 'info',
  title,
  children,
  role,
  className = '',
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  role?: 'alert' | 'status';
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <div role={role} className={`flex gap-3 rounded-xl p-3 text-sm ring-1 ${t.box} ${className}`}>
      {t.icon}
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-12 text-slate-600">
      <Loader2 className="size-8 animate-spin text-brand-600" aria-hidden />
      <p>{label}</p>
    </div>
  );
}

/** Accessible modal built on the native <dialog> element (focus trap, Esc to close). */
export function Dialog({
  open,
  onClose,
  title,
  children,
  closeLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  closeLabel: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-labelledby="dialog-title"
      className="m-auto w-[min(calc(100vw-2rem),28rem)] rounded-2xl bg-white p-0 text-ink shadow-xl"
    >
      {open && (
        <div className="p-5">
          <div className="mb-3 flex items-start justify-between gap-3">
            <h2 id="dialog-title" className="text-lg font-bold">
              {title}
            </h2>
            <button type="button" onClick={onClose} className="-m-2 rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={closeLabel}>
              <X className="size-5" aria-hidden />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
