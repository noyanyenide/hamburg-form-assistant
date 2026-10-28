import { createEmptyForm, type FormValues } from '../../src/form/types';

/** A complete, realistic application with German and Turkish characters. */
export function sampleValues(): FormValues {
  const v = createEmptyForm();
  v.applicant = {
    surname: 'Yılmaz',
    birthName: 'Öztürk',
    givenNames: 'Ayşe Gül',
    birthDate: '14.03.1988',
    birthPlace: 'İzmir',
    nationality: 'türkisch',
    street: 'Große Bergstraße',
    houseNumber: '12a',
    addressAddition: 'bei Şahin',
    postalCode: '22767',
    city: 'Hamburg',
    phone: '+49 40 1234567',
    email: 'ayse.yilmaz@example.org',
    eyeColor: 'brown',
    eyeColorOther: '',
    heightCm: '165',
  };
  v.passport = { number: 'u12345678', issuePlace: 'Ankara', issueDate: '02.05.2020', validUntil: '01.05.2030' };
  v.entry = {
    bornInGermany: false,
    entryDate: '15.09.2021',
    hadPreviousStays: 'yes',
    previousStays: [
      { from: '01.10.2010', to: '30.09.2012', place: 'Köln' },
      { from: '03.2015', to: '08.2015', place: 'München' },
    ],
  };
  v.history = { expelledOrRefused: 'no', expelledWhen: '' };
  v.stay = {
    purpose: 'family',
    purposeDetails: 'Ehegattennachzug',
    employerOrSchool: 'Müller & Söhne GmbH, Hamburg',
    livelihood: ['ownWork', 'spouse'],
    livelihoodOther: '',
  };
  v.marital = { status: 'married', widowedSince: '' };
  v.spouse = {
    surname: 'Yılmaz',
    birthName: '',
    givenNames: 'Mehmet Çağrı',
    birthDate: '07.11.1985',
    birthPlace: 'Trabzon',
    nationality: 'türkisch und deutsch',
    sameAddress: true,
    address: '',
  };
  v.children = {
    hasChildren: 'yes',
    list: [
      { surname: 'Yılmaz', givenNames: 'Elif', birthDate: '21.06.2016', birthPlace: 'Hamburg', nationality: 'deutsch', residence: 'Hamburg' },
      { surname: 'Yılmaz', givenNames: 'Can Doğan', birthDate: '02.02.2019', birthPlace: 'Gaziantep', nationality: 'türkisch', residence: 'Hamburg' },
    ],
  };
  v.parents = {
    father: { unknown: false, surname: 'Öztürk', givenNames: 'Hüseyin', birthDate: '1960' },
    mother: { unknown: false, surname: 'Öztürk', givenNames: 'Şükran', birthDate: '12.12.1963' },
  };
  v.application = { issueOrExtension: 'yes', settlementPermit: 'no' };
  v.signing = { declarationAccepted: true, date: '28.10.2026', signOnPaper: false };
  return v;
}
