import { AlertTriangle, ArrowRight, Camera, Pencil } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useWatch } from 'react-hook-form';
import { useApp } from '../app/AppContext';
import { Alert, Button, Card, Spinner } from '../components/ui';
import { optionByValue } from '../form/options';
import { collectIssues } from '../form/schema';
import { STEPS, getPath, isList, visibleSteps, type FieldMeta, type StepDef, type StepId } from '../form/steps';
import type { FormValues } from '../form/types';
import { parseDate, todayUtc } from '../form/validators';
import { useI18n, type Translate } from '../i18n';
import type { FieldProblem } from '../pdf/engine';

function displayValue(meta: FieldMeta, value: unknown, t: Translate): string | null {
  switch (meta.type) {
    case 'checkbox':
      return value ? t('common.yes') : null;
    case 'yesNo':
      return value === 'yes' ? t('common.yes') : value === 'no' ? t('common.no') : '';
    case 'select':
    case 'radio': {
      const option = meta.options ? optionByValue(meta.options, String(value ?? '')) : undefined;
      return option ? t(option.label) : '';
    }
    case 'multi':
      return ((value as string[] | undefined) ?? [])
        .map((v) => (meta.options ? optionByValue(meta.options, v) : undefined))
        .filter(Boolean)
        .map((o) => t(o!.label))
        .join(', ');
    default:
      return String(value ?? '').trim();
  }
}

function stepOfPath(path: string): StepDef | undefined {
  return STEPS.find((s) => s.items.some((item) => path === item.name || path.startsWith(`${item.name}.`)));
}

function Row({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-0.5 py-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="break-words font-medium">{value || <span className="text-slate-400">{t('review.empty')}</span>}</dd>
    </div>
  );
}

function StepSummary({ step, values, invalid }: { step: StepDef; values: FormValues; invalid: boolean }) {
  const { t } = useI18n();
  const { goToStep } = useApp();
  const rows: Array<{ key: string; label: string; value: string }> = [];
  for (const item of step.items) {
    if (item.visible && !item.visible(values)) continue;
    if (isList(item)) {
      const list = (getPath(values, item.name) as Array<Record<string, unknown>>) ?? [];
      list.forEach((entry, i) => {
        const text = item.itemFields
          .map((f) => displayValue(f, entry[f.name], t))
          .filter(Boolean)
          .join(' · ');
        rows.push({ key: `${item.name}.${i}`, label: t(item.itemLabel, { n: i + 1 }), value: text });
      });
      continue;
    }
    const value = displayValue(item, getPath(values, item.name), t);
    if (value === null) continue;
    rows.push({ key: item.name, label: t(item.label), value });
  }
  return (
    <Card className={invalid ? 'ring-2 ring-red-300' : ''}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-bold text-brand-800">{t(step.title)}</h2>
        <Button variant="ghost" size="sm" icon={<Pencil className="size-4" aria-hidden />} onClick={() => goToStep(step.id, true)} className="-mr-2 -mt-1">
          {t('review.edit')}
        </Button>
      </div>
      {invalid && (
        <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-red-700">
          <AlertTriangle className="size-4" aria-hidden />
          {t('review.incomplete')}
        </p>
      )}
      <dl className="mt-2 divide-y divide-slate-100">
        {rows.map((r) => (
          <Row key={r.key} label={r.label} value={r.value} />
        ))}
      </dl>
    </Card>
  );
}

export function ReviewScreen() {
  const { t, locale } = useI18n();
  const { form, navigate, ensureFitChecker, goToStep } = useApp();
  const values = useWatch({ control: form.control }) as FormValues;
  const [fitProblems, setFitProblems] = useState<FieldProblem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void ensureFitChecker().then((checker) => {
      if (!cancelled) setFitProblems(checker ? checker.check(form.getValues()).filter((p) => p.reason === 'overflow') : []);
    });
    return () => {
      cancelled = true;
    };
  }, [ensureFitChecker, form, values]);

  const issues = useMemo(() => collectIssues(values), [values]);
  const invalidSteps = useMemo(() => {
    const set = new Set<StepId>();
    for (const i of issues) {
      const s = stepOfPath(i.path);
      if (s) set.add(s.id);
    }
    for (const p of fitProblems ?? []) {
      const s = stepOfPath(p.sourcePath);
      if (s) set.add(s.id);
    }
    return set;
  }, [issues, fitProblems]);

  const warnings: string[] = [];
  const validUntil = parseDate(values.passport.validUntil);
  if (validUntil) {
    const today = todayUtc();
    const soon = new Date(today);
    soon.setUTCMonth(soon.getUTCMonth() + 3);
    const date = validUntil.toLocaleDateString(locale, { timeZone: 'UTC' });
    if (validUntil < today) warnings.push(t('review.warnPassportExpired', { date }));
    else if (validUntil < soon) warnings.push(t('review.warnPassportSoon', { date }));
  }
  if (values.application.issueOrExtension === 'no' && values.application.settlementPermit === 'no') warnings.push(t('review.warnNoRequest'));

  const steps = visibleSteps(values);
  const blocked = invalidSteps.size > 0;
  const firstInvalid = steps.find((s) => invalidSteps.has(s.id));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-brand-800">{t('review.title')}</h1>
        <p className="mt-2 text-slate-700">{t('review.intro')}</p>
      </div>

      {blocked && (
        <Alert tone="error" role="alert" title={t('review.problemsTitle')}>
          <ul className="mt-1 space-y-1">
            {steps
              .filter((s) => invalidSteps.has(s.id))
              .map((s) => (
                <li key={s.id}>
                  <button type="button" className="font-semibold underline underline-offset-2" onClick={() => goToStep(s.id, true)}>
                    {t(s.title)}
                  </button>
                </li>
              ))}
          </ul>
          {fitProblems && fitProblems.length > 0 && <p className="mt-2">{t('result.fitError')}</p>}
        </Alert>
      )}

      {warnings.length > 0 && (
        <Alert tone="warning" title={t('review.warningsTitle')}>
          <ul className="list-disc space-y-1 pl-4">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </Alert>
      )}

      {steps.map((s) => (
        <StepSummary key={s.id} step={s} values={values} invalid={invalidSteps.has(s.id)} />
      ))}

      <Alert tone="info">
        <span className="flex items-center gap-2">
          <Camera className="size-4 shrink-0" aria-hidden />
          {t('review.photoReminder')}
        </span>
      </Alert>

      <div className="pb-safe sticky bottom-0 -mx-4 border-t border-slate-200 bg-slate-50/95 px-4 pt-3 backdrop-blur">
        {fitProblems === null ? (
          <Spinner label={t('review.checkingFit')} />
        ) : blocked && firstInvalid ? (
          <Button block variant="secondary" icon={<Pencil className="size-5" aria-hidden />} onClick={() => goToStep(firstInvalid.id, true)}>
            {t(firstInvalid.title)}
          </Button>
        ) : (
          <Button block iconRight={<ArrowRight className="size-5" aria-hidden />} onClick={() => navigate({ screen: 'sign' })}>
            {t('review.continue')}
          </Button>
        )}
      </div>
    </div>
  );
}
