// Office Assistant without any AI: 24 everyday tasks it knows how to make on its own, as ready plans with real
// content (English and French; the other languages are translated on the device when the browser can, else English).
// The same 24 tasks are the idea cards on the Assistant's home screen; with an AI, a card asks the AI instead.

import { stepId, TABLE_MARK, type Plan, type Step, type StepApp } from './plan';

export type RecipeLang = 'en' | 'fr';
type Text = Record<RecipeLang, string>;
type Lines = Record<RecipeLang, string[]>;
type Rows = Record<RecipeLang, string[][]>;

/** One document of a recipe. Lines: "## " a heading, "- " a list item, "[[TABLE]]" the table, else a paragraph. */
interface Part { app: StepApp; name: Text; purpose: Text; lines?: Lines; rows?: Rows; files?: (lang: RecipeLang) => Record<string, string>; table?: number; from?: number }
export interface Recipe { id: string; icon: string; words: string[]; parts: Part[] }

const T = (en: string, fr: string): Text => ({ en, fr });

const DATE = '[Date]';
const SIGN = { en: ['Yours sincerely,', '[Your name]'], fr: ['Je vous prie d’agréer, Madame, Monsieur, l’expression de mes salutations distinguées.', '[Votre nom]'] };
const HEAD = {
  en: ['[Your name]<br>[Your address]<br>[Phone] · [Email]', '[Recipient]<br>[Their address]', DATE],
  fr: ['[Votre nom]<br>[Votre adresse]<br>[Téléphone] · [E-mail]', '[Destinataire]<br>[Son adresse]', `[Ville], le ${DATE}`],
};
const letter = (en: string[], fr: string[]): Lines => ({ en: [...HEAD.en, ...en, ...SIGN.en], fr: [...HEAD.fr, ...fr, ...SIGN.fr] });

// ---------- the 24 tasks ----------

