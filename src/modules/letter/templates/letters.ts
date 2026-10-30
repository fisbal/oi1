// Ready-to-fill letters for Office Letter's "Doc adm/Mil" tab: administrative, government and military letters
// (professional) and everyday letters (normal), in French and English. Words in [brackets] are fields to fill;
// {date} becomes today's date. A small markup keeps them short (see markup.ts):
//   # title   ## heading   ! bold line   > right-aligned line   - bullet   --- signature line   blank line = space

export type LetterCat = 'admin' | 'gov' | 'mil' | 'perso';

export interface LetterTemplate {
  id: string;
  cat: LetterCat;
  title: Record<'en' | 'fr' | 'es' | 'pt' | 'de', string>;
  fr: string;
  en: string;
}

const SENDER_FR = `[Prénom Nom]
[Adresse]
[Ville, province, code postal]
[Téléphone] · [Courriel]`;
const SENDER_EN = `[First and last name]
[Address]
[City, province, postal code]
[Phone] · [Email]`;
const SIGN_FR = `Veuillez agréer, [Madame, Monsieur], l'expression de mes salutations distinguées.



---
[Prénom Nom]`;
const SIGN_EN = `Yours sincerely,



---
[First and last name]`;
const MIL_SIGN_FR = `


---
[Prénom Nom]
[Grade]
[Poste]
[Téléphone] · [Courriel]`;
const MIL_SIGN_EN = `


---
[First and last name]
[Rank]
[Position]
[Phone] · [Email]`;

const letter = (sender: string, to: string, subject: string, body: string, sign: string, date = '{date}') =>
  `${sender}\n\n> ${date}\n\n${to}\n\n! ${subject}\n\n${body}\n\n${sign}`;
const fr = (to: string, subject: string, body: string) => letter(SENDER_FR, to, `Objet : ${subject}`, body, SIGN_FR, '[Ville], le {date}');
const en = (to: string, subject: string, body: string) => letter(SENDER_EN, to, `Subject: ${subject}`, body, SIGN_EN);
const TO_FR = `[Nom du destinataire]
[Fonction]
[Organisme]
[Adresse du destinataire]`;
const TO_EN = `[Recipient's name]
[Title]
[Organization]
[Recipient's address]`;

/** A military memorandum: file number, distribution, subject, references and numbered paragraphs. */
const memoFr = (subject: string, refs: string, paras: string) => `# MÉMORANDUM

[Numéro de dossier]
> {date}

! Destinataire : [Destinataire]
! Expéditeur : [Grade Prénom Nom], [Unité]

! OBJET : ${subject.toUpperCase()}

Références : ${refs}

${paras}
${MIL_SIGN_FR}

Distribution : [Liste de distribution]`;
const memoEn = (subject: string, refs: string, paras: string) => `# MEMORANDUM

[File number]
> {date}

! To: [Addressee]
! From: [Rank First and last name], [Unit]

! SUBJECT: ${subject.toUpperCase()}

References: ${refs}

${paras}
${MIL_SIGN_EN}

Distribution: [Distribution list]`;

