import type { MessageKey } from '../i18n/types';

/**
 * Choice lists. `label` is shown in the interface language; `pdf` is the
 * German wording written onto the official form (the authority works in German).
 */
export interface ChoiceOption {
  value: string;
  label: MessageKey;
  pdf: string;
}

export const EYE_COLORS: readonly ChoiceOption[] = [
  { value: 'brown', label: 'opt.eye.brown', pdf: 'braun' },
  { value: 'darkBrown', label: 'opt.eye.darkBrown', pdf: 'dunkelbraun' },
  { value: 'lightBrown', label: 'opt.eye.lightBrown', pdf: 'hellbraun' },
  { value: 'green', label: 'opt.eye.green', pdf: 'grün' },
  { value: 'greenBrown', label: 'opt.eye.greenBrown', pdf: 'grünbraun' },
  { value: 'blue', label: 'opt.eye.blue', pdf: 'blau' },
  { value: 'grey', label: 'opt.eye.grey', pdf: 'grau' },
  { value: 'greyBlue', label: 'opt.eye.greyBlue', pdf: 'graublau' },
  { value: 'greyGreen', label: 'opt.eye.greyGreen', pdf: 'graugrün' },
  { value: 'other', label: 'opt.other', pdf: '' },
];

export const PURPOSES: readonly ChoiceOption[] = [
  { value: 'employment', label: 'opt.purpose.employment', pdf: 'Erwerbstätigkeit' },
  { value: 'selfEmployment', label: 'opt.purpose.selfEmployment', pdf: 'Selbständige Tätigkeit' },
  { value: 'study', label: 'opt.purpose.study', pdf: 'Studium' },
  { value: 'training', label: 'opt.purpose.training', pdf: 'Berufsausbildung' },
  { value: 'languageCourse', label: 'opt.purpose.languageCourse', pdf: 'Sprachkurs' },
  { value: 'family', label: 'opt.purpose.family', pdf: 'Familienzusammenführung' },
  { value: 'other', label: 'opt.other', pdf: '' },
];

export const LIVELIHOOD: readonly ChoiceOption[] = [
  { value: 'ownWork', label: 'opt.livelihood.ownWork', pdf: 'eigene Erwerbstätigkeit' },
  { value: 'spouse', label: 'opt.livelihood.spouse', pdf: 'Einkommen des Ehegatten/Lebenspartners' },
  { value: 'family', label: 'opt.livelihood.family', pdf: 'Unterstützung durch Familie' },
  { value: 'savings', label: 'opt.livelihood.savings', pdf: 'eigene Ersparnisse' },
  { value: 'blockedAccount', label: 'opt.livelihood.blockedAccount', pdf: 'Sperrkonto' },
  { value: 'scholarship', label: 'opt.livelihood.scholarship', pdf: 'Stipendium' },
  { value: 'commitment', label: 'opt.livelihood.commitment', pdf: 'Verpflichtungserklärung' },
  { value: 'pension', label: 'opt.livelihood.pension', pdf: 'Rente' },
  { value: 'publicBenefits', label: 'opt.livelihood.publicBenefits', pdf: 'öffentliche Leistungen' },
  { value: 'other', label: 'opt.other', pdf: '' },
];

export const MARITAL_STATUSES: readonly ChoiceOption[] = [
  { value: 'single', label: 'opt.marital.single', pdf: 'Ledig / bekar' },
  { value: 'married', label: 'opt.marital.married', pdf: 'verheiratet / evli' },
  { value: 'partnership', label: 'opt.marital.partnership', pdf: 'Lebenspartnerschaft / hayat arkadaşlığı' },
  { value: 'separated', label: 'opt.marital.separated', pdf: 'getrennt lebend / ayrı yaşıyor' },
  { value: 'divorced', label: 'opt.marital.divorced', pdf: 'geschieden / boşanmış' },
  { value: 'widowed', label: 'opt.marital.widowed', pdf: 'verwitwet / dul' },
];

export const YES_NO: readonly ChoiceOption[] = [
  { value: 'yes', label: 'common.yes', pdf: 'Ja' },
  { value: 'no', label: 'common.no', pdf: 'Nein' },
];

export function optionByValue(options: readonly ChoiceOption[], value: string): ChoiceOption | undefined {
  return options.find((o) => o.value === value);
}
