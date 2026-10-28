import { Copy, Plus, Trash2 } from 'lucide-react';
import { useEffect, useId, type ReactNode } from 'react';
import { Controller, get, useFieldArray, useFormContext, useWatch, type FieldPath } from 'react-hook-form';
import { getPath, isList, isRequired, type FieldMeta, type ListMeta, type StepItem } from '../form/steps';
import type { FormValues } from '../form/types';
import { useI18n } from '../i18n';
import type { MessageKey } from '../i18n/types';
import { Button } from './ui';

type Name = FieldPath<FormValues>;

export const fieldDomId = (name: string) => `f-${name.replace(/\./g, '-')}`;

function useFieldError(name: string): MessageKey | undefined {
  const {
    formState: { errors },
  } = useFormContext<FormValues>();
  const error = get(errors, name) as { message?: string; root?: { message?: string } } | undefined;
  return (error?.message || error?.root?.message || undefined) as MessageKey | undefined;
}

/* --------------------------------- shell ---------------------------------- */

interface ShellProps {
  id: string;
  label: string;
  required: boolean;
  help?: MessageKey;
  formRef?: string;
  error?: MessageKey;
  children: (describedBy: string | undefined) => ReactNode;
  asFieldset?: boolean;
  extra?: ReactNode;
}

function FieldShell({ id, label, required, help, formRef, error, children, asFieldset, extra }: ShellProps) {
  const { t } = useI18n();
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const refId = formRef ? `${id}-ref` : undefined;
  const describedBy = [errorId, helpId, refId].filter(Boolean).join(' ') || undefined;

  const labelContent = (
    <>
      <span>{label}</span>
      {!required && <span className="ml-2 text-sm font-normal text-slate-500">({t('form.optional')})</span>}
    </>
  );

  const body = (
    <>
      {help && (
        <p id={helpId} className="mt-1 text-sm text-slate-600">
          {t(help)}
        </p>
      )}
      <div className="mt-2">{children(describedBy)}</div>
      {extra}
      {error && (
        <p id={errorId} className="mt-2 text-sm font-medium text-red-700" role="alert">
          {t(error)}
        </p>
      )}
      {formRef && (
        <p id={refId} className="mt-2 text-xs text-slate-500">
          <span className="font-medium">{t('form.onTheForm')}</span> <span lang="de">{formRef}</span>
        </p>
      )}
    </>
  );

  if (asFieldset) {
    return (
      <fieldset className="min-w-0" aria-describedby={describedBy}>
        <legend className="text-base font-semibold text-ink">{labelContent}</legend>
        {body}
      </fieldset>
    );
  }
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-base font-semibold text-ink">
        {labelContent}
      </label>
      {body}
    </div>
  );
}

const inputClass = (invalid: boolean) =>
  `block w-full min-h-12 rounded-xl border bg-white px-3 py-2 text-base text-ink placeholder:text-slate-400 ${
    invalid ? 'border-red-600 ring-1 ring-red-600' : 'border-slate-300'
  } focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40`;

/* ------------------------------ date helpers ------------------------------- */

export function maskFullDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

/** Partial dates: digits and dots while typing; bare digit strings are formatted on blur. */
export function normalizePartialDate(raw: string): string {
  const v = raw.trim().replace(/[/\-\s]/g, '.');
  if (/^\d{8}$/.test(v)) return `${v.slice(0, 2)}.${v.slice(2, 4)}.${v.slice(4)}`;
  if (/^\d{6}$/.test(v)) return `${v.slice(0, 2)}.${v.slice(2)}`;
  return v;
}

/* --------------------------------- fields ---------------------------------- */

interface FieldProps {
  meta: FieldMeta;
  name: string;
  values: FormValues;
}