export const LETTERS: LetterTemplate[] = [
  // ---------- administrative ----------
  {
    id: 'job', cat: 'admin',
    title: { en: 'Job application', fr: 'Lettre de motivation', es: 'Carta de presentación', pt: 'Carta de candidatura', de: 'Bewerbungsschreiben' },
    fr: fr(TO_FR, 'Candidature au poste de [intitulé du poste]', `[Madame, Monsieur],

Votre offre pour le poste de [intitulé du poste], parue sur [source de l'offre], a retenu toute mon attention. Fort(e) de [nombre] années d'expérience en [domaine], je souhaite mettre mes compétences au service de [nom de l'organisme].

Au cours de mon parcours chez [employeur actuel ou précédent], j'ai [réalisation principale, avec un chiffre si possible]. Cette expérience m'a permis de développer [compétence 1], [compétence 2] et [compétence 3], qui correspondent aux exigences du poste.

Je serais heureux(se) de vous exposer mes motivations lors d'un entretien. Vous trouverez ci-joint mon curriculum vitæ.`),
    en: en(TO_EN, 'Application for the position of [job title]', `Dear [Mr./Ms. Last name],

I am writing to apply for the position of [job title] advertised on [source]. With [number] years of experience in [field], I would welcome the chance to bring my skills to [organization].

At [current or previous employer], I [main achievement, with a figure if possible]. This work strengthened my [skill 1], [skill 2] and [skill 3], which match what the role requires.

I would be glad to discuss how I can contribute to your team. My résumé is attached.`),
  },
  {
    id: 'resign', cat: 'admin',
    title: { en: 'Resignation', fr: 'Démission', es: 'Renuncia', pt: 'Pedido de demissão', de: 'Kündigung' },
    fr: fr(TO_FR, 'Démission', `[Madame, Monsieur],

Par la présente, je vous informe de ma décision de démissionner de mon poste de [intitulé du poste], que j'occupe depuis le [date d'embauche].

Conformément à mon contrat, mon préavis de [durée du préavis] débutera à la réception de cette lettre ; mon dernier jour de travail sera donc le [date du dernier jour].

Je tiens à vous remercier pour la confiance que vous m'avez accordée et je m'engage à faciliter la transition de mes dossiers.`),
    en: en(TO_EN, 'Resignation', `Dear [Mr./Ms. Last name],

Please accept this letter as formal notice of my resignation from my position as [job title], which I have held since [start date].

In line with my contract, my [length of notice] notice period begins today, and my last working day will be [last day].

Thank you for the trust you have placed in me. I will do everything I can to make the handover smooth.`),
  },
  {
    id: 'leave', cat: 'admin',
    title: { en: 'Leave request', fr: 'Demande de congé', es: 'Solicitud de permiso', pt: 'Pedido de licença', de: 'Urlaubsantrag' },
    fr: fr(TO_FR, 'Demande de congé du [date de début] au [date de fin]', `[Madame, Monsieur],

Je vous prie de bien vouloir m'accorder un congé [type de congé : annuel, sans solde, parental…] du [date de début] au [date de fin] inclus, soit [nombre] jours ouvrables.

Afin d'assurer la continuité du service, [nom du collègue] a accepté de me remplacer pour [tâches], et mes dossiers en cours seront à jour avant mon départ.

Je reste à votre disposition pour en discuter.`),
    en: en(TO_EN, 'Leave request from [start date] to [end date]', `Dear [Mr./Ms. Last name],

I would like to request [type of leave: annual, unpaid, parental…] leave from [start date] to [end date] inclusive, that is [number] working days.

To keep things running, [colleague's name] has agreed to cover [tasks], and my current files will be up to date before I leave.

I am happy to discuss this at your convenience.`),
  },
  {
    id: 'complaint', cat: 'admin',
    title: { en: 'Complaint', fr: 'Réclamation', es: 'Reclamación', pt: 'Reclamação', de: 'Beschwerde' },
    fr: fr(TO_FR, 'Réclamation – [numéro de client ou de commande]', `[Madame, Monsieur],

Le [date], j'ai [acheté / souscrit / reçu] [produit ou service] (référence [numéro]). Or, [description précise du problème].

Malgré [mes démarches précédentes : appel du…, courriel du…], la situation n'a pas été réglée. Je vous demande donc de [solution attendue : remplacement, remboursement, intervention] dans un délai de [nombre] jours.

Vous trouverez ci-joint une copie de [facture, bon de commande, photos].`),
    en: en(TO_EN, 'Complaint – [customer or order number]', `Dear Sir or Madam,

On [date], I [bought / subscribed to / received] [product or service] (reference [number]). However, [precise description of the problem].

Despite [previous steps: call on…, email on…], the matter has not been resolved. I therefore ask you to [expected solution: replacement, refund, repair] within [number] days.

Please find attached a copy of [invoice, order, photos].`),
  },
  {
    id: 'cancel', cat: 'admin',
    title: { en: 'Cancel a contract', fr: 'Résiliation de contrat', es: 'Rescisión de contrato', pt: 'Rescisão de contrato', de: 'Vertragskündigung' },
    fr: fr(TO_FR, 'Résiliation du contrat n° [numéro de contrat]', `[Madame, Monsieur],

Je vous informe par la présente de ma décision de résilier mon contrat [type de contrat : abonnement, assurance, téléphonie…] n° [numéro de contrat], à compter du [date d'effet].

Je vous remercie de bien vouloir m'envoyer une confirmation écrite de cette résiliation ainsi que le solde de tout compte, et de cesser tout prélèvement après cette date.`),
    en: en(TO_EN, 'Cancellation of contract no. [contract number]', `Dear Sir or Madam,

I am writing to cancel my [type of contract: subscription, insurance, phone plan…] contract no. [contract number], effective [effective date].

Please send me written confirmation of the cancellation and a final statement, and stop all payments after that date.`),
  },
  {
    id: 'certificate', cat: 'admin',
    title: { en: 'Request a certificate', fr: 'Demande d\'attestation', es: 'Solicitud de certificado', pt: 'Pedido de declaração', de: 'Bescheinigung anfordern' },
    fr: fr(TO_FR, 'Demande d\'attestation [d\'emploi / de scolarité / de salaire]', `[Madame, Monsieur],

J'ai l'honneur de vous demander de bien vouloir m'établir une attestation [d'emploi / de scolarité / de salaire] couvrant la période du [date de début] au [date de fin].

Ce document m'est demandé par [organisme] dans le cadre de [motif]. Je vous serais reconnaissant(e) de me le faire parvenir avant le [date limite].`),
    en: en(TO_EN, 'Request for a certificate of [employment / enrolment / salary]', `Dear [Mr./Ms. Last name],

Could you please issue a certificate of [employment / enrolment / salary] covering the period from [start date] to [end date]?

[Organization] has asked for this document as part of [reason]. I would be grateful to receive it by [deadline].`),
  },
  {
    id: 'address', cat: 'admin',
    title: { en: 'Change of address', fr: 'Changement d\'adresse', es: 'Cambio de dirección', pt: 'Mudança de morada', de: 'Adressänderung' },
    fr: fr(TO_FR, 'Changement d\'adresse – dossier n° [numéro]', `[Madame, Monsieur],

Je vous informe que, depuis le [date du déménagement], ma nouvelle adresse est :

! [Nouvelle adresse complète]

Je vous remercie de mettre à jour mon dossier n° [numéro] et d'envoyer désormais tout courrier à cette adresse.`),
    en: en(TO_EN, 'Change of address – file no. [number]', `Dear Sir or Madam,

Please note that since [moving date], my new address is:

! [Full new address]

Please update file no. [number] and send all future mail to this address.`),
  },
  {
    id: 'refund', cat: 'admin',
    title: { en: 'Refund request', fr: 'Demande de remboursement', es: 'Solicitud de reembolso', pt: 'Pedido de reembolso', de: 'Rückerstattung' },
    fr: fr(TO_FR, 'Demande de remboursement – [référence]', `[Madame, Monsieur],

Le [date], j'ai réglé la somme de [montant] pour [objet du paiement]. [Raison du remboursement : annulation, double paiement, produit défectueux].

Je vous saurais gré de procéder au remboursement de cette somme par [mode de remboursement] dans les meilleurs délais. Vous trouverez ci-joint [justificatif].`),
    en: en(TO_EN, 'Refund request – [reference]', `Dear Sir or Madam,

On [date], I paid [amount] for [what the payment was for]. [Reason for the refund: cancellation, double payment, faulty product].

Please refund this amount by [refund method] as soon as possible. Proof of payment is attached.`),
  },
  {
    id: 'reference', cat: 'admin',
    title: { en: 'Letter of recommendation', fr: 'Lettre de recommandation', es: 'Carta de recomendación', pt: 'Carta de recomendação', de: 'Empfehlungsschreiben' },
    fr: fr('À qui de droit', 'Recommandation pour [Prénom Nom du candidat]', `[Madame, Monsieur],

J'ai eu le plaisir de travailler avec [Prénom Nom du candidat] pendant [durée] au sein de [organisme], où il/elle occupait le poste de [poste].

[Prénom du candidat] s'est distingué(e) par [qualité 1] et [qualité 2]. Je retiens notamment [exemple concret de réalisation].

C'est sans réserve que je recommande [Prénom du candidat] pour [poste ou programme visé]. Je reste disponible au [téléphone] pour tout renseignement.`),
    en: en('To whom it may concern', 'Recommendation for [candidate\'s name]', `Dear Sir or Madam,

I had the pleasure of working with [candidate's name] for [length of time] at [organization], where they served as [position].

[Candidate's first name] stood out for [quality 1] and [quality 2]. One example: [concrete achievement].

I recommend [candidate's first name] without reservation for [position or program]. I am happy to answer any questions at [phone].`),
  },
  {
    id: 'proxy', cat: 'admin',
    title: { en: 'Power of attorney', fr: 'Procuration', es: 'Poder', pt: 'Procuração', de: 'Vollmacht' },
    fr: `# PROCURATION

Je soussigné(e), [Prénom Nom], né(e) le [date de naissance] à [lieu de naissance], demeurant au [adresse],

donne pouvoir à [Prénom Nom du mandataire], né(e) le [date de naissance du mandataire], demeurant au [adresse du mandataire],

pour [objet précis de la procuration : retirer un colis, signer un document, me représenter à…] en mon nom, le [date] / du [date de début] au [date de fin].

Fait à [Ville], le {date}, pour servir et valoir ce que de droit.



---
Signature du mandant, précédée de « Bon pour pouvoir »



---
Signature du mandataire, précédée de « Bon pour acceptation »`,
    en: `# POWER OF ATTORNEY

I, the undersigned, [First and last name], born on [date of birth] in [place of birth], residing at [address],

authorize [attorney's name], born on [attorney's date of birth], residing at [attorney's address],

to [precise purpose: collect a parcel, sign a document, represent me at…] on my behalf, on [date] / from [start date] to [end date].

Signed in [City] on {date}.



---
Signature of the person giving authority



---
Signature of the authorized person`,
  },
  {
    id: 'honour', cat: 'admin',
    title: { en: 'Sworn statement', fr: 'Attestation sur l\'honneur', es: 'Declaración jurada', pt: 'Declaração sob compromisso de honra', de: 'Eidesstattliche Erklärung' },
    fr: `# ATTESTATION SUR L'HONNEUR

Je soussigné(e), [Prénom Nom], né(e) le [date de naissance] à [lieu de naissance], demeurant au [adresse],

atteste sur l'honneur que [objet de l'attestation, énoncé de façon précise].

Je suis informé(e) qu'une fausse déclaration m'expose à des sanctions prévues par la loi.

Fait à [Ville], le {date}.



---
[Prénom Nom]`,
    en: `# SWORN STATEMENT

I, the undersigned, [First and last name], born on [date of birth] in [place of birth], residing at [address],

solemnly declare that [what is declared, stated precisely].

I understand that a false statement may expose me to penalties under the law.

Signed in [City] on {date}.



---
[First and last name]`,
  },
  {
    id: 'notice', cat: 'admin',
    title: { en: 'Formal notice', fr: 'Mise en demeure', es: 'Requerimiento formal', pt: 'Notificação formal', de: 'Mahnung' },
    fr: fr(TO_FR, 'Mise en demeure – [objet du litige]', `[Madame, Monsieur],

Malgré [mes relances du (dates)], vous n'avez pas [obligation non respectée : payer la somme de…, livrer…, effectuer les travaux…], comme convenu le [date de l'accord].

Par la présente, je vous mets en demeure de [action exigée] dans un délai de [nombre] jours à compter de la réception de cette lettre.

À défaut, je me verrai contraint(e) d'engager les recours prévus par la loi, sans autre avis.

Cette lettre vous est envoyée par courrier recommandé.`),
    en: en(TO_EN, 'Formal notice – [subject of the dispute]', `Dear [Mr./Ms. Last name],

Despite [my reminders of (dates)], you have not [obligation not met: paid the sum of…, delivered…, carried out the work…] as agreed on [date of the agreement].

I hereby formally demand that you [required action] within [number] days of receiving this letter.

Failing that, I will take the legal action available to me without further notice.

This letter is sent by registered mail.`),
  },
  {
    id: 'appeal', cat: 'admin',
    title: { en: 'Appeal a decision or fine', fr: 'Contestation d\'une décision ou d\'une amende', es: 'Recurso contra una decisión o multa', pt: 'Contestação de decisão ou multa', de: 'Widerspruch gegen Bescheid oder Bußgeld' },
    fr: fr(TO_FR, 'Contestation de [la décision / l\'avis de contravention] n° [numéro]', `[Madame, Monsieur],

Je conteste [la décision / l'avis] n° [numéro] du [date], qui [résumé de la décision ou de l'infraction reprochée].

En effet, [arguments précis : faits, dates, témoins, erreurs constatées]. Je joins à la présente [pièces justificatives].

Je vous demande donc de bien vouloir [annuler / réexaminer] cette décision.`),
    en: en(TO_EN, 'Appeal of [decision / ticket] no. [number]', `Dear Sir or Madam,

I am appealing [decision / ticket] no. [number] dated [date], which [summary of the decision or alleged offence].

[Precise arguments: facts, dates, witnesses, errors found]. Supporting documents are attached.

I therefore ask you to [cancel / review] this decision.`),
  },
  {
    id: 'meeting', cat: 'admin',
    title: { en: 'Request a meeting', fr: 'Demande de rendez-vous', es: 'Solicitud de cita', pt: 'Pedido de reunião', de: 'Terminanfrage' },
    fr: fr(TO_FR, 'Demande de rendez-vous', `[Madame, Monsieur],

Je souhaiterais vous rencontrer afin d'échanger au sujet de [objet du rendez-vous].

Je suis disponible [disponibilités : jours et heures], en personne ou en visioconférence, pour une durée d'environ [durée].

Je vous remercie par avance de votre réponse.`),
    en: en(TO_EN, 'Meeting request', `Dear [Mr./Ms. Last name],

I would like to meet with you to discuss [purpose of the meeting].

I am available [availability: days and times], in person or by video call, for about [length].

Thank you in advance for your reply.`),
  },

  // ---------- government ----------
  {
    id: 'civil', cat: 'gov',
    title: { en: 'Request an official document', fr: 'Demande de document officiel', es: 'Solicitud de documento oficial', pt: 'Pedido de documento oficial', de: 'Amtliche Urkunde anfordern' },
    fr: fr(`[Service de l'état civil / Bureau des passeports]
[Adresse du service]`, 'Demande de [acte de naissance / certificat / passeport]', `[Madame, Monsieur],

Je vous prie de bien vouloir me délivrer [nombre] copie(s) de [type de document] au nom de [Prénom Nom], né(e) le [date de naissance] à [lieu de naissance].

Ce document est nécessaire pour [motif]. Vous trouverez ci-joint [pièce d'identité, paiement des frais de (montant), enveloppe-réponse].`),
    en: en(`[Vital Statistics / Passport Office]
[Office address]`, 'Request for [birth certificate / certificate / passport]', `Dear Sir or Madam,

Please issue [number] copy/copies of [type of document] for [First and last name], born on [date of birth] in [place of birth].

I need this document for [reason]. Enclosed are [ID, payment of the fee of (amount), return envelope].`),
  },
  {
    id: 'tax', cat: 'gov',
    title: { en: 'Tax agency: payment plan', fr: 'Impôts : délai de paiement', es: 'Hacienda: plan de pagos', pt: 'Finanças: plano de pagamento', de: 'Finanzamt: Ratenzahlung' },
    fr: fr(`[Agence du revenu / Centre des impôts]
[Adresse]`, 'Demande d\'entente de paiement – numéro d\'assurance sociale / fiscal [numéro]', `[Madame, Monsieur],

J'ai bien reçu l'avis de cotisation du [date] indiquant un solde de [montant]. En raison de [motif : perte d'emploi, maladie, baisse de revenus], je ne suis pas en mesure de régler cette somme en une seule fois.

Je vous propose de verser [montant] par [mois / quinzaine] à compter du [date], jusqu'au règlement complet. Je joins [justificatifs de revenus et de dépenses].

Je vous remercie de l'attention portée à ma demande.`),
    en: en(`[Revenue Agency / Tax Office]
[Address]`, 'Payment arrangement request – social insurance / tax number [number]', `Dear Sir or Madam,

I have received the notice of assessment dated [date] showing a balance of [amount]. Because of [reason: job loss, illness, lower income], I cannot pay this amount at once.

I propose to pay [amount] every [month / two weeks] starting [date] until the balance is paid in full. Proof of income and expenses is enclosed.

Thank you for considering my request.`),
  },
  {
    id: 'mp', cat: 'gov',
    title: { en: 'Letter to an elected official', fr: 'Lettre à un élu', es: 'Carta a un representante electo', pt: 'Carta a um eleito', de: 'Brief an Abgeordnete' },
    fr: fr(`[Titre : Monsieur le Député / Madame la Mairesse…]
[Prénom Nom de l'élu]
[Adresse du bureau]`, '[Sujet de la démarche]', `[Monsieur le Député / Madame la Députée],

En tant que citoyen(ne) de votre circonscription de [nom de la circonscription], je souhaite attirer votre attention sur [sujet].

[Exposé de la situation et de son impact, avec un exemple concret.]

Je vous demande de [action souhaitée : intervenir auprès de…, soutenir…, m'accorder un rendez-vous]. Je vous remercie de l'attention que vous porterez à cette lettre.`),
    en: en(`[Title: The Honourable / Mayor…]
[Official's name]
[Office address]`, '[Topic]', `Dear [Mr./Ms. Last name],

As a constituent of [riding or district], I am writing to bring [topic] to your attention.

[What the situation is and how it affects people, with a concrete example.]

I ask you to [desired action: raise the matter with…, support…, meet with me]. Thank you for your attention to this letter.`),
  },
  {
    id: 'benefit', cat: 'gov',
    title: { en: 'Apply for a benefit', fr: 'Demande de prestation ou d\'aide', es: 'Solicitud de prestación', pt: 'Pedido de apoio social', de: 'Antrag auf Leistungen' },
    fr: fr(`[Ministère / Service concerné]
[Adresse]`, 'Demande de [nom de la prestation ou de l\'aide]', `[Madame, Monsieur],

Je sollicite le bénéfice de [nom de la prestation] à compter du [date]. Ma situation est la suivante : [situation familiale, revenus, emploi, santé].

Je remplis les conditions d'admissibilité, notamment [condition 1] et [condition 2]. Vous trouverez ci-joint [formulaire rempli et pièces justificatives].

Je reste à votre disposition pour tout complément d'information.`),
    en: en(`[Department / Service]
[Address]`, 'Application for [name of the benefit]', `Dear Sir or Madam,

I am applying for [name of the benefit] starting [date]. My situation is as follows: [family, income, employment, health].

I meet the eligibility requirements, including [requirement 1] and [requirement 2]. The completed form and supporting documents are enclosed.

Please let me know if you need anything else.`),
  },
  {
    id: 'support', cat: 'gov',
    title: { en: 'Letter of support (immigration)', fr: 'Lettre d\'appui (immigration)', es: 'Carta de apoyo (inmigración)', pt: 'Carta de apoio (imigração)', de: 'Unterstützungsschreiben (Einwanderung)' },
    fr: fr(`[Ministère de l'Immigration / Ambassade]
[Adresse]`, 'Lettre d\'appui – dossier de [Prénom Nom du demandeur], n° [numéro de dossier]', `[Madame, Monsieur],

Je soussigné(e), [Prénom Nom], [citoyen(ne) / résident(e) permanent(e)] du [pays], appuie la demande de [type de demande : résidence permanente, visa, citoyenneté] de [Prénom Nom du demandeur].

Je connais [Prénom du demandeur] depuis [durée] en tant que [lien : ami, employeur, membre de la famille]. [Faits concrets montrant son intégration, son sérieux ou le lien familial.]

Je confirme l'exactitude de ces informations et reste joignable au [téléphone].`),
    en: en(`[Immigration Department / Embassy]
[Address]`, 'Letter of support – application of [applicant\'s name], file no. [file number]', `Dear Sir or Madam,

I, [First and last name], a [citizen / permanent resident] of [country], support the [type: permanent residence, visa, citizenship] application of [applicant's name].

I have known [applicant's first name] for [length of time] as their [relationship: friend, employer, relative]. [Concrete facts showing integration, reliability or family ties.]

I confirm that this information is true and can be reached at [phone].`),
  },
  {
    id: 'atip', cat: 'gov',
    title: { en: 'Access to information request', fr: 'Demande d\'accès à l\'information', es: 'Solicitud de acceso a la información', pt: 'Pedido de acesso à informação', de: 'Antrag auf Akteneinsicht' },
    fr: fr(`[Coordonnateur de l'accès à l'information]
[Organisme public]
[Adresse]`, 'Demande d\'accès à l\'information', `[Madame, Monsieur],

En vertu de [loi applicable sur l'accès à l'information], je demande à obtenir copie des documents suivants : [description précise des documents, période visée].

Je souhaite recevoir ces documents sous forme [électronique / papier] à l'adresse [courriel ou postale]. Je joins [frais de demande, s'il y a lieu].`),
    en: en(`[Access to Information Coordinator]
[Public body]
[Address]`, 'Access to information request', `Dear Sir or Madam,

Under [applicable access to information act], I request copies of the following records: [precise description of the records and period].

I would like to receive them in [electronic / paper] form at [email or postal address]. [The application fee is enclosed, if any.]`),
  },

  // ---------- military ----------
  {
    id: 'memo', cat: 'mil',
    title: { en: 'Memorandum', fr: 'Note de service (mémorandum)', es: 'Memorándum', pt: 'Memorando', de: 'Dienstliche Mitteilung' },
    fr: memoFr('[Objet]', '[A. Référence / aucune]', `1. [Contexte : pourquoi cette note.]

2. [Information ou demande principale.]

3. [Action attendue, responsable et échéance.]`),
    en: memoEn('[Subject]', '[A. Reference / none]', `1. [Background: why this memo.]

2. [Main information or request.]

3. [Action required, by whom and by when.]`),
  },
  {
    id: 'milLeave', cat: 'mil',
    title: { en: 'Leave request (military)', fr: 'Demande de congé (militaire)', es: 'Solicitud de permiso (militar)', pt: 'Pedido de licença (militar)', de: 'Urlaubsgesuch (militärisch)' },
    fr: memoFr('Demande de congé annuel – [Grade Nom]', 'A. [Directive sur les congés]', `1. Je demande respectueusement [nombre] jours de congé [annuel / spécial] du [date de début] au [date de fin] inclusivement.

2. Pendant mon absence, je serai joignable au [téléphone] et à l'adresse suivante : [adresse pendant le congé].

3. Mes tâches seront assurées par [Grade Nom du remplaçant], qui a été informé(e) des dossiers en cours.

4. Solde de congés actuel : [nombre] jours.`),
    en: memoEn('Annual leave request – [Rank Name]', 'A. [Leave policy]', `1. I respectfully request [number] days of [annual / special] leave from [start date] to [end date] inclusive.

2. During my absence I can be reached at [phone] and at the following address: [leave address].

3. My duties will be covered by [Rank Name of replacement], who has been briefed on current files.

4. Current leave balance: [number] days.`),
  },
  {
    id: 'posting', cat: 'mil',
    title: { en: 'Posting request', fr: 'Demande de mutation', es: 'Solicitud de traslado', pt: 'Pedido de transferência', de: 'Versetzungsgesuch' },
    fr: memoFr('Demande de mutation – [Grade Nom]', 'A. [Directive sur les affectations]', `1. Je demande respectueusement à être muté(e) à [unité ou base souhaitée] à compter de la période d'affectation [année].

2. Cette demande est motivée par [motifs : familiaux, professionnels, formation, conjoint militaire].

3. Mon expérience en [domaine] et mes qualifications [qualifications] correspondent aux besoins de [unité souhaitée].

4. Je suis disponible pour une entrevue avec le gestionnaire de carrière à sa convenance.`),
    en: memoEn('Posting request – [Rank Name]', 'A. [Posting policy]', `1. I respectfully request a posting to [desired unit or base] for the [year] posting season.

2. The request is based on [reasons: family, career, training, military spouse].

3. My experience in [field] and my qualifications [qualifications] match the needs of [desired unit].

4. I am available to meet the career manager at their convenience.`),
  },
  {
    id: 'incident', cat: 'mil',
    title: { en: 'Incident report', fr: 'Rapport d\'incident', es: 'Informe de incidente', pt: 'Relatório de incidente', de: 'Vorfallsbericht' },
    fr: memoFr('Rapport d\'incident – [nature de l\'incident]', 'A. [Ordre permanent applicable]', `1. Date, heure et lieu : [date], [heure], [lieu précis].

2. Personnes impliquées : [grades, noms, unités].

3. Déroulement des faits : [récit chronologique, factuel et précis].

4. Blessures et dommages : [description / aucun].

5. Mesures prises : [premiers soins, sécurisation, autorités avisées et heure].

6. Recommandations : [mesures pour éviter que cela se reproduise].`),
    en: memoEn('Incident report – [type of incident]', 'A. [Applicable standing order]', `1. Date, time and place: [date], [time], [exact location].

2. Persons involved: [ranks, names, units].

3. Sequence of events: [factual, precise, in order].

4. Injuries and damage: [description / none].

5. Actions taken: [first aid, securing the area, authorities notified and when].

6. Recommendations: [measures to prevent it happening again].`),
  },
  {
    id: 'release', cat: 'mil',
    title: { en: 'Release / retirement request', fr: 'Demande de libération', es: 'Solicitud de baja', pt: 'Pedido de passagem à reserva', de: 'Antrag auf Entlassung' },
    fr: memoFr('Demande de libération volontaire – [Grade Nom], [matricule]', 'A. [Directive sur les libérations]', `1. Je demande respectueusement ma libération volontaire des Forces, avec une date de libération souhaitée au [date].

2. Cette décision fait suite à [motif : retraite, nouvelle carrière, raisons familiales].

3. Je souhaite bénéficier de [congé de fin de service, programme de transition, cours de préparation à la retraite].

4. Je remercie la chaîne de commandement pour le soutien reçu durant mes [nombre] années de service.`),
    en: memoEn('Voluntary release request – [Rank Name], [service number]', 'A. [Release policy]', `1. I respectfully request a voluntary release from the Forces, with a requested release date of [date].

2. This decision follows [reason: retirement, new career, family reasons].

3. I would like to use [retirement leave, the transition program, the second career assistance course].

4. I thank the chain of command for the support I received over my [number] years of service.`),
  },
  {
    id: 'milReference', cat: 'mil',
    title: { en: 'Letter of appreciation', fr: 'Lettre d\'appréciation', es: 'Carta de reconocimiento', pt: 'Carta de louvor', de: 'Anerkennungsschreiben' },
    fr: memoFr('Lettre d\'appréciation – [Grade Nom]', 'aucune', `1. Je tiens à souligner le travail remarquable de [Grade Nom] lors de [opération, exercice ou tâche], du [date de début] au [date de fin].

2. [Grade Nom] a [réalisations concrètes : responsabilités, résultats, initiative].

3. Son professionnalisme et son dévouement reflètent les plus hautes traditions de [unité ou Forces]. Je lui adresse mes plus sincères félicitations.`),
    en: memoEn('Letter of appreciation – [Rank Name]', 'none', `1. I wish to recognize the outstanding work of [Rank Name] during [operation, exercise or task], from [start date] to [end date].

2. [Rank Name] [concrete achievements: responsibilities, results, initiative].

3. Their professionalism and dedication reflect the highest traditions of [unit or Forces]. Please accept my sincere congratulations.`),
  },
  {
    id: 'sitrep', cat: 'mil',
    title: { en: 'Situation report (SITREP)', fr: 'Compte rendu de situation (SITREP)', es: 'Informe de situación (SITREP)', pt: 'Relatório de situação (SITREP)', de: 'Lagebericht (SITREP)' },
    fr: `# COMPTE RENDU DE SITUATION (SITREP) N° [numéro]

! De : [Grade Nom], [Unité]
! À : [Destinataire]
! Groupe date-heure : [GDH]
! Période couverte : du [GDH de début] au [GDH de fin]

## 1. Situation générale
[Résumé en deux ou trois phrases.]

## 2. Activités amies
[Ce que l'unité a accompli.]

## 3. Activités adverses / environnement
[Observations, menaces, météo, population.]

## 4. Personnel
[Effectif, pertes, blessés, moral.]

## 5. Logistique
[Carburant, munitions, vivres, matériel, besoins.]

## 6. Intentions
[Prochaines actions prévues.]

## 7. Demandes au commandement
[Soutien demandé / aucune.]
${MIL_SIGN_FR}`,
    en: `# SITUATION REPORT (SITREP) NO. [number]

! From: [Rank Name], [Unit]
! To: [Addressee]
! Date-time group: [DTG]
! Period covered: from [start DTG] to [end DTG]

## 1. General situation
[Two or three sentence summary.]

## 2. Own activities
[What the unit achieved.]

## 3. Enemy activity / environment
[Observations, threats, weather, population.]

## 4. Personnel
[Strength, casualties, morale.]

## 5. Logistics
[Fuel, ammunition, rations, equipment, needs.]

## 6. Intentions
[Next planned actions.]

## 7. Requests to higher
[Support requested / none.]
${MIL_SIGN_EN}`,
  },
  {
    id: 'order', cat: 'mil',
    title: { en: 'Five-paragraph order (SMEAC)', fr: 'Ordre en cinq paragraphes (SMEAC)', es: 'Orden de cinco párrafos', pt: 'Ordem em cinco parágrafos', de: 'Befehl in fünf Absätzen' },
    fr: `# ORDRE D'OPÉRATION [nom de l'opération]

! Groupe date-heure : [GDH] · Référence carte : [carte, échelle]
! Fuseau horaire : [fuseau]

## 1. Situation
a. Forces adverses : [description].
b. Forces amies : [unités voisines, appuis].
c. Rattachements et détachements : [s'il y a lieu].

## 2. Mission
[Qui, quoi, où, quand, pourquoi : une seule phrase.]

## 3. Exécution
a. Intention du commandant : [but, effet final recherché].
b. Concept de l'opération : [phases].
c. Tâches aux sous-unités : [unité : tâche].
d. Instructions de coordination : [horaires, mesures de contrôle].

## 4. Soutien
[Logistique, ravitaillement, soins médicaux, transport.]

## 5. Commandement et transmissions
[Emplacement du commandant, chaîne de commandement, fréquences, mots de passe.]

Accusé de réception : [moyen].
${MIL_SIGN_FR}`,
    en: `# OPERATION ORDER [operation name]

! Date-time group: [DTG] · Map reference: [map, scale]
! Time zone: [time zone]

## 1. Situation
a. Enemy forces: [description].
b. Friendly forces: [neighbouring units, support].
c. Attachments and detachments: [if any].

## 2. Mission
[Who, what, where, when, why, in one sentence.]

## 3. Execution
a. Commander's intent: [purpose, end state].
b. Concept of operations: [phases].
c. Tasks to sub-units: [unit: task].
d. Coordinating instructions: [timings, control measures].

## 4. Service support
[Logistics, resupply, medical, transport.]

## 5. Command and signal
[Commander's location, chain of command, frequencies, passwords.]

Acknowledge: [means].
${MIL_SIGN_EN}`,
  },
  {
    id: 'course', cat: 'mil',
    title: { en: 'Training / course request', fr: 'Demande de cours ou de formation', es: 'Solicitud de curso', pt: 'Pedido de formação', de: 'Lehrgangsantrag' },
    fr: memoFr('Demande de cours – [nom du cours], [Grade Nom]', 'A. [Calendrier des cours / message de sélection]', `1. Je demande respectueusement à être inscrit(e) au cours [nom et numéro du cours] prévu du [date de début] au [date de fin] à [lieu].

2. Ce cours est requis pour [qualification, promotion, poste visé] et contribuera directement à [bénéfice pour l'unité].

3. Je satisfais aux préalables : [préalables]. Mon superviseur, [Grade Nom], appuie cette demande.`),
    en: memoEn('Course request – [course name], [Rank Name]', 'A. [Course calendar / selection message]', `1. I respectfully request a seat on [course name and number], scheduled from [start date] to [end date] at [location].

2. The course is required for [qualification, promotion, target position] and will directly benefit [the unit, how].

3. I meet the prerequisites: [prerequisites]. My supervisor, [Rank Name], supports this request.`),
  },
  {
    id: 'unitThanks', cat: 'mil',
    title: { en: 'Unit thank-you letter', fr: 'Lettre de remerciement d\'unité', es: 'Carta de agradecimiento de unidad', pt: 'Carta de agradecimento da unidade', de: 'Dankschreiben der Einheit' },
    fr: `[Insigne ou nom de l'unité]
[Adresse de l'unité]

> {date}

[Nom du destinataire]
[Organisme]
[Adresse]

! Objet : Remerciements de [nom de l'unité]

[Madame, Monsieur],

Au nom de tous les membres de [nom de l'unité], je tiens à vous remercier chaleureusement pour [aide, accueil, soutien apporté] lors de [événement ou opération].

Votre contribution a permis de [résultat concret]. Elle témoigne du lien précieux qui unit [la communauté / votre organisme] et nos militaires.

Veuillez agréer, [Madame, Monsieur], l'expression de ma haute considération.
${MIL_SIGN_FR}`,
    en: `[Unit badge or name]
[Unit address]

> {date}

[Recipient's name]
[Organization]
[Address]

! Subject: Thank you from [unit name]

Dear [Mr./Ms. Last name],

On behalf of every member of [unit name], I want to thank you warmly for [help, welcome, support] during [event or operation].

Your contribution made it possible to [concrete result]. It shows the strong bond between [the community / your organization] and our soldiers.

Yours sincerely,
${MIL_SIGN_EN}`,
  },

  // ---------- everyday (normal) ----------
  {
    id: 'thanks', cat: 'perso',
    title: { en: 'Thank-you letter', fr: 'Lettre de remerciement', es: 'Carta de agradecimiento', pt: 'Carta de agradecimento', de: 'Dankesbrief' },
    fr: `> [Ville], le {date}

[Cher / Chère] [Prénom],

Je tenais à te remercier du fond du cœur pour [ce que la personne a fait]. [Pourquoi cela a compté pour toi.]

[Un souvenir ou un détail personnel.]

Avec toute ma reconnaissance,

[Prénom]`,
    en: `> {date}

Dear [First name],

I wanted to thank you from the bottom of my heart for [what they did]. [Why it mattered to you.]

[A memory or personal detail.]

With all my gratitude,

[First name]`,
  },
  {
    id: 'invite', cat: 'perso',
    title: { en: 'Invitation', fr: 'Invitation', es: 'Invitación', pt: 'Convite', de: 'Einladung' },
    fr: `# Vous êtes invité(e) !

[Prénom Nom] a le plaisir de vous inviter à [événement : anniversaire, mariage, fête, cérémonie]

! le [date] à [heure]
! [Lieu, adresse]

[Détails : tenue, repas, activités.]

Merci de confirmer votre présence avant le [date] au [téléphone ou courriel].`,
    en: `# You're invited!

[First and last name] is delighted to invite you to [event: birthday, wedding, party, ceremony]

! on [date] at [time]
! [Place, address]

[Details: dress code, meal, activities.]

Please RSVP by [date] at [phone or email].`,
  },
  {
    id: 'condolences', cat: 'perso',
    title: { en: 'Condolences', fr: 'Condoléances', es: 'Condolencias', pt: 'Condolências', de: 'Beileid' },
    fr: `> [Ville], le {date}

[Cher / Chère] [Prénom],

C'est avec une profonde tristesse que j'ai appris le décès de [nom du défunt]. Je te présente mes plus sincères condoléances, ainsi qu'à toute ta famille.

[Un souvenir ou une qualité du défunt.]

Je pense très fort à toi. N'hésite pas à faire appel à moi pour [aide concrète].

Avec toute mon affection,

[Prénom]`,
    en: `> {date}

Dear [First name],

I was deeply saddened to hear of the passing of [name]. Please accept my heartfelt condolences, for you and your whole family.

[A memory or quality of the person.]

You are in my thoughts. Please call on me for [practical help].

With love,

[First name]`,
  },
  {
    id: 'apology', cat: 'perso',
    title: { en: 'Apology', fr: 'Excuses', es: 'Disculpa', pt: 'Pedido de desculpas', de: 'Entschuldigung' },
    fr: `> [Ville], le {date}

[Cher / Chère] [Prénom],

Je te dois des excuses pour [ce qui s'est passé]. Je comprends que cela ait pu te [blesser / décevoir], et je le regrette sincèrement.

[Ce que tu vas faire pour réparer ou éviter que cela se reproduise.]

J'espère que tu pourras me pardonner.

[Prénom]`,
    en: `> {date}

Dear [First name],

I owe you an apology for [what happened]. I understand it may have [hurt / disappointed] you, and I am truly sorry.

[What you will do to make it right or to avoid it happening again.]

I hope you can forgive me.

[First name]`,
  },
  {
    id: 'congrats', cat: 'perso',
    title: { en: 'Congratulations', fr: 'Félicitations', es: 'Felicitaciones', pt: 'Felicitações', de: 'Glückwünsche' },
    fr: `> [Ville], le {date}

[Cher / Chère] [Prénom],

Toutes mes félicitations pour [réussite : diplôme, promotion, naissance, mariage] ! [Pourquoi c'est mérité.]

Je te souhaite [vœux pour la suite].

Bien amicalement,

[Prénom]`,
    en: `> {date}

Dear [First name],

Congratulations on [achievement: graduation, promotion, new baby, wedding]! [Why it is well deserved.]

I wish you [wishes for what comes next].

Warmly,

[First name]`,
  },
];

export const LETTER_CATS: LetterCat[] = ['admin', 'gov', 'mil', 'perso'];
