// Twenty CV templates for the Doc adm/Mil tab: civilian, public service and military, in French and English.
// Each one is a Letter theme plus a choice and order of sections, written in the same markup as the letters.

import type { LetterTemplate } from './letters';

type Lang = 'fr' | 'en';
type Section =
  | 'profile' | 'experience' | 'education' | 'skills' | 'languages' | 'certifications' | 'volunteer' | 'interests'
  | 'references' | 'service' | 'clearance' | 'milQuals' | 'awards' | 'deployments' | 'transferable' | 'merit'
  | 'officialLanguages' | 'projects' | 'publications' | 'leadership' | 'achievements' | 'portfolio' | 'licences' | 'tools';

const HEAD: Record<Lang, (title: string) => string> = {
  fr: title => `# [Prénom Nom]
~ ${title}
[Ville, province] · [Téléphone] · [Courriel] · [LinkedIn ou site]
`,
  en: title => `# [First and last name]
~ ${title}
[City, province] · [Phone] · [Email] · [LinkedIn or website]
`,
};

const JOB = {
  fr: `! [Poste] · [Employeur], [Ville]
[mois année] – [mois année]
- [Réalisation chiffrée : ce que vous avez fait, et le résultat.]
- [Responsabilité principale.]
- [Outil, méthode ou équipe dirigée.]`,
  en: `! [Job title] · [Employer], [City]
[month year] – [month year]
- [Measurable achievement: what you did and the result.]
- [Main responsibility.]
- [Tool, method or team you led.]`,
};

