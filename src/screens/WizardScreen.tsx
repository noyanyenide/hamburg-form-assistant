import { AlertCircle, ArrowLeft, ArrowRight, Check, CheckCircle2, CloudOff, ListChecks, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useWatch, type FieldPath } from 'react-hook-form';
import { useApp, type SaveStatus } from '../app/AppContext';
import { StepItems, fieldDomId } from '../components/fields';
import { Alert, Button, Dialog } from '../components/ui';
import { STEPS, stepFieldPaths, visibleSteps } from '../form/steps';
import type { FormValues } from '../form/types';
import { useI18n } from '../i18n';

function SaveIndicator({ status }: { status: SaveStatus }) {
  const { t } = useI18n();
  const content = {
    idle: null,
    saving: { icon: <Loader2 className="size-3.5 animate-spin" aria-hidden />, text: t('status.saving'), cls: 'text-slate-500' },
    saved: { icon: <CheckCircle2 className="size-3.5" aria-hidden />, text: t('status.saved'), cls: 'text-emerald-700' },
    disabled: { icon: <CloudOff className="size-3.5" aria-hidden />, text: t('status.notSaved'), cls: 'text-slate-500' },
    error: { icon: <AlertCircle className="size-3.5" aria-hidden />, text: t('status.saveFailed'), cls: 'text-red-700' },
  }[status];
  return (
    <p role="status" className={`flex min-h-5 items-center gap-1 text-xs ${content?.cls ?? ''}`}>
      {content?.icon}
      {content?.text}
    </p>
  );
}

export function WizardScreen() {
  const { t } = useI18n();
  const { form, nav, navigate, goToStep, markReached, furthestStep, fitChecker, saveStatus } = useApp();
  const values = useWatch({ control: form.control }) as FormValues;
  const steps = visibleSteps(values);
  const index = Math.max(0, steps.findIndex((s) => s.id === nav.stepId));
  const step = steps[index];
  const [showSummary, setShowSummary] = useState(false);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setShowSummary(false);
    markReached(step.id);
    headingRef.current?.focus({ preventScroll: true });
  }, [step.id, markReached]);

  const focusFirstError = (paths: string[]) => {
    const errors = form.formState.errors;
    for (const path of paths) {
      const parts = path.split('.');
      let node: unknown = errors;
      for (const p of parts) node = (node as Record<string, unknown> | undefined)?.[p];
      if (node && typeof node === 'object' && 'message' in node) {
        const el = document.getElementById(fieldDomId(path));
        el?.focus();
        el?.scrollIntoView({ block: 'center' });
        return;
      }
    }
  };

  const validateStep = async (): Promise<boolean> => {
    const current = form.getValues();
    const paths = stepFieldPaths(step, current);
    const ok = await form.trigger(paths as FieldPath<FormValues>[], { shouldFocus: true });
    if (!ok) return false;
    // Does every answer of this step fit into its box on the official form?
    const problems = (fitChecker?.check(current) ?? []).filter((p) => p.reason === 'overflow' && paths.includes(p.sourcePath));
    if (problems.length > 0) {
      for (const p of problems) form.setError(p.sourcePath as FieldPath<FormValues>, { type: 'fit', message: 'err.doesNotFit' });
      focusFirstError(problems.map((p) => p.sourcePath));
      return false;
    }
    return true;
  };

  const next = async () => {
    if (!(await validateStep())) {
      setShowSummary(true);
      return;
    }
    if (nav.returnToReview) {
      navigate({ screen: 'review' });
      return;
    }
    const following = steps[index + 1];
    if (following) goToStep(following.id);
    else navigate({ screen: 'review' });
  };

  const back = () => {
    if (nav.returnToReview) navigate({ screen: 'review' });
    else if (index === 0) navigate({ screen: 'welcome' });
    else goToStep(steps[index - 1].id);
  };

  const progress = Math.round(((index + 1) / steps.length) * 100);

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void next();
      }}
      className="flex min-h-[calc(100dvh-7rem)] flex-col"
    >
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between gap-2 text-sm">
          <p className="font-medium text-slate-600">{t('nav.stepOf', { current: index + 1, total: steps.length })}</p>
          <button
            type="button"
            onClick={() => setSectionsOpen(true)}
            className="flex min-h-10 items-center gap-1.5 rounded-lg px-2 font-semibold text-brand-700 hover:bg-brand-50"
          >
            <ListChecks className="size-4" aria-hidden />
            {t('nav.sections')}
          </button>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-label={t('a11y.progress')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {step.formSection && (
        <p lang="de" className="mb-1 text-xs font-medium text-slate-500">
          {step.formSection}
        </p>
      )}
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-brand-800 focus:outline-none">
        {t(step.title)}
      </h1>
      {step.intro && <p className="mt-2 text-slate-700">{t(step.intro)}</p>}

      {showSummary && Object.keys(form.formState.errors).length > 0 && (
        <Alert tone="error" role="alert" className="mt-4">
          {t('form.errorSummary')}
        </Alert>
      )}

      <div className="mt-6 flex-1">
        <StepItems key={step.id} items={step.items} />
      </div>

      <div className="pb-safe sticky bottom-0 -mx-4 mt-8 border-t border-slate-200 bg-slate-50/95 px-4 pt-3 backdrop-blur">
        <SaveIndicator status={saveStatus} />
        <div className="mt-1 grid grid-cols-[auto_1fr] gap-3">
          <Button variant="secondary" icon={<ArrowLeft className="size-5" aria-hidden />} onClick={back}>
            {t('nav.back')}
          </Button>
          <Button type="submit" iconRight={nav.returnToReview ? <Check className="size-5" aria-hidden /> : <ArrowRight className="size-5" aria-hidden />}>
            {nav.returnToReview ? t('nav.toReview') : t('nav.next')}
          </Button>
        </div>
      </div>

      <Dialog open={sectionsOpen} onClose={() => setSectionsOpen(false)} title={t('nav.sections')} closeLabel={t('common.close')}>
        <ol className="grid gap-1">
          {steps.map((s, i) => {
            const reachable = STEPS.indexOf(s) <= furthestStep;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={!reachable}
                  aria-current={s.id === step.id ? 'step' : undefined}
                  onClick={() => {
                    setSectionsOpen(false);
                    goToStep(s.id);
                  }}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left ${
                    s.id === step.id ? 'bg-brand-50 font-semibold text-brand-800' : reachable ? 'hover:bg-slate-100' : 'text-slate-400'
                  }`}
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700">
                    {i + 1}
                  </span>
                  {t(s.title)}
                </button>
              </li>
            );
          })}
        </ol>
        {furthestStep > 0 && (
          <Button
            variant="secondary"
            block
            className="mt-4"
            icon={<ListChecks className="size-5" aria-hidden />}
            onClick={() => {
              setSectionsOpen(false);
              navigate({ screen: 'review' });
            }}
          >
            {t('nav.review')}
          </Button>
        )}
      </Dialog>
    </form>
  );
}