export const RECIPES: Recipe[] = [
  {
    id: 'bankBudget', icon: '🏦',
    words: ['banque', 'bank', 'banco', 'budget', 'presupuesto', 'orcamento', 'haushalt', 'conseiller', 'courrier banque', 'pret', 'credit'],
    parts: [
      { app: 'class', name: T('Monthly budget', 'Budget mensuel'), purpose: T('Income, expenses and what is left each month, with totals that compute themselves.', 'Revenus, dépenses et reste à vivre chaque mois, avec des totaux qui se calculent seuls.'),
        rows: {
          en: [['Item', 'Type', 'Amount'], ['Salary', 'Income', '2400'], ['Other income', 'Income', '150'], ['Rent', 'Expense', '850'], ['Energy', 'Expense', '110'], ['Food', 'Expense', '380'], ['Transport', 'Expense', '120'], ['Insurance', 'Expense', '90'], ['Phone and internet', 'Expense', '45'], ['Savings', 'Expense', '200'], ['Total income', '', '=SUMIF(B2:B10,"Income",C2:C10)'], ['Total expenses', '', '=SUMIF(B2:B10,"Expense",C2:C10)'], ['Left each month', '', '=C11-C12']],
          fr: [['Poste', 'Type', 'Montant'], ['Salaire', 'Revenu', '2400'], ['Autres revenus', 'Revenu', '150'], ['Loyer', 'Dépense', '850'], ['Énergie', 'Dépense', '110'], ['Alimentation', 'Dépense', '380'], ['Transport', 'Dépense', '120'], ['Assurances', 'Dépense', '90'], ['Téléphone et internet', 'Dépense', '45'], ['Épargne', 'Dépense', '200'], ['Total des revenus', '', '=SUMIF(B2:B10,"Revenu",C2:C10)'], ['Total des dépenses', '', '=SUMIF(B2:B10,"Dépense",C2:C10)'], ['Reste à vivre', '', '=C11-C12']],
        } },
      { app: 'letter', name: T('Letter to the bank', 'Courrier pour la banque'), purpose: T('Presents your budget to your adviser; the table stays linked to the sheet.', 'Présente votre budget à votre conseiller ; le tableau reste relié à la feuille.'), table: 0,
        lines: letter(
          ['<strong>Subject: my monthly budget</strong>', 'Dear [Adviser’s name],', 'Following our conversation, please find below my monthly budget: my income, my regular expenses and what is left each month.', TABLE_MARK, 'I remain at your disposal for any further information and would be glad to discuss it at a meeting.'],
          ['<strong>Objet : mon budget mensuel</strong>', 'Madame, Monsieur,', 'Suite à notre échange, je vous prie de trouver ci-dessous mon budget mensuel : mes revenus, mes dépenses régulières et mon reste à vivre.', TABLE_MARK, 'Je reste à votre disposition pour tout complément d’information et serais heureux d’en parler lors d’un rendez-vous.'],
        ) },
      { app: 'pdf', name: T('Letter to the bank (PDF)', 'Courrier pour la banque (PDF)'), purpose: T('Ready to send by email or to print.', 'Prêt à envoyer par e-mail ou à imprimer.'), from: 1 },
    ],
  },
  {
    id: 'familyBudget', icon: '👪',
    words: ['famille', 'family', 'familia', 'familie', 'foyer', 'household', 'depenses', 'expenses', 'gastos', 'despesas', 'ausgaben'],
    parts: [
      { app: 'class', name: T('Family budget', 'Budget familial'), purpose: T('Twelve months of income and expenses, with the balance of each month.', 'Douze mois de revenus et de dépenses, avec le solde de chaque mois.'),
        rows: {
          en: [['Month', 'Income', 'Housing', 'Food', 'Children', 'Leisure', 'Other', 'Balance'], ...['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m, i) => [m, '3200', '950', '600', '300', '150', '200', `=B${i + 2}-SUM(C${i + 2}:G${i + 2})`]), ['Year', '=SUM(B2:B13)', '=SUM(C2:C13)', '=SUM(D2:D13)', '=SUM(E2:E13)', '=SUM(F2:F13)', '=SUM(G2:G13)', '=SUM(H2:H13)']],
          fr: [['Mois', 'Revenus', 'Logement', 'Alimentation', 'Enfants', 'Loisirs', 'Divers', 'Solde'], ...['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'].map((m, i) => [m, '3200', '950', '600', '300', '150', '200', `=B${i + 2}-SUM(C${i + 2}:G${i + 2})`]), ['Année', '=SUM(B2:B13)', '=SUM(C2:C13)', '=SUM(D2:D13)', '=SUM(E2:E13)', '=SUM(F2:F13)', '=SUM(G2:G13)', '=SUM(H2:H13)']],
        } },
    ],
  },
  {
    id: 'cvLetter', icon: '🧑‍💼',
    words: ['cv', 'resume', 'curriculum', 'lebenslauf', 'candidature', 'application', 'motivation', 'emploi', 'job', 'empleo', 'emprego', 'bewerbung'],
    parts: [
      { app: 'letter', name: T('CV', 'CV'), purpose: T('A clear one-page CV to fill in.', 'Un CV clair d’une page à compléter.'),
        lines: {
          en: ['[Your name]<br>[Job title you want]', '[Phone] · [Email] · [City] · [LinkedIn]', '## Profile', 'Reliable and organised [profession] with [n] years of experience in [field], known for [strength].', '## Experience', '<strong>[Job title]</strong> · [Company] · [2022 – today]', '- [What you did, with a result: +15% sales, 30 clients…]', '- [Another achievement]', '<strong>[Job title]</strong> · [Company] · [2019 – 2022]', '- [What you did]', '## Education', '<strong>[Diploma]</strong> · [School] · [Year]', '## Skills', '- [Skill 1] · [Skill 2] · [Skill 3]', '## Languages', '- [Language]: [level]', '## Interests', '- [Interest 1], [Interest 2]'],
          fr: ['[Votre nom]<br>[Poste recherché]', '[Téléphone] · [E-mail] · [Ville] · [LinkedIn]', '## Profil', '[Métier] fiable et organisé, [n] ans d’expérience en [domaine], reconnu pour [qualité].', '## Expérience', '<strong>[Poste]</strong> · [Entreprise] · [2022 – aujourd’hui]', '- [Ce que vous avez fait, avec un résultat : +15 % de ventes, 30 clients…]', '- [Une autre réussite]', '<strong>[Poste]</strong> · [Entreprise] · [2019 – 2022]', '- [Ce que vous avez fait]', '## Formation', '<strong>[Diplôme]</strong> · [École] · [Année]', '## Compétences', '- [Compétence 1] · [Compétence 2] · [Compétence 3]', '## Langues', '- [Langue] : [niveau]', '## Centres d’intérêt', '- [Intérêt 1], [Intérêt 2]'],
        } },
      { app: 'letter', name: T('Cover letter', 'Lettre de motivation'), purpose: T('Goes with the CV, for the same job.', 'Accompagne le CV, pour le même poste.'),
        lines: letter(
          ['<strong>Subject: application for the position of [job title]</strong>', 'Dear [Hiring manager’s name],', 'Your offer for the position of [job title] caught my attention: [company] is known for [what you like about them], and I would like to contribute to it.', 'Over [n] years as [profession] at [previous company], I [main achievement with a figure]. I also [second strength], which matches what you are looking for.', 'I would be glad to tell you more at an interview. Thank you for your time and consideration.'],
          ['<strong>Objet : candidature au poste de [poste]</strong>', 'Madame, Monsieur,', 'Votre offre pour le poste de [poste] a retenu toute mon attention : [entreprise] est reconnue pour [ce qui vous plaît], et je souhaite y contribuer.', 'En [n] ans comme [métier] chez [entreprise précédente], j’ai [réussite principale chiffrée]. J’ai aussi [deuxième atout], ce qui correspond à ce que vous recherchez.', 'Je serais heureux de vous en dire plus lors d’un entretien. Je vous remercie de l’attention portée à ma candidature.'],
        ) },
    ],
  },
  {
    id: 'invoice', icon: '🧾',
    words: ['facture', 'invoice', 'factura', 'fatura', 'rechnung', 'facturer', 'bill', 'client', 'tva', 'vat'],
    parts: [
      { app: 'class', name: T('Invoice', 'Facture'), purpose: T('Lines, VAT and total due, computed by the sheet.', 'Lignes, TVA et total à payer, calculés par la feuille.'),
        rows: {
          en: [['Description', 'Quantity', 'Unit price', 'Total'], ['[Service or product 1]', '2', '150', '=B2*C2'], ['[Service or product 2]', '5', '40', '=B3*C3'], ['[Service or product 3]', '1', '320', '=B4*C4'], ['Subtotal', '', '', '=SUM(D2:D4)'], ['VAT 20%', '', '', '=D5*0.2'], ['Total due', '', '', '=D5+D6']],
          fr: [['Désignation', 'Quantité', 'Prix unitaire', 'Total'], ['[Prestation ou produit 1]', '2', '150', '=B2*C2'], ['[Prestation ou produit 2]', '5', '40', '=B3*C3'], ['[Prestation ou produit 3]', '1', '320', '=B4*C4'], ['Total HT', '', '', '=SUM(D2:D4)'], ['TVA 20 %', '', '', '=D5*0.2'], ['Total TTC', '', '', '=D5+D6']],
        } },
      { app: 'letter', name: T('Invoice letter', 'Facture (document)'), purpose: T('The invoice as a document, with the linked table.', 'La facture en document, avec le tableau relié.'), table: 0,
        lines: {
          en: ['<strong>[Your company]</strong><br>[Address]<br>[Company number] · [Email]', '<strong>Invoice no. [0001]</strong> · ' + DATE, 'Bill to: [Client name]<br>[Client address]', TABLE_MARK, 'Payment within 30 days by bank transfer to IBAN [IBAN]. Thank you for your trust.'],
          fr: ['<strong>[Votre entreprise]</strong><br>[Adresse]<br>[SIRET] · [E-mail]', '<strong>Facture n° [0001]</strong> · ' + DATE, 'Client : [Nom du client]<br>[Adresse du client]', TABLE_MARK, 'Paiement sous 30 jours par virement sur l’IBAN [IBAN]. Merci de votre confiance.'],
        } },
      { app: 'pdf', name: T('Invoice (PDF)', 'Facture (PDF)'), purpose: T('To send to the client.', 'À envoyer au client.'), from: 1 },
    ],
  },
  {
    id: 'quote', icon: '📐',
    words: ['devis', 'quote', 'quotation', 'estimate', 'presupuesto', 'orcamento', 'angebot', 'chiffrage', 'travaux'],
    parts: [
      { app: 'class', name: T('Quote', 'Devis'), purpose: T('Work, materials and total, with VAT.', 'Travaux, fournitures et total, avec la TVA.'),
        rows: {
          en: [['Work', 'Hours or quantity', 'Rate', 'Amount'], ['[Preparation]', '4', '45', '=B2*C2'], ['[Main work]', '12', '45', '=B3*C3'], ['[Materials]', '1', '380', '=B4*C4'], ['[Cleaning]', '2', '35', '=B5*C5'], ['Total before VAT', '', '', '=SUM(D2:D5)'], ['VAT 20%', '', '', '=D6*0.2'], ['Total', '', '', '=D6+D7']],
          fr: [['Travaux', 'Heures ou quantité', 'Tarif', 'Montant'], ['[Préparation]', '4', '45', '=B2*C2'], ['[Travaux principaux]', '12', '45', '=B3*C3'], ['[Fournitures]', '1', '380', '=B4*C4'], ['[Nettoyage]', '2', '35', '=B5*C5'], ['Total HT', '', '', '=SUM(D2:D5)'], ['TVA 20 %', '', '', '=D6*0.2'], ['Total TTC', '', '', '=D6+D7']],
        } },
      { app: 'letter', name: T('Quote letter', 'Lettre de devis'), purpose: T('Sends the quote, with its linked table.', 'Envoie le devis, avec son tableau relié.'), table: 0,
        lines: letter(
          ['<strong>Subject: quote no. [0001] for [work]</strong>', 'Dear [Client’s name],', 'Thank you for your request. Here is our quote for [work] at [address]:', TABLE_MARK, 'This quote is valid for 30 days. Work can start on [date] after your signed agreement.'],
          ['<strong>Objet : devis n° [0001] pour [travaux]</strong>', 'Madame, Monsieur,', 'Merci pour votre demande. Voici notre devis pour [travaux] au [adresse] :', TABLE_MARK, 'Ce devis est valable 30 jours. Les travaux peuvent commencer le [date] après votre accord signé.'],
        ) },
    ],
  },
  {
    id: 'complaint', icon: '📮',
    words: ['reclamation', 'plainte', 'complaint', 'queja', 'reclamacao', 'beschwerde', 'remboursement', 'refund', 'litige'],
    parts: [
      { app: 'letter', name: T('Complaint letter', 'Lettre de réclamation'), purpose: T('States the problem, what you ask for and by when.', 'Expose le problème, ce que vous demandez et sous quel délai.'),
        lines: letter(
          ['<strong>Subject: complaint about order no. [number]</strong>', 'Dear Sir or Madam,', 'On [date], I bought [product or service] for [amount]. Since [date], [describe the problem precisely].', 'Despite [my call / my email] of [date], the problem has not been solved.', 'I therefore ask you to [repair / replace / refund] within 15 days of receiving this letter. Please find enclosed a copy of the invoice.', 'Without an answer by then, I will refer the matter to [the consumer mediator].'],
          ['<strong>Objet : réclamation concernant la commande n° [numéro]</strong>', 'Madame, Monsieur,', 'Le [date], j’ai acheté [produit ou service] pour [montant]. Depuis le [date], [décrivez précisément le problème].', 'Malgré [mon appel / mon e-mail] du [date], le problème n’a pas été réglé.', 'Je vous demande donc de [réparer / remplacer / rembourser] dans un délai de 15 jours à réception de ce courrier. Vous trouverez ci-joint une copie de la facture.', 'Sans réponse de votre part dans ce délai, je saisirai [le médiateur de la consommation].'],
        ) },
      { app: 'pdf', name: T('Complaint (PDF)', 'Réclamation (PDF)'), purpose: T('To send by email or registered mail.', 'À envoyer par e-mail ou en recommandé.'), from: 0 },
    ],
  },
  {
    id: 'resignation', icon: '🚪',
    words: ['demission', 'resignation', 'resign', 'renuncia', 'demissao', 'kundigung', 'quitter', 'preavis'],
    parts: [
      { app: 'letter', name: T('Resignation letter', 'Lettre de démission'), purpose: T('Polite and clear, with the notice period.', 'Polie et claire, avec le préavis.'),
        lines: letter(
          ['<strong>Subject: resignation</strong>', 'Dear [Manager’s name],', 'I am writing to inform you of my decision to resign from my position as [job title], which I have held since [date].', 'In line with my contract, my notice period of [length] starts today, so my last working day will be [date].', 'I thank you for the trust you placed in me and for everything I learned at [company]. I will do my best to hand over my work in good conditions.'],
          ['<strong>Objet : démission</strong>', 'Madame, Monsieur,', 'Je vous informe par la présente de ma décision de démissionner du poste de [poste] que j’occupe depuis le [date].', 'Conformément à mon contrat, mon préavis de [durée] débute ce jour ; mon dernier jour de travail sera donc le [date].', 'Je vous remercie de la confiance accordée et de tout ce que j’ai appris chez [entreprise]. Je ferai le nécessaire pour transmettre mes dossiers dans de bonnes conditions.'],
        ) },
    ],
  },
  {
    id: 'minutes', icon: '📝',
    words: ['compte rendu', 'proces verbal', 'minutes', 'reunion', 'meeting', 'acta', 'reuniao', 'protokoll', 'sitzung'],
    parts: [
      { app: 'letter', name: T('Meeting minutes', 'Compte rendu de réunion'), purpose: T('Who came, what was decided, who does what.', 'Qui était là, ce qui a été décidé, qui fait quoi.'),
        lines: {
          en: [`<strong>Date:</strong> ${DATE} · <strong>Place:</strong> [Place]`, '<strong>Present:</strong> [Names] · <strong>Absent:</strong> [Names]', '## Agenda', '- [Topic 1]', '- [Topic 2]', '- [Topic 3]', '## Discussion', '[Main points of each topic, in a few sentences.]', '## Decisions', '- [Decision 1]', '- [Decision 2]', '## Actions', '- [Action] · [Who] · [By when]', '- [Action] · [Who] · [By when]', '## Next meeting', '[Date, time and place]'],
          fr: [`<strong>Date :</strong> ${DATE} · <strong>Lieu :</strong> [Lieu]`, '<strong>Présents :</strong> [Noms] · <strong>Absents :</strong> [Noms]', '## Ordre du jour', '- [Sujet 1]', '- [Sujet 2]', '- [Sujet 3]', '## Échanges', '[Points principaux de chaque sujet, en quelques phrases.]', '## Décisions', '- [Décision 1]', '- [Décision 2]', '## Actions', '- [Action] · [Qui] · [Pour quand]', '- [Action] · [Qui] · [Pour quand]', '## Prochaine réunion', '[Date, heure et lieu]'],
        } },
    ],
  },
  {
    id: 'businessPlan', icon: '🚀',
    words: ['business plan', 'plan d affaires', 'entreprise', 'startup', 'creer', 'company', 'negocio', 'empresa', 'geschaftsplan', 'investisseur', 'investor'],
    parts: [
      { app: 'class', name: T('3-year forecast', 'Prévisionnel sur 3 ans'), purpose: T('Sales, costs and profit for three years.', 'Ventes, charges et résultat sur trois ans.'),
        rows: {
          en: [['', 'Year 1', 'Year 2', 'Year 3'], ['Sales', '60000', '95000', '140000'], ['Purchases', '18000', '28000', '40000'], ['Salaries', '24000', '36000', '52000'], ['Rent and fees', '9000', '9500', '10000'], ['Marketing', '4000', '6000', '8000'], ['Total costs', '=SUM(B3:B6)', '=SUM(C3:C6)', '=SUM(D3:D6)'], ['Profit', '=B2-B7', '=C2-C7', '=D2-D7']],
          fr: [['', 'Année 1', 'Année 2', 'Année 3'], ['Chiffre d’affaires', '60000', '95000', '140000'], ['Achats', '18000', '28000', '40000'], ['Salaires', '24000', '36000', '52000'], ['Loyer et frais', '9000', '9500', '10000'], ['Marketing', '4000', '6000', '8000'], ['Total des charges', '=SUM(B3:B6)', '=SUM(C3:C6)', '=SUM(D3:D6)'], ['Résultat', '=B2-B7', '=C2-C7', '=D2-D7']],
        } },
      { app: 'letter', name: T('Business plan', 'Business plan'), purpose: T('The project in writing, with the linked forecast.', 'Le projet par écrit, avec le prévisionnel relié.'), table: 0,
        lines: {
          en: ['## The project', '[What you sell, to whom, and why now.]', '## The market', '[Size of the market, customers, competitors and what makes you different.]', '## Strategy', '- [How you find customers]', '- [Prices]', '- [Partners]', '## Team', '[Who does what, and their experience.]', '## Financial forecast', TABLE_MARK, '## Needs', '[Amount needed and what it pays for.]'],
          fr: ['## Le projet', '[Ce que vous vendez, à qui, et pourquoi maintenant.]', '## Le marché', '[Taille du marché, clients, concurrents et ce qui vous distingue.]', '## Stratégie', '- [Comment trouver vos clients]', '- [Prix]', '- [Partenaires]', '## Équipe', '[Qui fait quoi, et son expérience.]', '## Prévisionnel', TABLE_MARK, '## Besoins', '[Montant nécessaire et à quoi il sert.]'],
        } },
      { app: 'stage', name: T('Pitch', 'Présentation investisseurs'), purpose: T('Six slides to present the project, with the forecast.', 'Six diapositives pour présenter le projet, avec le prévisionnel.'), table: 0,
        lines: {
          en: ['## The problem', '- [What people struggle with]', '- [How many of them]', '## Our solution', '- [What you offer]', '- [Why it is better]', '## The market', '- [Size]', '- [Customers]', '## How we make money', '- [Prices]', '- [Channels]', '## The team', '- [Name, role]', '- [Name, role]', '## What we ask', '- [Amount]', '- [What it pays for]'],
          fr: ['## Le problème', '- [Ce qui gêne les gens]', '- [Combien sont concernés]', '## Notre solution', '- [Ce que vous proposez]', '- [Pourquoi c’est mieux]', '## Le marché', '- [Taille]', '- [Clients]', '## Comment nous gagnons de l’argent', '- [Prix]', '- [Canaux]', '## L’équipe', '- [Nom, rôle]', '- [Nom, rôle]', '## Ce que nous demandons', '- [Montant]', '- [À quoi il sert]'],
        } },
    ],
  },
  {
    id: 'projectDeck', icon: '🎤',
    words: ['presentation', 'diaporama', 'slides', 'powerpoint', 'exposer', 'presentacion', 'apresentacao', 'prasentation', 'projet', 'project'],
    parts: [
      { app: 'stage', name: T('Project presentation', 'Présentation du projet'), purpose: T('Seven slides: context, goal, plan, budget, risks, next steps.', 'Sept diapositives : contexte, objectif, plan, budget, risques, suite.'),
        lines: {
          en: ['## Context', '- [Where we are today]', '- [Why it matters]', '## Goal', '- [What we want to reach]', '- [By when]', '## Plan', '- [Step 1]', '- [Step 2]', '- [Step 3]', '## Team', '- [Who does what]', '## Budget', '- [Main costs]', '- [Total]', '## Risks', '- [Risk and how we handle it]', '## Next steps', '- [Decision needed today]', '- [Next date]'],
          fr: ['## Contexte', '- [Où nous en sommes]', '- [Pourquoi c’est important]', '## Objectif', '- [Ce que nous voulons atteindre]', '- [Pour quand]', '## Plan', '- [Étape 1]', '- [Étape 2]', '- [Étape 3]', '## Équipe', '- [Qui fait quoi]', '## Budget', '- [Principaux coûts]', '- [Total]', '## Risques', '- [Risque et parade]', '## Suite', '- [Décision attendue aujourd’hui]', '- [Prochaine date]'],
        } },
    ],
  },
  {
    id: 'party', icon: '🎉',
    words: ['fete', 'party', 'fiesta', 'festa', 'anniversaire', 'birthday', 'mariage', 'wedding', 'evenement', 'event', 'invitation', 'feier'],
    parts: [
      { app: 'class', name: T('Party plan', 'Organisation de la fête'), purpose: T('Tasks, who does them and the budget.', 'Tâches, qui s’en charge et le budget.'),
        rows: {
          en: [['Task', 'Who', 'Deadline', 'Cost', 'Done'], ['Book the place', '[Name]', '[Date]', '300', 'No'], ['Send invitations', '[Name]', '[Date]', '0', 'No'], ['Food and drinks', '[Name]', '[Date]', '450', 'No'], ['Cake', '[Name]', '[Date]', '60', 'No'], ['Decoration', '[Name]', '[Date]', '80', 'No'], ['Music', '[Name]', '[Date]', '100', 'No'], ['Total', '', '', '=SUM(D2:D7)', '']],
          fr: [['Tâche', 'Qui', 'Pour le', 'Coût', 'Fait'], ['Réserver la salle', '[Nom]', '[Date]', '300', 'Non'], ['Envoyer les invitations', '[Nom]', '[Date]', '0', 'Non'], ['Repas et boissons', '[Nom]', '[Date]', '450', 'Non'], ['Gâteau', '[Nom]', '[Date]', '60', 'Non'], ['Décoration', '[Nom]', '[Date]', '80', 'Non'], ['Musique', '[Nom]', '[Date]', '100', 'Non'], ['Total', '', '', '=SUM(D2:D7)', '']],
        } },
      { app: 'letter', name: T('Invitation', 'Invitation'), purpose: T('The card to send to the guests.', 'Le carton à envoyer aux invités.'),
        lines: {
          en: ['## You are invited!', 'Come and celebrate [occasion] with us.', `<strong>When:</strong> ${DATE}, from [time]`, '<strong>Where:</strong> [Place and address]', 'Please let us know if you can come before [date]: [phone or email].', 'We look forward to seeing you!', '[Your names]'],
          fr: ['## Vous êtes invités !', 'Venez fêter [l’occasion] avec nous.', `<strong>Quand :</strong> le ${DATE}, à partir de [heure]`, '<strong>Où :</strong> [Lieu et adresse]', 'Merci de nous dire si vous venez avant le [date] : [téléphone ou e-mail].', 'Nous avons hâte de vous voir !', '[Vos prénoms]'],
        } },
    ],
  },
  {
    id: 'trip', icon: '✈️',
    words: ['voyage', 'trip', 'travel', 'viaje', 'viagem', 'reise', 'vacances', 'holiday', 'vacaciones', 'ferias', 'urlaub', 'itineraire'],
    parts: [
      { app: 'class', name: T('Trip budget', 'Budget du voyage'), purpose: T('Costs per item and per person.', 'Coûts par poste et par personne.'),
        rows: {
          en: [['Item', 'Cost', 'People', 'Per person'], ['Flights or train', '600', '2', '=B2/C2'], ['Accommodation', '700', '2', '=B3/C3'], ['Food', '350', '2', '=B4/C4'], ['Visits', '150', '2', '=B5/C5'], ['Local transport', '80', '2', '=B6/C6'], ['Total', '=SUM(B2:B6)', '', '=SUM(D2:D6)']],
          fr: [['Poste', 'Coût', 'Personnes', 'Par personne'], ['Avion ou train', '600', '2', '=B2/C2'], ['Hébergement', '700', '2', '=B3/C3'], ['Repas', '350', '2', '=B4/C4'], ['Visites', '150', '2', '=B5/C5'], ['Transports sur place', '80', '2', '=B6/C6'], ['Total', '=SUM(B2:B6)', '', '=SUM(D2:D6)']],
        } },
      { app: 'letter', name: T('Itinerary', 'Programme du voyage'), purpose: T('Day by day, with the linked budget.', 'Jour par jour, avec le budget relié.'), table: 0,
        lines: {
          en: ['## Day 1 · [City]', '- Arrival at [time], check in at [hotel]', '- Evening: [restaurant or walk]', '## Day 2 · [City]', '- Morning: [visit]', '- Afternoon: [visit]', '## Day 3 · [City]', '- [Visits]', '- Departure at [time]', '## Budget', TABLE_MARK, '## To bring', '- Passport or ID, tickets, chargers, medicines'],
          fr: ['## Jour 1 · [Ville]', '- Arrivée à [heure], installation à [hôtel]', '- Soir : [restaurant ou balade]', '## Jour 2 · [Ville]', '- Matin : [visite]', '- Après-midi : [visite]', '## Jour 3 · [Ville]', '- [Visites]', '- Départ à [heure]', '## Budget', TABLE_MARK, '## À emporter', '- Passeport ou carte d’identité, billets, chargeurs, médicaments'],
        } },
    ],
  },
  {
    id: 'meals', icon: '🥗',
    words: ['repas', 'menu', 'meal', 'courses', 'shopping', 'comida', 'refeicao', 'essen', 'einkauf', 'cuisine', 'semaine', 'week'],
    parts: [
      { app: 'class', name: T('Weekly meals', 'Menus de la semaine'), purpose: T('Lunch and dinner for seven days, and the shopping budget.', 'Déjeuner et dîner sur sept jours, et le budget des courses.'),
        rows: {
          en: [['Day', 'Lunch', 'Dinner', 'Shopping cost'], ['Monday', 'Chicken salad', 'Vegetable soup', '12'], ['Tuesday', 'Pasta with tomato', 'Omelette', '9'], ['Wednesday', 'Rice and beans', 'Fish and vegetables', '14'], ['Thursday', 'Couscous', 'Quiche', '11'], ['Friday', 'Tuna sandwich', 'Homemade pizza', '10'], ['Saturday', 'Grilled meat', 'Salad and cheese', '16'], ['Sunday', 'Roast chicken', 'Soup', '15'], ['Week', '', '', '=SUM(D2:D8)']],
          fr: [['Jour', 'Déjeuner', 'Dîner', 'Coût des courses'], ['Lundi', 'Salade de poulet', 'Soupe de légumes', '12'], ['Mardi', 'Pâtes à la tomate', 'Omelette', '9'], ['Mercredi', 'Riz et haricots', 'Poisson et légumes', '14'], ['Jeudi', 'Couscous', 'Quiche', '11'], ['Vendredi', 'Sandwich au thon', 'Pizza maison', '10'], ['Samedi', 'Grillades', 'Salade et fromage', '16'], ['Dimanche', 'Poulet rôti', 'Soupe', '15'], ['Semaine', '', '', '=SUM(D2:D8)']],
        } },
    ],
  },
  {
    id: 'schoolReport', icon: '🎓',
    words: ['expose', 'ecole', 'school', 'escuela', 'escola', 'schule', 'devoir', 'homework', 'dossier', 'memoire', 'rapport scolaire'],
    parts: [
      { app: 'letter', name: T('School report', 'Exposé'), purpose: T('Introduction, three parts and a conclusion.', 'Introduction, trois parties et une conclusion.'),
        lines: {
          en: ['## Introduction', '[Present the subject and the question you answer.]', '## 1. [First part]', '[Facts and examples.]', '## 2. [Second part]', '[Facts and examples.]', '## 3. [Third part]', '[Facts and examples.]', '## Conclusion', '[Your answer to the question, and an opening.]', '## Sources', '- [Book or website]'],
          fr: ['## Introduction', '[Présentez le sujet et la question à laquelle vous répondez.]', '## 1. [Première partie]', '[Faits et exemples.]', '## 2. [Deuxième partie]', '[Faits et exemples.]', '## 3. [Troisième partie]', '[Faits et exemples.]', '## Conclusion', '[Votre réponse à la question, et une ouverture.]', '## Sources', '- [Livre ou site]'],
        } },
      { app: 'stage', name: T('Slides for the talk', 'Diapositives de l’oral'), purpose: T('The same plan, to present in class.', 'Le même plan, pour présenter en classe.'),
        lines: {
          en: ['## [Subject]', '- [Your name], [class]', '## The question', '- [Question]', '## 1. [First part]', '- [Key point]', '## 2. [Second part]', '- [Key point]', '## 3. [Third part]', '- [Key point]', '## Conclusion', '- [Answer]'],
          fr: ['## [Sujet]', '- [Votre nom], [classe]', '## La question', '- [Question]', '## 1. [Première partie]', '- [Idée clé]', '## 2. [Deuxième partie]', '- [Idée clé]', '## 3. [Troisième partie]', '- [Idée clé]', '## Conclusion', '- [Réponse]'],
        } },
    ],
  },
  {
    id: 'website', icon: '🌐',
    words: ['site', 'website', 'web', 'page', 'sitio', 'webseite', 'html', 'internet', 'vitrine', 'landing'],
    parts: [
      { app: 'code', name: T('My website', 'Mon site web'), purpose: T('A one-page site: header, services, contact.', 'Un site d’une page : en-tête, services, contact.'),
        files: lang => site(lang) },
    ],
  },
  {
    id: 'sales', icon: '📈',
    words: ['ventes', 'sales', 'chiffre', 'ventas', 'vendas', 'umsatz', 'verkauf', 'rapport', 'report', 'trimestre', 'quarter'],
    parts: [
      { app: 'class', name: T('Sales report', 'Rapport des ventes'), purpose: T('Sales per month against the target.', 'Ventes par mois face à l’objectif.'),
        rows: {
          en: [['Month', 'Sales', 'Target', 'Gap', 'Reached'], ['January', '12500', '12000', '=B2-C2', '=B2/C2'], ['February', '11800', '12000', '=B3-C3', '=B3/C3'], ['March', '14200', '13000', '=B4-C4', '=B4/C4'], ['April', '13900', '13000', '=B5-C5', '=B5/C5'], ['May', '15100', '14000', '=B6-C6', '=B6/C6'], ['June', '16300', '14000', '=B7-C7', '=B7/C7'], ['Total', '=SUM(B2:B7)', '=SUM(C2:C7)', '=B8-C8', '=B8/C8']],
          fr: [['Mois', 'Ventes', 'Objectif', 'Écart', 'Atteint'], ['Janvier', '12500', '12000', '=B2-C2', '=B2/C2'], ['Février', '11800', '12000', '=B3-C3', '=B3/C3'], ['Mars', '14200', '13000', '=B4-C4', '=B4/C4'], ['Avril', '13900', '13000', '=B5-C5', '=B5/C5'], ['Mai', '15100', '14000', '=B6-C6', '=B6/C6'], ['Juin', '16300', '14000', '=B7-C7', '=B7/C7'], ['Total', '=SUM(B2:B7)', '=SUM(C2:C7)', '=B8-C8', '=B8/C8']],
        } },
      { app: 'stage', name: T('Sales review', 'Revue des ventes'), purpose: T('Results, the table and the next goals.', 'Résultats, le tableau et les prochains objectifs.'), table: 0,
        lines: {
          en: ['## Results of the half-year', '- Sales above target in 5 months out of 6', '- Best month: June', '## What worked', '- [Action 1]', '- [Action 2]', '## Next goals', '- [Goal for the next half-year]', '- [Actions planned]'],
          fr: ['## Résultats du semestre', '- Ventes au-dessus de l’objectif 5 mois sur 6', '- Meilleur mois : juin', '## Ce qui a marché', '- [Action 1]', '- [Action 2]', '## Prochains objectifs', '- [Objectif du semestre suivant]', '- [Actions prévues]'],
        } },
    ],
  },
  {
    id: 'landlord', icon: '🏠',
    words: ['loyer', 'rent', 'proprietaire', 'landlord', 'locataire', 'tenant', 'alquiler', 'aluguel', 'miete', 'vermieter', 'caution', 'deposit'],
    parts: [
      { app: 'class', name: T('Rent payments', 'Paiements du loyer'), purpose: T('Each month paid, with the date and the total.', 'Chaque mois payé, avec la date et le total.'),
        rows: {
          en: [['Month', 'Rent', 'Charges', 'Paid on', 'Total'], ['January', '750', '60', '[Date]', '=B2+C2'], ['February', '750', '60', '[Date]', '=B3+C3'], ['March', '750', '60', '[Date]', '=B4+C4'], ['April', '750', '60', '[Date]', '=B5+C5'], ['Total', '=SUM(B2:B5)', '=SUM(C2:C5)', '', '=SUM(E2:E5)']],
          fr: [['Mois', 'Loyer', 'Charges', 'Payé le', 'Total'], ['Janvier', '750', '60', '[Date]', '=B2+C2'], ['Février', '750', '60', '[Date]', '=B3+C3'], ['Mars', '750', '60', '[Date]', '=B4+C4'], ['Avril', '750', '60', '[Date]', '=B5+C5'], ['Total', '=SUM(B2:B5)', '=SUM(C2:C5)', '', '=SUM(E2:E5)']],
        } },
      { app: 'letter', name: T('Letter to the landlord', 'Courrier au propriétaire'), purpose: T('Asks for the receipts, with the linked payment table.', 'Demande les quittances, avec le tableau des paiements relié.'), table: 0,
        lines: letter(
          ['<strong>Subject: rent receipts for [address]</strong>', 'Dear [Landlord’s name],', 'I rent the home at [address] since [date]. Here are the payments I have made:', TABLE_MARK, 'Could you please send me the rent receipts for these months? Thank you in advance.'],
          ['<strong>Objet : quittances de loyer pour le [adresse]</strong>', 'Madame, Monsieur,', 'Je loue le logement situé au [adresse] depuis le [date]. Voici les paiements que j’ai effectués :', TABLE_MARK, 'Pourriez-vous m’adresser les quittances de loyer correspondantes ? Je vous en remercie par avance.'],
        ) },
    ],
  },
  {
    id: 'loan', icon: '💶',
    words: ['emprunt', 'loan', 'mensualite', 'prestamo', 'emprestimo', 'kredit', 'darlehen', 'immobilier', 'mortgage', 'remboursement'],
    parts: [
      { app: 'class', name: T('Loan repayments', 'Remboursement du prêt'), purpose: T('Amount, rate, length and the monthly payment.', 'Montant, taux, durée et la mensualité.'),
        rows: {
          en: [['', 'Value'], ['Amount borrowed', '150000'], ['Yearly rate', '0.035'], ['Years', '20'], ['Monthly payment', '=PMT(B3/12,B4*12,-B2)'], ['Total repaid', '=B5*B4*12'], ['Cost of the loan', '=B6-B2']],
          fr: [['', 'Valeur'], ['Montant emprunté', '150000'], ['Taux annuel', '0.035'], ['Durée en années', '20'], ['Mensualité', '=PMT(B3/12,B4*12,-B2)'], ['Total remboursé', '=B5*B4*12'], ['Coût du crédit', '=B6-B2']],
        } },
      { app: 'letter', name: T('Loan request', 'Demande de prêt'), purpose: T('Asks the bank, with the linked figures.', 'Sollicite la banque, avec les chiffres reliés.'), table: 0,
        lines: letter(
          ['<strong>Subject: loan request</strong>', 'Dear [Adviser’s name],', 'I would like to borrow to finance [project]. Here are the figures I have in mind:', TABLE_MARK, 'My monthly income is [amount] and my current loans come to [amount] per month. I would be glad to meet you to study this request.'],
          ['<strong>Objet : demande de prêt</strong>', 'Madame, Monsieur,', 'Je souhaite emprunter pour financer [projet]. Voici les chiffres que j’envisage :', TABLE_MARK, 'Mes revenus mensuels sont de [montant] et mes crédits en cours s’élèvent à [montant] par mois. Je serais heureux de vous rencontrer pour étudier cette demande.'],
        ) },
    ],
  },
  {
    id: 'timetable', icon: '📅',
    words: ['emploi du temps', 'planning', 'timetable', 'schedule', 'horario', 'stundenplan', 'revisions', 'study', 'etudier', 'agenda'],
    parts: [
      { app: 'class', name: T('Weekly timetable', 'Emploi du temps'), purpose: T('Hours and days, to fill in.', 'Heures et jours, à remplir.'),
        rows: {
          en: [['Time', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], ['8:00', '', '', '', '', '', ''], ['9:00', '', '', '', '', '', ''], ['10:00', '', '', '', '', '', ''], ['11:00', '', '', '', '', '', ''], ['12:00', 'Lunch', 'Lunch', 'Lunch', 'Lunch', 'Lunch', ''], ['14:00', '', '', '', '', '', ''], ['15:00', '', '', '', '', '', ''], ['16:00', '', '', '', '', '', ''], ['17:00', '', '', '', '', '', '']],
          fr: [['Heure', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'], ['8 h', '', '', '', '', '', ''], ['9 h', '', '', '', '', '', ''], ['10 h', '', '', '', '', '', ''], ['11 h', '', '', '', '', '', ''], ['12 h', 'Déjeuner', 'Déjeuner', 'Déjeuner', 'Déjeuner', 'Déjeuner', ''], ['14 h', '', '', '', '', '', ''], ['15 h', '', '', '', '', '', ''], ['16 h', '', '', '', '', '', ''], ['17 h', '', '', '', '', '', '']],
        } },
    ],
  },
  {
    id: 'launch', icon: '📣',
    words: ['lancement', 'launch', 'produit', 'product', 'communique', 'press', 'lanzamiento', 'lancamento', 'produkt', 'pressemitteilung'],
    parts: [
      { app: 'letter', name: T('Press release', 'Communiqué de presse'), purpose: T('Announces the product in one page.', 'Annonce le produit en une page.'),
        lines: {
          en: [`<strong>For immediate release</strong> · ${DATE}`, '## [Company] launches [product], [what it does in a few words]', '[City] – [Company] today announces [product], which helps [customers] to [benefit].', '[Product] offers:', '- [Feature 1]', '- [Feature 2]', '- [Feature 3]', '“[Quote from the founder]”, says [name], [role] of [company].', '[Product] is available from [date] at [price] on [website].', '<strong>Press contact:</strong> [name] · [phone] · [email]'],
          fr: [`<strong>Communiqué de presse</strong> · ${DATE}`, '## [Entreprise] lance [produit], [ce qu’il fait en quelques mots]', '[Ville] – [Entreprise] annonce aujourd’hui [produit], qui permet à [clients] de [bénéfice].', '[Produit] propose :', '- [Fonction 1]', '- [Fonction 2]', '- [Fonction 3]', '« [Citation du fondateur] », déclare [nom], [fonction] de [entreprise].', '[Produit] est disponible dès le [date] au prix de [prix] sur [site].', '<strong>Contact presse :</strong> [nom] · [téléphone] · [e-mail]'],
        } },
      { app: 'stage', name: T('Launch deck', 'Présentation du lancement'), purpose: T('Five slides for the launch event.', 'Cinq diapositives pour l’événement de lancement.'),
        lines: {
          en: ['## [Product]', '- [Tagline]', '## The need', '- [Problem]', '## What it does', '- [Feature 1]', '- [Feature 2]', '## Price and availability', '- [Price]', '- [Date]', '## Thank you', '- [Website] · [Contact]'],
          fr: ['## [Produit]', '- [Accroche]', '## Le besoin', '- [Problème]', '## Ce qu’il fait', '- [Fonction 1]', '- [Fonction 2]', '## Prix et disponibilité', '- [Prix]', '- [Date]', '## Merci', '- [Site] · [Contact]'],
        } },
    ],
  },
  {
    id: 'shopSite', icon: '🛍️',
    words: ['boutique', 'shop', 'store', 'tienda', 'loja', 'laden', 'commerce', 'catalogue', 'vendre en ligne'],
    parts: [
      { app: 'code', name: T('Shop page', 'Page de la boutique'), purpose: T('A page with products, prices and contact.', 'Une page avec produits, prix et contact.'), files: lang => site(lang, true) },
      { app: 'letter', name: T('Flyer text', 'Texte du prospectus'), purpose: T('To print and hand out.', 'À imprimer et distribuer.'),
        lines: {
          en: ['## [Shop name] is open!', '[What you sell] in [city], at fair prices.', '- [Product 1] · [price]', '- [Product 2] · [price]', '- [Product 3] · [price]', '<strong>Opening offer:</strong> [10%] off until [date].', '[Address] · [Opening hours] · [Website]'],
          fr: ['## [Nom de la boutique] ouvre !', '[Ce que vous vendez] à [ville], à prix justes.', '- [Produit 1] · [prix]', '- [Produit 2] · [prix]', '- [Produit 3] · [prix]', '<strong>Offre d’ouverture :</strong> [10 %] de remise jusqu’au [date].', '[Adresse] · [Horaires] · [Site]'],
        } },
    ],
  },
  {
    id: 'inventory', icon: '📦',
    words: ['inventaire', 'inventory', 'stock', 'inventario', 'estoque', 'lager', 'bestand', 'articles', 'items'],
    parts: [
      { app: 'class', name: T('Inventory', 'Inventaire'), purpose: T('Items, stock, value and what to reorder.', 'Articles, stock, valeur et quoi recommander.'),
        rows: {
          en: [['Item', 'In stock', 'Minimum', 'Unit cost', 'Value', 'Reorder'], ['[Item 1]', '40', '20', '3.5', '=B2*D2', '=IF(B2<C2,"Yes","No")'], ['[Item 2]', '12', '15', '8', '=B3*D3', '=IF(B3<C3,"Yes","No")'], ['[Item 3]', '75', '30', '1.2', '=B4*D4', '=IF(B4<C4,"Yes","No")'], ['[Item 4]', '5', '10', '25', '=B5*D5', '=IF(B5<C5,"Yes","No")'], ['[Item 5]', '22', '10', '6', '=B6*D6', '=IF(B6<C6,"Yes","No")'], ['Total', '=SUM(B2:B6)', '', '', '=SUM(E2:E6)', '=COUNTIF(F2:F6,"Yes")']],
          fr: [['Article', 'En stock', 'Minimum', 'Coût unitaire', 'Valeur', 'À recommander'], ['[Article 1]', '40', '20', '3.5', '=B2*D2', '=IF(B2<C2,"Oui","Non")'], ['[Article 2]', '12', '15', '8', '=B3*D3', '=IF(B3<C3,"Oui","Non")'], ['[Article 3]', '75', '30', '1.2', '=B4*D4', '=IF(B4<C4,"Oui","Non")'], ['[Article 4]', '5', '10', '25', '=B5*D5', '=IF(B5<C5,"Oui","Non")'], ['[Article 5]', '22', '10', '6', '=B6*D6', '=IF(B6<C6,"Oui","Non")'], ['Total', '=SUM(B2:B6)', '', '', '=SUM(E2:E6)', '=COUNTIF(F2:F6,"Oui")']],
        } },
    ],
  },
  {
    id: 'thanks', icon: '💌',
    words: ['merci', 'thanks', 'thank you', 'gracias', 'obrigado', 'danke', 'carte', 'card', 'voeux', 'greeting', 'remerciement'],
    parts: [
      { app: 'letter', name: T('Thank-you card', 'Carte de remerciement'), purpose: T('A warm short message.', 'Un court message chaleureux.'),
        lines: {
          en: ['## Thank you!', 'Dear [Name],', 'Thank you so much for [what they did]. It meant a lot to me, and [how it helped].', 'I hope to see you soon to thank you in person.', 'With all my gratitude,', '[Your name]'],
          fr: ['## Merci !', 'Cher [Prénom],', 'Merci infiniment pour [ce qu’il a fait]. Cela m’a beaucoup touché, et [en quoi cela a aidé].', 'J’espère te revoir bientôt pour te remercier de vive voix.', 'Avec toute ma gratitude,', '[Votre prénom]'],
        } },
    ],
  },
  {
    id: 'association', icon: '🤝',
    words: ['association', 'club', 'assemblee generale', 'adherents', 'members', 'cotisation', 'asociacion', 'associacao', 'verein', 'benevoles'],
    parts: [
      { app: 'class', name: T('Club accounts', 'Comptes de l’association'), purpose: T('Income, spending and the balance of the year.', 'Recettes, dépenses et solde de l’année.'),
        rows: {
          en: [['Line', 'Income', 'Spending'], ['Membership fees', '2400', ''], ['Grants', '1500', ''], ['Events', '900', ''], ['Equipment', '', '1200'], ['Insurance', '', '350'], ['Events costs', '', '700'], ['Total', '=SUM(B2:B7)', '=SUM(C2:C7)'], ['Balance', '=B8-C8', '']],
          fr: [['Ligne', 'Recettes', 'Dépenses'], ['Cotisations', '2400', ''], ['Subventions', '1500', ''], ['Événements', '900', ''], ['Matériel', '', '1200'], ['Assurance', '', '350'], ['Frais des événements', '', '700'], ['Total', '=SUM(B2:B7)', '=SUM(C2:C7)'], ['Solde', '=B8-C8', '']],
        } },
      { app: 'letter', name: T('General meeting notice', 'Convocation à l’assemblée générale'), purpose: T('Invites the members, with the linked accounts.', 'Convoque les adhérents, avec les comptes reliés.'), table: 0,
        lines: {
          en: ['Dear members,', `You are invited to the general meeting of [club] on ${DATE} at [time], at [place].`, '## Agenda', '- Report of the year', '- Accounts (below)', '- Election of the board', '- Questions', TABLE_MARK, 'If you cannot come, you can give your proxy to another member.', '[Name], President'],
          fr: ['Chers adhérents,', `Vous êtes conviés à l’assemblée générale de [association] le ${DATE} à [heure], à [lieu].`, '## Ordre du jour', '- Rapport moral de l’année', '- Comptes (ci-dessous)', '- Élection du bureau', '- Questions diverses', TABLE_MARK, 'Si vous ne pouvez pas venir, vous pouvez donner pouvoir à un autre adhérent.', '[Nom], Président'],
        } },
      { app: 'stage', name: T('Year in review', 'Bilan de l’année'), purpose: T('Slides for the meeting, with the accounts.', 'Diapositives pour l’assemblée, avec les comptes.'), table: 0,
        lines: {
          en: ['## Our year', '- [n] members', '- [n] events', '## Highlights', '- [Event 1]', '- [Event 2]', '## Next year', '- [Project 1]', '- [Project 2]'],
          fr: ['## Notre année', '- [n] adhérents', '- [n] événements', '## Temps forts', '- [Événement 1]', '- [Événement 2]', '## L’an prochain', '- [Projet 1]', '- [Projet 2]'],
        } },
    ],
  },
  {
    id: 'adminLetter', icon: '🏛️',
    words: ['administration', 'mairie', 'prefecture', 'impots', 'tax', 'caf', 'demande', 'request', 'solicitud', 'requerimento', 'antrag', 'attestation'],
    parts: [
      { app: 'letter', name: T('Letter to an administration', 'Courrier à l’administration'), purpose: T('A formal request with the references.', 'Une demande formelle avec les références.'),
        lines: letter(
          ['<strong>Subject: request for [document or action]</strong><br>Reference: [file number]', 'Dear Sir or Madam,', 'I would like to request [document or action] for the following reason: [reason].', 'Please find enclosed: [list of documents].', 'Thank you for processing my request. I remain available on [phone] for any question.'],
          ['<strong>Objet : demande de [document ou démarche]</strong><br>Référence : [numéro de dossier]', 'Madame, Monsieur,', 'Je souhaite obtenir [document ou démarche] pour la raison suivante : [motif].', 'Vous trouverez ci-joint : [liste des pièces].', 'Je vous remercie de bien vouloir traiter ma demande et reste joignable au [téléphone] pour toute question.'],
        ) },
      { app: 'pdf', name: T('Request (PDF)', 'Demande (PDF)'), purpose: T('To send online or print.', 'À envoyer en ligne ou à imprimer.'), from: 0 },
    ],
  },
];

/** A small one-page site for the Code+ recipes. */
function site(lang: RecipeLang, shop = false): Record<string, string> {
  const fr = lang === 'fr';
  const items = shop
    ? (fr ? [['[Produit 1]', '19 €'], ['[Produit 2]', '29 €'], ['[Produit 3]', '39 €']] : [['[Product 1]', '$19'], ['[Product 2]', '$29'], ['[Product 3]', '$39']])
    : (fr ? [['[Service 1]', '[Ce que vous faites]'], ['[Service 2]', '[Ce que vous faites]'], ['[Service 3]', '[Ce que vous faites]']] : [['[Service 1]', '[What you do]'], ['[Service 2]', '[What you do]'], ['[Service 3]', '[What you do]']]);
  const html = `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${fr ? '[Votre nom]' : '[Your name]'}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header>
    <h1>${fr ? '[Votre nom ou entreprise]' : '[Your name or company]'}</h1>
    <p>${fr ? '[Ce que vous proposez, en une phrase]' : '[What you offer, in one sentence]'}</p>
    <a class="cta" href="#contact">${fr ? 'Me contacter' : 'Contact me'}</a>
  </header>
  <main>
    <h2>${shop ? (fr ? 'Nos produits' : 'Our products') : (fr ? 'Services' : 'Services')}</h2>
    <div class="cards">
${items.map(([a, b]) => `      <article><h3>${a}</h3><p>${b}</p></article>`).join('\n')}
    </div>
    <h2 id="contact">Contact</h2>
    <p>${fr ? '[E-mail] · [Téléphone] · [Adresse]' : '[Email] · [Phone] · [Address]'}</p>
  </main>
  <footer>© <span id="year"></span></footer>
  <script src="script.js"></script>
</body>
</html>
`;
  const css = `* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; color: #1b1b1f; line-height: 1.6; }
header { padding: 64px 20px; text-align: center; color: #fff; background: linear-gradient(135deg, #7b4fd0, #d4a843); }
header h1 { margin: 0 0 8px; font-size: clamp(28px, 6vw, 48px); }
.cta { display: inline-block; margin-top: 16px; padding: 10px 22px; border-radius: 99px; background: #fff; color: #7b4fd0; font-weight: 700; text-decoration: none; }
main { max-width: 960px; margin: 0 auto; padding: 32px 20px; }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; }
article { padding: 18px; border-radius: 14px; background: #f6f3ec; }
footer { padding: 24px; text-align: center; color: #777; }
`;
  return { 'index.html': html, 'style.css': css, 'script.js': `document.getElementById('year').textContent = new Date().getFullYear();\n` };
}

// ---------- recipes as plans ----------

/** The HTML of recipe lines. */
export function linesHtml(lines: string[]): string {
  let out = '', list = false;
  for (const l of lines) {
    if (l.startsWith('- ')) { if (!list) { out += '<ul>'; list = true; } out += `<li>${l.slice(2)}</li>`; continue; }
    if (list) { out += '</ul>'; list = false; }
    out += l.startsWith('## ') ? `<h2>${l.slice(3)}</h2>` : `<p>${l}</p>`;
  }
  return list ? `${out}</ul>` : out;
}

export function recipePlan(r: Recipe, lang: RecipeLang, title: string): Plan {
  const ids = r.parts.map(() => stepId());
  const steps: Step[] = r.parts.map((p, i) => ({
    id: ids[i], app: p.app, name: p.name[lang], purpose: p.purpose[lang], on: true,
    html: p.lines ? linesHtml(p.lines[lang]) : '',
    rows: p.rows ? p.rows[lang].map(row => [...row]) : [],
    files: p.files ? Object.entries(p.files(lang)).map(([path, content]) => ({ path, content })) : [],
    table: p.table != null ? ids[p.table] : null,
    from: p.from != null ? ids[p.from] : null,
  }));
  return { title, summary: '', steps };
}

/** Lowercase, no accents, no punctuation (same as the "Je veux…" search). */
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** The recipe that best matches what the person wrote, or null when none does. */
export function matchRecipe(task: string, titles: Record<string, string> = {}): Recipe | null {
  const q = ` ${norm(task)} `;
  let best: Recipe | null = null, score = 0;
  for (const r of RECIPES) {
    let s = 0;
    for (const w of r.words) if (q.includes(` ${norm(w)} `) || (norm(w).length > 4 && q.includes(norm(w)))) s += norm(w).includes(' ') ? 3 : 2;
    for (const w of norm(titles[r.id] ?? '').split(' ')) if (w.length > 3 && q.includes(` ${w} `)) s += 1;
    if (s > score) { score = s; best = r; }
  }
  return score >= 2 ? best : null;
}
