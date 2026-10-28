import { ArrowLeft, FileCheck2, Info } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import { useApp } from '../app/AppContext';
import { SignatureField } from '../components/SignatureField';
import { fieldDomId, maskFullDate } from '../components/fields';
import { Alert, Button, Card } from '../components/ui';
import { collectIssues } from '../form/schema';
import type { FormValues } from '../form/types';
import { todayString } from '../form/validators';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/types';

/** Verbatim from page 2 of the official form. */
const DECLARATION_DE =
  'Ich versichere, dass alle Angaben richtig und vollständig sind und dass ich mich seit Erteilung eines Aufenthaltstitels nicht länger als 6 Monate außerhalb der Bundesrepublik Deutschland aufgehalten habe.';
const DECLARATION_TR =
  'Tüm bilgilerin doğru ve eksiksiz olduğunu ve bana verilen ikamet ünvanından sonra 6 aydan uzun bir süre Federal Almanya Cumhuriyeti dışında bulunmadığımı taahhüt ederim.';

export function SignScreen() {
  const { t, language } = useI18n();
  const { form, navigate, signature, setSignature } = useApp();
  const values = useWatch({ control: form.control }) as FormValues;
  const [errors, setErrors] = useState<Record<string, MessageKey>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!form.getValues('signing.date')) form.setValue('signing.date', todayString(), { shouldDirty: true });
  }, [form]);

  const signOnPaper = values.signing.signOnPaper;
  const signatureMissing = !signOnPaper && !signature;

  const validate = () => {
    const found: Record<string, MessageKey> = {};
    for (const issue of collectIssues(form.getValues(), { steps: [], includeSigning: true })) {
      if (issue.path.startsWith('signing.')) found[issue.path] = issue.message;
    }
    if (signatureMissing) found.signature = 'sign.missingSignature';
    setErrors(found);
    return found;
  };

  // Re-validate live once the user has tried to continue.
  useEffect(() => {
    if (submitted) validate();
  }, [values.signing, signature, submitted]);

  const create = () => {
    setSubmitted(true);
    const found = validate();
    const first = Object.keys(found)[0];
    if (first) {
      const id = first === 'signature' ? 'signature-pad' : fieldDomId(first);
      document.getElementById(id)?.scrollIntoView({ block: 'center' });
      return;
    }
    navigate({ screen: 'result' });
  };

  const dateId = fieldDomId('signing.date');
  const acceptId = fieldDomId('signing.declarationAccepted');

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" icon={<ArrowLeft className="size-4" aria-hidden />} onClick={() => navigate({ screen: 'review' })} className="-ml-2">
        {t('nav.review')}
      </Button>
      <h1 className="text-2xl font-bold text-brand-800">{t('sign.title')}</h1>

      <Card className="space-y-3">
        <h2 className="font-bold">{t('sign.declarationTitle')}</h2>
        <blockquote className="space-y-2 border-l-4 border-brand-200 pl-3 text-sm leading-relaxed text-slate-800">
          <p lang="de">{DECLARATION_DE}</p>
          <p lang="tr">{DECLARATION_TR}</p>
        </blockquote>
        {language === 'en' && (
          <div className="text-sm leading-relaxed">
            <p className="font-semibold">{t('sign.declarationTranslation')}</p>
            <p>{t('sign.declarationText')}</p>
          </div>
        )}
        <Controller
          control={form.control}
          name="signing.declarationAccepted"
          render={({ field }) => (
            <label
              htmlFor={acceptId}
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${
                errors['signing.declarationAccepted'] ? 'border-red-600' : field.value ? 'border-brand-600 bg-brand-50' : 'border-slate-300'
              }`}
            >
              <input
                id={acceptId}
                ref={field.ref}
                type="checkbox"
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                aria-invalid={Boolean(errors['signing.declarationAccepted'])}
                className="mt-0.5 size-5 shrink-0 accent-brand-700"
              />
              <span className="font-medium">{t('sign.accept')}</span>
            </label>
          )}
        />
        {errors['signing.declarationAccepted'] && (
          <p className="text-sm font-medium text-red-700" role="alert">
            {t(errors['signing.declarationAccepted'])}
          </p>
        )}
        <Alert tone="warning">{t('sign.acceptHint')}</Alert>
      </Card>

      <Card className="space-y-2">
        <label htmlFor={dateId} className="block font-semibold">
          {t('sign.dateLabel')}
        </label>
        <Controller
          control={form.control}
          name="signing.date"
          render={({ field }) => (
            <input
              id={dateId}
              ref={field.ref}
              type="text"
              inputMode="numeric"
              placeholder={t('form.datePlaceholder')}
              maxLength={10}
              value={field.value}
              onChange={(e) => field.onChange(maskFullDate(e.target.value))}
              aria-invalid={Boolean(errors['signing.date'])}
              className={`block min-h-12 w-full max-w-56 rounded-xl border px-3 tabular-nums ${errors['signing.date'] ? 'border-red-600' : 'border-slate-300'}`}
            />
          )}
        />
        <p className="text-xs text-slate-500">
          <span className="font-medium">{t('form.onTheForm')}</span> <span lang="de">Hamburg, den ______ / Hamburg,</span>
        </p>
        {errors['signing.date'] && (
          <p className="text-sm font-medium text-red-700" role="alert">
            {t(errors['signing.date'])}
          </p>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 id="signature-heading" className="font-semibold">
          {t('sign.signatureLabel')}
        </h2>
        <Controller
          control={form.control}
          name="signing.signOnPaper"
          render={({ field }) => (
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                ref={field.ref}
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                className="mt-0.5 size-5 shrink-0 accent-brand-700"
              />
              <span>
                <span className="block font-medium">{t('sign.signOnPaper')}</span>
                <span className="block text-sm text-slate-600">{t('sign.signOnPaperHelp')}</span>
              </span>
            </label>
          )}
        />
        {!signOnPaper && (
          <div id="signature-pad" className="space-y-2">
            <p id="signature-help" className="text-sm text-slate-600">
              {t('sign.signatureHelp')}
            </p>
            <SignatureField saved={signature} onChange={setSignature} invalid={Boolean(errors.signature)} describedBy="signature-help" />
            {errors.signature && (
              <p className="text-sm font-medium text-red-700" role="alert">
                {t(errors.signature)}
              </p>
            )}
            <p className="text-xs text-slate-500">
              <span className="font-medium">{t('form.onTheForm')}</span>{' '}
              <span lang="de">Eigenhändige Unterschrift des Antragstellers / Dilekçe sahibinin kendi eli ile imzası</span>
            </p>
          </div>
        )}
        <p className="flex gap-2 text-sm text-slate-600">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t('sign.eSignatureNote')}
        </p>
      </Card>

      <div className="pb-safe sticky bottom-0 -mx-4 border-t border-slate-200 bg-slate-50/95 px-4 pt-3 backdrop-blur">
        <Button block icon={<FileCheck2 className="size-5" aria-hidden />} onClick={create}>
          {t('sign.create')}
        </Button>
      </div>
    </div>
  );
}
