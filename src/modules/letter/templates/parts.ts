// The parts of a letter for Insert > Letter parts: whole letter, sender, recipient, references, greetings,
// closings, enclosures, copies… In French or English, with yellow [fields] to fill like the Doc adm/Mil templates.

export const LETTER_PARTS = [
  'full', 'closing', 'sender', 'recipient', 'date', 'placeDate', 'reference', 'subject', 'greetingFormal', 'greetingFriendly',
  'closingFormal', 'closingCordial', 'signatureTitle', 'enclosures', 'copies', 'ps', 'confidential', 'registered', 'withoutPrejudice', 'byEmail',
] as const;
export type LetterPart = (typeof LETTER_PARTS)[number];

const FR: Record<LetterPart, string> = {
  full: `[Prénom Nom]
[Adresse]
[Ville, province, code postal]

> [Ville], le {date}

[Nom du destinataire]
[Organisme]
[Adresse du destinataire]

! Objet : [objet]

[Madame, Monsieur],

[Votre texte.]

Veuillez agréer, [Madame, Monsieur], l'expression de mes salutations distinguées.



---
[Prénom Nom]`,
  closing: `Veuillez agréer, [Madame, Monsieur], l'expression de mes salutations distinguées.



---
[Prénom Nom]`,
  sender: `[Prénom Nom]
[Adresse]
[Ville, province, code postal]
[Téléphone] · [Courriel]`,
  recipient: `[Nom du destinataire]
[Fonction]
[Organisme]
[Adresse du destinataire]`,
  date: '> {date}',
  placeDate: '> [Ville], le {date}',
  reference: `V/Réf. : [votre référence]
N/Réf. : [notre référence]`,
  subject: '! Objet : [objet]',
  greetingFormal: '[Madame, Monsieur],',
  greetingFriendly: '[Cher / Chère] [Prénom],',
  closingFormal: "Je vous prie d'agréer, [Madame, Monsieur], l'assurance de ma considération distinguée.",
  closingCordial: 'Cordialement,',
  signatureTitle: `


---
[Prénom Nom]
[Fonction]
[Organisme]`,
  enclosures: `P. j. : [nombre]
- [Document 1]
- [Document 2]`,
  copies: 'c. c. : [Nom, fonction]',
  ps: 'P.-S. : [votre post-scriptum]',
  confidential: '! CONFIDENTIEL',
  registered: '! Lettre recommandée avec accusé de réception',
  withoutPrejudice: '! Sous toutes réserves',
  byEmail: '! Envoyé par courriel à [adresse]',
};

const EN: Record<LetterPart, string> = {
  full: `[First and last name]
[Address]
[City, province, postal code]

> {date}

[Recipient's name]
[Organization]
[Recipient's address]

! Subject: [subject]

Dear [Mr./Ms. Last name],

[Your text.]

Yours sincerely,



---
[First and last name]`,
  closing: `Yours sincerely,



---
[First and last name]`,
  sender: `[First and last name]
[Address]
[City, province, postal code]
[Phone] · [Email]`,
  recipient: `[Recipient's name]
[Title]
[Organization]
[Recipient's address]`,
  date: '> {date}',
  placeDate: '> [City], {date}',
  reference: `Your ref.: [your reference]
Our ref.: [our reference]`,
  subject: '! Subject: [subject]',
  greetingFormal: 'Dear [Mr./Ms. Last name],',
  greetingFriendly: 'Hi [First name],',
  closingFormal: 'Yours faithfully,',
  closingCordial: 'Kind regards,',
  signatureTitle: `


---
[First and last name]
[Title]
[Organization]`,
  enclosures: `Enclosures: [number]
- [Document 1]
- [Document 2]`,
  copies: 'cc: [Name, title]',
  ps: 'P.S. [your postscript]',
  confidential: '! CONFIDENTIAL',
  registered: '! Registered mail, acknowledgement of receipt requested',
  withoutPrejudice: '! Without prejudice',
  byEmail: '! Sent by email to [address]',
};

/** A part in the template markup (see markup.ts), in French or English. */
export function letterPartMarkup(part: LetterPart, lang: 'fr' | 'en'): string {
  return (lang === 'fr' ? FR : EN)[part];
}