const SECTIONS: Record<Section, Record<Lang, string>> = {
  profile: {
    fr: `## Profil
[Deux ou trois phrases : qui vous êtes, ce que vous apportez, le poste visé.]`,
    en: `## Profile
[Two or three sentences: who you are, what you bring, the job you want.]`,
  },
  experience: { fr: `## Expérience professionnelle\n${JOB.fr}\n\n${JOB.fr}`, en: `## Work experience\n${JOB.en}\n\n${JOB.en}` },
  education: {
    fr: `## Formation
! [Diplôme] · [Établissement], [Ville]
[année] · [Mention, spécialité ou sujet de mémoire]`,
    en: `## Education
! [Degree or diploma] · [School], [City]
[year] · [Honours, major or thesis]`,
  },
  skills: {
    fr: `## Compétences
- [Compétence clé] · [Compétence clé] · [Compétence clé]
- [Logiciels et outils]
- [Qualités : rigueur, leadership, travail d'équipe]`,
    en: `## Skills
- [Key skill] · [Key skill] · [Key skill]
- [Software and tools]
- [Strengths: rigour, leadership, teamwork]`,
  },
  languages: {
    fr: `## Langues
- Français : [niveau]
- Anglais : [niveau]
- [Autre langue] : [niveau]`,
    en: `## Languages
- English: [level]
- French: [level]
- [Other language]: [level]`,
  },
  certifications: {
    fr: `## Certifications
- [Certification] · [Organisme] · [année]
- [Certification] · [Organisme] · [année]`,
    en: `## Certifications
- [Certification] · [Issuer] · [year]
- [Certification] · [Issuer] · [year]`,
  },
  volunteer: {
    fr: `## Bénévolat
! [Rôle] · [Organisme]
[année] – [année] · [Ce que vous y faites.]`,
    en: `## Volunteering
! [Role] · [Organization]
[year] – [year] · [What you do there.]`,
  },
  interests: { fr: `## Centres d'intérêt\n[Sport, lecture, voyages, associations…]`, en: `## Interests\n[Sports, reading, travel, clubs…]` },
  references: { fr: `## Références\nDisponibles sur demande.`, en: `## References\nAvailable on request.` },
  service: {
    fr: `## Service militaire
! [Grade] · [Unité / base], [Ville]
[année] – [année] · [Groupe professionnel militaire]
- [Fonction et nombre de personnes sous vos ordres.]
- [Mission ou réalisation, avec un résultat chiffré.]
- [Responsabilité de matériel, de budget ou de sécurité.]`,
    en: `## Military service
! [Rank] · [Unit / base], [City]
[year] – [year] · [Military occupation]
- [Role and number of people you led.]
- [Mission or achievement, with a measurable result.]
- [Responsibility for equipment, budget or safety.]`,
  },
  clearance: {
    fr: `## Cote de sécurité
[Niveau : Fiabilité / Secret / Très secret] · valide jusqu'en [année]`,
    en: `## Security clearance
[Level: Reliability / Secret / Top Secret] · valid until [year]`,
  },
  milQuals: {
    fr: `## Qualifications militaires
- [Cours ou qualification] · [année]
- [Cours de leadership] · [année]
- [Qualification technique ou de tir] · [année]`,
    en: `## Military qualifications
- [Course or qualification] · [year]
- [Leadership course] · [year]
- [Technical or weapons qualification] · [year]`,
  },
  awards: {
    fr: `## Décorations et distinctions
- [Médaille ou mention] · [année]
- [Prix ou reconnaissance] · [année]`,
    en: `## Honours and awards
- [Medal or commendation] · [year]
- [Award or recognition] · [year]`,
  },
  deployments: {
    fr: `## Déploiements et opérations
- [Opération] · [Pays] · [mois année] – [mois année] · [Rôle]
- [Opération ou exercice] · [Lieu] · [année] · [Rôle]`,
    en: `## Deployments and operations
- [Operation] · [Country] · [month year] – [month year] · [Role]
- [Operation or exercise] · [Place] · [year] · [Role]`,
  },
  transferable: {
    fr: `## Compétences transférables
- Leadership : [dirigé une équipe de N personnes, en langage civil].
- Gestion de projet : [planifié et livré quoi, dans quels délais].
- Logistique et ressources : [valeur du matériel ou du budget géré].
- Sécurité et gestion des risques : [procédures appliquées, résultats].`,
    en: `## Transferable skills
- Leadership: [led a team of N people, in civilian terms].
- Project management: [planned and delivered what, on what timeline].
- Logistics and resources: [value of the equipment or budget managed].
- Safety and risk management: [procedures applied, results].`,
  },
  merit: {
    fr: `## Critères de mérite
! [Critère 1, tel qu'écrit dans l'annonce]
[Où, quand et comment vous l'avez démontré : situation, action, résultat.]

! [Critère 2]
[Situation, action, résultat.]`,
    en: `## Merit criteria
! [Criterion 1, as written in the job poster]
[Where, when and how you showed it: situation, action, result.]

! [Criterion 2]
[Situation, action, result.]`,
  },
  officialLanguages: {
    fr: `## Langues officielles
Résultats de l'évaluation de langue seconde : [lecture / écrit / oral, ex. CBC] · [année]`,
    en: `## Official languages
Second language evaluation results: [reading / writing / oral, e.g. CBC] · [year]`,
  },
  projects: {
    fr: `## Projets
! [Nom du projet] · [année]
[Ce que vous avez construit, avec quoi, et pour quel résultat.] [Lien]`,
    en: `## Projects
! [Project name] · [year]
[What you built, with what, and the result.] [Link]`,
  },
  publications: {
    fr: `## Publications et conférences
- [Auteurs]. « [Titre] ». [Revue ou conférence], [année].
- [Auteurs]. « [Titre] ». [Revue ou conférence], [année].`,
    en: `## Publications and talks
- [Authors]. "[Title]". [Journal or conference], [year].
- [Authors]. "[Title]". [Journal or conference], [year].`,
  },
  leadership: {
    fr: `## Leadership
- [Équipe dirigée : taille, budget, portée.]
- [Changement mené et son effet sur l'organisation.]`,
    en: `## Leadership
- [Team led: size, budget, scope.]
- [Change you led and its effect on the organization.]`,
  },
  achievements: {
    fr: `## Réalisations clés
- [Résultat chiffré : +N % de chiffre d'affaires, −N % de coûts…]
- [Résultat chiffré.]
- [Résultat chiffré.]`,
    en: `## Key achievements
- [Measurable result: +N% revenue, −N% costs…]
- [Measurable result.]
- [Measurable result.]`,
  },
  portfolio: { fr: `## Portfolio\n[Lien vers vos travaux] · [Trois projets marquants en une ligne chacun.]`, en: `## Portfolio\n[Link to your work] · [Three standout projects, one line each.]` },
  licences: {
    fr: `## Permis et cartes
- Permis de conduire : [classe]
- [Carte de compétence, permis de travail en hauteur, secourisme…] · valide jusqu'en [année]`,
    en: `## Licences and tickets
- Driver's licence: [class]
- [Trade ticket, working at heights, first aid…] · valid until [year]`,
  },
  tools: {
    fr: `## Technologies
- Langages : [langages]
- Outils et plateformes : [outils]
- Méthodes : [Agile, DevOps, ITIL…]`,
    en: `## Technologies
- Languages: [languages]
- Tools and platforms: [tools]
- Methods: [Agile, DevOps, ITIL…]`,
  },
};