function TextLikeField({ meta, name, values }: FieldProps) {
  const { t } = useI18n();
  const { register, setValue, getValues, control } = useFormContext<FormValues>();
  const id = fieldDomId(name);
  const error = useFieldError(name);
  const required = isRequired(meta, values);

  const copySource = meta.copyFrom ? String(getPath(values, meta.copyFrom.path) ?? '') : '';
  const extra = (
    <>
      {meta.suggestions && (
        <div className="mt-2 flex flex-wrap gap-2">
          {meta.suggestions.map((s) => (
            <button
              key={s}
              type="button"
              lang="de"
              onClick={() => setValue(name as Name, s, { shouldDirty: true, shouldValidate: true })}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {meta.copyFrom && copySource && (
        <button
          type="button"
          onClick={() => setValue(name as Name, getValues(meta.copyFrom!.path as Name) as string, { shouldDirty: true, shouldValidate: true })}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
        >
          <Copy className="size-4" aria-hidden />
          {t(meta.copyFrom.label, { city: copySource })}
        </button>
      )}
    </>
  );

  if (meta.type === 'date' || meta.type === 'partialDate') {
    const full = meta.type === 'date';
    return (
      <FieldShell id={id} label={t(meta.label)} required={required} help={meta.help} formRef={meta.formRef} error={error} extra={extra}>
        {(describedBy) => (
          <Controller
            control={control}
            name={name as Name}
            render={({ field }) => (
              <input
                ref={field.ref}
                id={id}
                name={field.name}
                type="text"
                inputMode="numeric"
                autoComplete={meta.autoComplete ?? 'off'}
                placeholder={t(full ? 'form.datePlaceholder' : 'form.partialDatePlaceholder')}
                maxLength={10}
                value={(field.value as string) ?? ''}
                onChange={(e) => field.onChange(full ? maskFullDate(e.target.value) : e.target.value.replace(/[^\d./\-\s]/g, ''))}
                onBlur={(e) => {
                  if (!full) field.onChange(normalizePartialDate(e.target.value));
                  field.onBlur();
                }}
                aria-invalid={Boolean(error)}
                aria-required={required}
                aria-describedby={describedBy}
                className={`${inputClass(Boolean(error))} max-w-56 tabular-nums`}
              />
            )}
          />
        )}
      </FieldShell>
    );
  }

  const widthClass = meta.width === 'third' ? 'max-w-40' : meta.width === 'half' ? 'max-w-72' : '';
  return (
    <FieldShell id={id} label={t(meta.label)} required={required} help={meta.help} formRef={meta.formRef} error={error} extra={extra}>
      {(describedBy) => (
        <input
          id={id}
          type="text"
          inputMode={meta.inputMode ?? (meta.type === 'number' ? 'numeric' : 'text')}
          autoComplete={meta.autoComplete ?? 'off'}
          autoCapitalize={meta.autoCapitalize ?? 'sentences'}
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-required={required}
          aria-describedby={describedBy}
          className={`${inputClass(Boolean(error))} ${widthClass}`}
          {...register(name as Name)}
        />
      )}
    </FieldShell>
  );
}

function SelectField({ meta, name, values }: FieldProps) {
  const { t } = useI18n();
  const { register } = useFormContext<FormValues>();
  const id = fieldDomId(name);
  const error = useFieldError(name);
  const required = isRequired(meta, values);
  return (
    <FieldShell id={id} label={t(meta.label)} required={required} help={meta.help} formRef={meta.formRef} error={error}>
      {(describedBy) => (
        <select
          id={id}
          aria-invalid={Boolean(error)}
          aria-required={required}
          aria-describedby={describedBy}
          className={`${inputClass(Boolean(error))} max-w-80 appearance-auto`}
          {...register(name as Name)}
        >
          <option value="">{t('form.select')}</option>
          {meta.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.label)}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

const choiceClass = (checked: boolean, invalid: boolean) =>
  `flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-base transition-colors ${
    checked ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : invalid ? 'border-red-400 bg-white' : 'border-slate-300 bg-white hover:bg-slate-50'
  }`;

function RadioField({ meta, name, values }: FieldProps) {
  const { t } = useI18n();
  const { control } = useFormContext<FormValues>();
  const id = fieldDomId(name);
  const error = useFieldError(name);
  const required = isRequired(meta, values);
  const options =
    meta.type === 'yesNo'
      ? [
          { value: 'yes', label: 'common.yes' as MessageKey },
          { value: 'no', label: 'common.no' as MessageKey },
        ]
      : (meta.options ?? []);
  return (
    <FieldShell id={id} label={t(meta.label)} required={required} help={meta.help} formRef={meta.formRef} error={error} asFieldset>
      {() => (
        <Controller
          control={control}
          name={name as Name}
          render={({ field }) => (
            <div className={meta.type === 'yesNo' ? 'grid grid-cols-2 gap-3' : 'grid gap-2'}>
              {options.map((o, i) => {
                const checked = field.value === o.value;
                return (
                  <label key={o.value} className={choiceClass(checked, Boolean(error))}>
                    <input
                      ref={i === 0 ? field.ref : undefined}
                      type="radio"
                      name={id}
                      value={o.value}
                      checked={checked}
                      onChange={() => field.onChange(o.value)}
                      onBlur={field.onBlur}
                      className="size-5 shrink-0 accent-brand-700"
                    />
                    <span className="font-medium">{t(o.label)}</span>
                  </label>
                );
              })}
            </div>
          )}
        />
      )}
    </FieldShell>
  );
}

function MultiField({ meta, name, values }: FieldProps) {
  const { t } = useI18n();
  const { control } = useFormContext<FormValues>();
  const id = fieldDomId(name);
  const error = useFieldError(name);
  const required = isRequired(meta, values);
  return (
    <FieldShell id={id} label={t(meta.label)} required={required} help={meta.help} formRef={meta.formRef} error={error} asFieldset>
      {() => (
        <Controller
          control={control}
          name={name as Name}
          render={({ field }) => {
            const selected = (field.value as string[] | undefined) ?? [];
            return (
              <div className="grid gap-2">
                {meta.options?.map((o, i) => {
                  const checked = selected.includes(o.value);
                  return (
                    <label key={o.value} className={choiceClass(checked, Boolean(error))}>
                      <input
                        ref={i === 0 ? field.ref : undefined}
                        type="checkbox"
                        checked={checked}
                        onChange={() => field.onChange(checked ? selected.filter((s) => s !== o.value) : [...selected, o.value])}
                        onBlur={field.onBlur}
                        className="size-5 shrink-0 accent-brand-700"
                      />
                      <span className="font-medium">{t(o.label)}</span>
                    </label>
                  );
                })}
              </div>
            );
          }}
        />
      )}
    </FieldShell>
  );
}

function CheckboxField({ meta, name }: FieldProps) {
  const { t } = useI18n();
  const { control } = useFormContext<FormValues>();
  const id = fieldDomId(name);
  return (
    <div>
      <Controller
        control={control}
        name={name as Name}
        render={({ field }) => (
          <label htmlFor={id} className={choiceClass(Boolean(field.value), false)}>
            <input
              ref={field.ref}
              id={id}
              type="checkbox"
              checked={Boolean(field.value)}
              onChange={(e) => field.onChange(e.target.checked)}
              onBlur={field.onBlur}
              className="size-5 shrink-0 accent-brand-700"
            />
            <span className="font-medium">{t(meta.label)}</span>
          </label>
        )}
      />
      {meta.formRef && (
        <p className="mt-2 text-xs text-slate-500">
          <span className="font-medium">{t('form.onTheForm')}</span> <span lang="de">{meta.formRef}</span>
        </p>
      )}
    </div>
  );
}

export function FieldRenderer({ meta, name, values }: FieldProps) {
  if (meta.visible && !meta.visible(values)) return null;
  switch (meta.type) {
    case 'select':
      return <SelectField meta={meta} name={name} values={values} />;
    case 'radio':
    case 'yesNo':
      return <RadioField meta={meta} name={name} values={values} />;
    case 'multi':
      return <MultiField meta={meta} name={name} values={values} />;
    case 'checkbox':
      return <CheckboxField meta={meta} name={name} values={values} />;
    default:
      return <TextLikeField meta={meta} name={name} values={values} />;
  }
}

/* ---------------------------------- lists ---------------------------------- */

function ListField({ meta, values }: { meta: ListMeta; values: FormValues }) {
  const { t } = useI18n();
  const { control } = useFormContext<FormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: meta.name as 'children.list' });
  const error = useFieldError(meta.name);
  const headingId = useId();
  const visible = !meta.visible || meta.visible(values);

  useEffect(() => {
    if (visible && fields.length === 0) append(meta.newItem() as never, { shouldFocus: false });
  }, [visible, fields.length, append, meta]);

  if (!visible) return null;
  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <h3 id={headingId} className="text-base font-semibold">
        {t(meta.label)}
      </h3>
      {fields.map((item, index) => (
        <div key={item.id} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-brand-800">{t(meta.itemLabel, { n: index + 1 })}</h4>
            {fields.length > 1 && (
              <Button variant="ghost" size="sm" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => remove(index)}>
                {t('form.remove')}
              </Button>
            )}
          </div>
          {meta.itemFields.map((f) => (
            <FieldRenderer key={f.name} meta={f} name={`${meta.name}.${index}.${f.name}`} values={values} />
          ))}
        </div>
      ))}
      {error && (
        <p className="text-sm font-medium text-red-700" role="alert">
          {t(error)}
        </p>
      )}
      <div className="flex flex-col items-start gap-2">
        <Button
          variant="secondary"
          icon={<Plus className="size-5" aria-hidden />}
          disabled={fields.length >= meta.max}
          onClick={() => append(meta.newItem() as never)}
        >
          {t(meta.addLabel)}
        </Button>
        <p className="text-sm text-slate-600">{t('form.maxEntries', { max: meta.max })}</p>
      </div>
    </section>
  );
}

export function StepItems({ items }: { items: StepItem[] }) {
  const { control } = useFormContext<FormValues>();
  const values = useWatch({ control }) as FormValues;
  return (
    <div className="space-y-6">
      {items.map((item) =>
        isList(item) ? (
          <ListField key={item.name} meta={item} values={values} />
        ) : (
          <FieldRenderer key={item.name} meta={item} name={item.name} values={values} />
        ),
      )}
    </div>
  );
}