interface CvDef {
  id: string;
  theme: string;
  title: LetterTemplate['title'];
  headline: Record<Lang, string>;
  sections: Section[];
}

const CVS: CvDef[] = [
  { id: 'cvClassic', theme: 'classic', title: { en: 'Classic CV', fr: 'CV classique', es: 'CV clásico', pt: 'CV clássico', de: 'Klassischer Lebenslauf' },
    headline: { fr: '[Poste visé]', en: '[Target job]' }, sections: ['profile', 'experience', 'education', 'skills', 'languages', 'interests'] },
  { id: 'cvModern', theme: 'modern', title: { en: 'Modern CV', fr: 'CV moderne', es: 'CV moderno', pt: 'CV moderno', de: 'Moderner Lebenslauf' },
    headline: { fr: '[Poste visé] · [Années] ans d\'expérience', en: '[Target job] · [Years] years of experience' }, sections: ['profile', 'skills', 'experience', 'education', 'certifications', 'languages'] },
  { id: 'cvElegant', theme: 'elegant', title: { en: 'Elegant CV', fr: 'CV élégant', es: 'CV elegante', pt: 'CV elegante', de: 'Eleganter Lebenslauf' },
    headline: { fr: '[Poste visé]', en: '[Target job]' }, sections: ['profile', 'experience', 'education', 'languages', 'volunteer', 'references'] },
  { id: 'cvMinimal', theme: 'mono', title: { en: 'Minimal CV', fr: 'CV minimaliste', es: 'CV minimalista', pt: 'CV minimalista', de: 'Minimalistischer Lebenslauf' },
    headline: { fr: '[Poste visé]', en: '[Target job]' }, sections: ['experience', 'education', 'skills'] },
  { id: 'cvStudent', theme: 'office', title: { en: 'Student / first job CV', fr: 'CV étudiant / premier emploi', es: 'CV estudiante / primer empleo', pt: 'CV estudante / primeiro emprego', de: 'Lebenslauf Student / Berufseinstieg' },
    headline: { fr: 'Étudiant(e) en [domaine] · à la recherche de [stage / emploi]', en: '[Field] student · looking for [internship / job]' }, sections: ['profile', 'education', 'projects', 'experience', 'volunteer', 'skills', 'languages'] },
  { id: 'cvExecutive', theme: 'classic', title: { en: 'Executive CV', fr: 'CV cadre / direction', es: 'CV directivo', pt: 'CV executivo', de: 'Lebenslauf Führungskraft' },
    headline: { fr: '[Directeur / Directrice] · [Secteur]', en: '[Director / Executive] · [Industry]' }, sections: ['profile', 'achievements', 'leadership', 'experience', 'education', 'languages'] },
  { id: 'cvTech', theme: 'modern', title: { en: 'Technical / IT CV', fr: 'CV technique / informatique', es: 'CV técnico / informática', pt: 'CV técnico / informática', de: 'Lebenslauf Technik / IT' },
    headline: { fr: '[Développeur / Ingénieur] · [Spécialité]', en: '[Developer / Engineer] · [Speciality]' }, sections: ['profile', 'tools', 'experience', 'projects', 'certifications', 'education'] },
  { id: 'cvCareer', theme: 'forest', title: { en: 'Career change CV', fr: 'CV reconversion', es: 'CV cambio de carrera', pt: 'CV mudança de carreira', de: 'Lebenslauf Quereinstieg' },
    headline: { fr: 'De [ancien métier] à [nouveau métier]', en: 'From [former job] to [new job]' }, sections: ['profile', 'transferable', 'education', 'experience', 'volunteer', 'skills'] },
  { id: 'cvPublic', theme: 'classic', title: { en: 'Public service CV', fr: 'CV fonction publique', es: 'CV función pública', pt: 'CV função pública', de: 'Lebenslauf öffentlicher Dienst' },
    headline: { fr: 'Candidature : [titre du poste] · processus n° [numéro]', en: 'Application: [job title] · process no. [number]' }, sections: ['profile', 'merit', 'experience', 'education', 'officialLanguages', 'clearance'] },
  { id: 'cvBilingual', theme: 'office', title: { en: 'Bilingual CV (FR/EN)', fr: 'CV bilingue (FR/EN)', es: 'CV bilingüe (FR/EN)', pt: 'CV bilíngue (FR/EN)', de: 'Zweisprachiger Lebenslauf (FR/EN)' },
    headline: { fr: '[Poste visé] · [Target job]', en: '[Target job] · [Poste visé]' }, sections: ['profile', 'experience', 'education', 'officialLanguages', 'skills'] },
  { id: 'cvMilNcm', theme: 'forest', title: { en: 'Military CV (NCM)', fr: 'CV militaire (militaire du rang)', es: 'CV militar (tropa)', pt: 'CV militar (praça)', de: 'Lebenslauf Militär (Mannschaft/Unteroffizier)' },
    headline: { fr: '[Grade] · [Groupe professionnel militaire]', en: '[Rank] · [Military occupation]' }, sections: ['profile', 'service', 'milQuals', 'deployments', 'awards', 'clearance', 'education'] },
  { id: 'cvMilOfficer', theme: 'classic', title: { en: 'Military CV (officer)', fr: 'CV militaire (officier)', es: 'CV militar (oficial)', pt: 'CV militar (oficial)', de: 'Lebenslauf Militär (Offizier)' },
    headline: { fr: '[Grade] · [Fonction de commandement ou d\'état-major]', en: '[Rank] · [Command or staff role]' }, sections: ['profile', 'leadership', 'service', 'deployments', 'milQuals', 'education', 'awards', 'clearance', 'languages'] },
  { id: 'cvMilToCiv', theme: 'modern', title: { en: 'Military to civilian CV', fr: 'CV transition militaire → civil', es: 'CV transición militar → civil', pt: 'CV transição militar → civil', de: 'Lebenslauf Militär → Zivil' },
    headline: { fr: '[Poste civil visé] · [N] ans d\'expérience en leadership', en: '[Target civilian job] · [N] years of leadership' }, sections: ['profile', 'transferable', 'achievements', 'service', 'education', 'certifications', 'clearance'] },
  { id: 'cvReservist', theme: 'forest', title: { en: 'Reservist CV', fr: 'CV réserviste', es: 'CV reservista', pt: 'CV reservista', de: 'Lebenslauf Reservist' },
    headline: { fr: '[Poste civil] · Réserviste, [Grade] à [Unité]', en: '[Civilian job] · Reservist, [Rank] at [Unit]' }, sections: ['profile', 'experience', 'service', 'milQuals', 'education', 'skills'] },
  { id: 'cvVeteran', theme: 'classic', title: { en: 'Veteran, federal job CV', fr: 'CV ancien combattant (poste fédéral)', es: 'CV veterano (empleo público)', pt: 'CV veterano (emprego público)', de: 'Lebenslauf Veteran (Bundesdienst)' },
    headline: { fr: 'Vétéran · Candidature [titre du poste]', en: 'Veteran · Application for [job title]' }, sections: ['profile', 'merit', 'service', 'transferable', 'officialLanguages', 'clearance', 'education'] },
  { id: 'cvSecurity', theme: 'modern', title: { en: 'Security / police / fire CV', fr: 'CV sécurité / police / pompier', es: 'CV seguridad / policía / bomberos', pt: 'CV segurança / polícia / bombeiros', de: 'Lebenslauf Sicherheit / Polizei / Feuerwehr' },
    headline: { fr: '[Agent / Pompier / Policier]', en: '[Officer / Firefighter / Constable]' }, sections: ['profile', 'experience', 'certifications', 'licences', 'clearance', 'languages', 'volunteer'] },
  { id: 'cvHealth', theme: 'elegant', title: { en: 'Healthcare CV', fr: 'CV santé / soins', es: 'CV salud', pt: 'CV saúde', de: 'Lebenslauf Gesundheitswesen' },
    headline: { fr: '[Infirmier(ère) / Préposé(e) / Médecin] · [Spécialité]', en: '[Nurse / Care aide / Physician] · [Speciality]' }, sections: ['profile', 'licences', 'experience', 'education', 'certifications', 'languages'] },
  { id: 'cvTrades', theme: 'forest', title: { en: 'Skilled trades CV', fr: 'CV métiers spécialisés', es: 'CV oficios', pt: 'CV ofícios', de: 'Lebenslauf Handwerk' },
    headline: { fr: '[Électricien / Mécanicien / Soudeur] · [Sceau rouge / Compagnon]', en: '[Electrician / Mechanic / Welder] · [Red Seal / Journeyperson]' }, sections: ['profile', 'licences', 'experience', 'skills', 'education'] },
  { id: 'cvCreative', theme: 'scene', title: { en: 'Creative CV', fr: 'CV créatif', es: 'CV creativo', pt: 'CV criativo', de: 'Kreativer Lebenslauf' },
    headline: { fr: '[Designer / Artiste / Créateur de contenu]', en: '[Designer / Artist / Content creator]' }, sections: ['profile', 'portfolio', 'projects', 'experience', 'skills', 'education'] },
  { id: 'cvAcademic', theme: 'classic', title: { en: 'Academic CV', fr: 'CV académique / recherche', es: 'CV académico', pt: 'CV acadêmico', de: 'Akademischer Lebenslauf' },
    headline: { fr: '[Doctorant / Chercheur / Professeur] · [Discipline]', en: '[PhD candidate / Researcher / Professor] · [Discipline]' }, sections: ['profile', 'education', 'publications', 'experience', 'awards', 'languages', 'references'] },
];

export interface CvTemplate extends Omit<LetterTemplate, 'cat'> { cat: 'cv'; theme: string }

function build(def: CvDef, lang: Lang): string {
  const parts = [HEAD[lang](def.headline[lang])];
  if (def.id === 'cvBilingual') {
    // Each section twice: French, then English, so one page serves both readers.
    for (const s of def.sections) parts.push(SECTIONS[s].fr.replace(/^## (.*)$/m, (_m, h: string) => `## ${h} · ${SECTIONS[s].en.match(/^## (.*)$/m)?.[1] ?? ''}`), SECTIONS[s].en.replace(/^## .*\n/, ''));
  } else {
    for (const s of def.sections) parts.push(SECTIONS[s][lang]);
  }
  return parts.join('\n\n');
}

export const CV_TEMPLATES: CvTemplate[] = CVS.map(d => ({ id: d.id, cat: 'cv', theme: d.theme, title: d.title, fr: build(d, 'fr'), en: build(d, 'en') }));
