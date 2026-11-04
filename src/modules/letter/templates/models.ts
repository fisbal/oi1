// The exemplary work of each norm (Martin, 2026-11-03: "un modèle exemplaire où tu n'auras rien à dire"): the
// norm's own parts, filled with a short, real, well-written work on remote work and motivation, its sources cited
// the way that norm cites them (APA, author-date, MLA, numbers, notes, legal styles), and its reference list in the
// norm's format. "Analyse et correction" finds nothing to say about it (works-models.test.ts checks every norm).
// Each norm also links to the example its authors publish, when there is one.
import type { JSONContent } from '@tiptap/core';
import { TOC_MARK, workDoc, type WorkLayout } from './works';
import type { WorkLang } from './worksI18n';

/** The official example or guide published for a norm (opened in the browser). */
export const OFFICIAL_EXAMPLES: Record<string, string> = {
  apaProvost: 'https://uqo.ca/sites/default/files/e7e97de569ac66adf6bdb03b0ee36267f9bbfc9cguide-de-lapa-selon-provost.pdf',
  apa7: 'https://apastyle.apa.org/style-grammar-guidelines/paper-format/sample-papers',
  apa7Pro: 'https://apastyle.apa.org/style-grammar-guidelines/paper-format/sample-papers',
  apa6: 'https://owl.purdue.edu/owl/research_and_citation/apa_style/apa_formatting_and_style_guide/apa_sample_paper.html',
  mla9: 'https://owl.purdue.edu/owl/research_and_citation/mla_style/mla_formatting_and_style_guide/mla_sample_paper.html',
  chicago: 'https://owl.purdue.edu/owl/research_and_citation/chicago_manual_18th_edition/cmos_formatting_and_style_guide/cmos_nb_sample_paper.html',
  chicagoAD: 'https://owl.purdue.edu/owl/research_and_citation/chicago_manual_18th_edition/cmos_formatting_and_style_guide/cmos_author_date_sample_paper.html',
  ieee: 'https://journals.ieeeauthorcenter.ieee.org/wp-content/uploads/sites/7/IEEE_Reference_Guide.pdf',
  vancouver: 'https://nlm.nih.gov/pubs/techbull/so07/so07_citing_medicine.html',
  mcgill: 'https://libraryguides.mcgill.ca/citation/law',
};

export type CiteFamily = 'apa' | 'authorYear' | 'mla' | 'numeric' | 'notes' | 'mcgill' | 'oscola' | 'bluebook';
/** How a norm cites its sources. */
export function citeFamily(w: WorkLayout): CiteFamily {
  if (['mla9'].includes(w.id)) return 'mla';
  if (['harvard', 'chicagoAD', 'asa', 'cse'].includes(w.id)) return 'authorYear';
  if (['ieee', 'vancouver', 'ama', 'acs', 'iso690', 'project', 'lab'].includes(w.id)) return 'numeric';
  if (['chicago', 'dissertation', 'commentary'].includes(w.id)) return 'notes';
  if (w.id === 'mcgill') return 'mcgill';
  if (w.id === 'oscola') return 'oscola';
  if (w.id === 'bluebook') return 'bluebook';
  return 'apa';
}

interface Person { last: string; ini: string; first: string }
interface Src {
  id: 'maslow' | 'herzberg' | 'deci' | 'hackman';
  who: Person[]; year: number; title: string; page: number;
  journal?: string; abbr?: string; vol?: number; no?: number; pages?: [number, number];
  publisher?: string; city?: string;
}
const SOURCES: Src[] = [
  { id: 'maslow', who: [{ last: 'Maslow', ini: 'A. H.', first: 'Abraham H.' }], year: 1943, title: 'A theory of human motivation', page: 375, journal: 'Psychological Review', abbr: 'Psychol Rev', vol: 50, no: 4, pages: [370, 396] },
  { id: 'herzberg', who: [{ last: 'Herzberg', ini: 'F.', first: 'Frederick' }, { last: 'Mausner', ini: 'B.', first: 'Bernard' }, { last: 'Snyderman', ini: 'B. B.', first: 'Barbara Bloch' }], year: 1959, title: 'The motivation to work', page: 113, publisher: 'Wiley', city: 'New York' },
  { id: 'deci', who: [{ last: 'Deci', ini: 'E. L.', first: 'Edward L.' }, { last: 'Ryan', ini: 'R. M.', first: 'Richard M.' }], year: 1985, title: 'Intrinsic motivation and self-determination in human behavior', page: 43, publisher: 'Plenum', city: 'New York' },
  { id: 'hackman', who: [{ last: 'Hackman', ini: 'J. R.', first: 'J. Richard' }, { last: 'Oldham', ini: 'G. R.', first: 'Greg R.' }], year: 1976, title: 'Motivation through the design of work: Test of a theory', page: 256, journal: 'Organizational Behavior and Human Performance', abbr: 'Organ Behav Hum Perform', vol: 16, no: 2, pages: [250, 279] },
];

type Seg = { text: string; italic?: boolean };
const SMALL = new Set(['a', 'an', 'and', 'in', 'of', 'the', 'to', 'through', 'on', 'for']);
const titleCase = (s: string) => s.split(' ').map((w, i, all) => (i > 0 && SMALL.has(w) && !all[i - 1].endsWith(':') ? w : w[0].toUpperCase() + w.slice(1))).join(' ');
const shortPages = (a: number, b: number) => { const x = String(a), y = String(b); let i = 0; while (i < x.length - 2 && x[i] === y[i]) i++; return `${x}–${y.slice(i)}`; };

/** The in-text citation of a source the first time (and the next times) for a family. */
function cite(s: Src, f: CiteFamily, lang: string, narrative: boolean, num: number): Seg[] | 'note' {
  const and = lang === 'fr' ? 'et' : 'and';
  const names = s.who.length >= 3 ? `${s.who[0].last} et al.` : s.who.map(p => p.last).join(f === 'apa' && !narrative && lang !== 'fr' ? ' & ' : ` ${and} `);
  if (f === 'apa') return [{ text: narrative ? `${names} (${s.year})` : `(${names}, ${s.year})` }];
  if (f === 'authorYear') return [{ text: narrative ? `${names} (${s.year})` : `(${names} ${s.year})` }];
  if (f === 'mla') return [{ text: narrative ? `${names} (${s.page})` : `(${names} ${s.page})` }];
  if (f === 'numeric') return [{ text: narrative ? `${names} [${num}]` : `[${num}]` }];
  return 'note';
}

/** The footnote text of a source for the note styles. */
function note(s: Src, f: CiteFamily): string {
  const full = s.who.map(p => `${p.first} ${p.last}`);
  const authors = full.length > 2 ? `${full.slice(0, -1).join(', ')} and ${full[full.length - 1]}` : full.join(' and ');
  if (f === 'mcgill') {
    const a = s.who.map(p => `${p.first.replace(/\./g, '')} ${p.last}`).join(' et ');
    return s.journal ? `${a}, « ${titleCase(s.title)} » (${s.year}) ${s.vol}:${s.no} ${s.journal} ${s.pages![0]} à la p ${s.page}.` : `${a}, ${titleCase(s.title)}, New York, ${s.publisher}, ${s.year} à la p ${s.page}.`;
  }
  if (f === 'oscola') {
    const a = s.who.map(p => `${p.first.replace(/\./g, '')} ${p.last}`);
    const au = a.length > 2 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a.join(' and ');
    return s.journal ? `${au}, '${titleCase(s.title)}' (${s.year}) ${s.vol} ${s.journal} ${s.pages![0]}, ${s.page}.` : `${au}, ${titleCase(s.title)} (${s.publisher} ${s.year}) ${s.page}.`;
  }
  if (f === 'bluebook') {
    const au = s.who.length > 2 ? `${s.who[0].first} ${s.who[0].last} et al.` : s.who.map(p => `${p.first} ${p.last}`).join(' & ');
    return s.journal ? `${au}, ${titleCase(s.title)}, ${s.vol} ${s.abbr!.replace(/ /g, '. ')}. ${s.pages![0]}, ${s.page} (${s.year}).` : `${au}, ${titleCase(s.title)} ${s.page} (${s.year}).`;
  }
  return s.journal ? `${authors}, “${titleCase(s.title)},” ${s.journal} ${s.vol}, no. ${s.no} (${s.year}): ${s.page}.` : `${authors}, ${titleCase(s.title)} (${s.city}: ${s.publisher}, ${s.year}), ${s.page}.`;
}

/** The entry of a source in the reference list, with its italic parts. */
function entry(s: Src, f: CiteFamily, num: number): Seg[] {
  const apaAuthors = () => {
    const a = s.who.map(p => `${p.last}, ${p.ini}`);
    return a.length === 1 ? a[0] : `${a.slice(0, -1).join(', ')}, & ${a[a.length - 1]}`;
  };
  const invFirst = () => {
    const [h, ...r] = s.who;
    const rest = r.map(p => `${p.first} ${p.last}`);
    return [`${h.last}, ${h.first}`, ...rest].join(rest.length > 1 ? ', ' : ', and ').replace(/, ([^,]+)$/, rest.length > 1 ? ', and $1' : ', $1');
  };
  switch (f) {
    case 'apa': return s.journal
      ? [{ text: `${apaAuthors()} (${s.year}). ${s.title}. ` }, { text: `${s.journal}, ${s.vol}`, italic: true }, { text: `(${s.no}), ${s.pages![0]}–${s.pages![1]}.` }]
      : [{ text: `${apaAuthors()} (${s.year}). ` }, { text: s.title, italic: true }, { text: `. ${s.publisher}.` }];
    case 'authorYear': return s.journal
      ? [{ text: `${invFirst()}. ${s.year}. “${titleCase(s.title)}.” ` }, { text: s.journal, italic: true }, { text: ` ${s.vol} (${s.no}): ${s.pages![0]}–${s.pages![1]}.` }]
      : [{ text: `${invFirst()}. ${s.year}. ` }, { text: titleCase(s.title), italic: true }, { text: `. ${s.city}: ${s.publisher}.` }];
    case 'mla': return s.journal
      ? [{ text: `${s.who.length > 2 ? `${s.who[0].last}, ${s.who[0].first}, et al.` : invFirst()}. “${titleCase(s.title)}.” ` }, { text: s.journal, italic: true }, { text: `, vol. ${s.vol}, no. ${s.no}, ${s.year}, pp. ${shortPages(...s.pages!)}.` }]
      : [{ text: `${s.who.length > 2 ? `${s.who[0].last}, ${s.who[0].first}, et al.` : invFirst()}. ` }, { text: titleCase(s.title), italic: true }, { text: `. ${s.publisher}, ${s.year}.` }];
    case 'numeric': {
      const ieee = s.who.map(p => `${p.first.split(' ').map(x => (x.endsWith('.') ? x : `${x[0]}.`)).join(' ')} ${p.last}`);
      const au = ieee.length > 2 ? `${ieee.slice(0, -1).join(', ')}, and ${ieee[ieee.length - 1]}` : ieee.join(' and ');
      return s.journal
        ? [{ text: `[${num}] ${au}, “${s.title},” ` }, { text: s.journal, italic: true }, { text: `, vol. ${s.vol}, no. ${s.no}, pp. ${s.pages![0]}–${s.pages![1]}, ${s.year}.` }]
        : [{ text: `[${num}] ${au}, ` }, { text: titleCase(s.title), italic: true }, { text: `. ${s.city}, NY, USA: ${s.publisher}, ${s.year}.` }];
    }
    case 'mcgill': case 'oscola': case 'bluebook':
      return [{ text: note(s, f).replace(/ à la p \d+\.$/, '.').replace(/, \d+\.$/, '.').replace(/ \d+ \((\d{4})\)\.$/, ' ($1).') }];
    default: return s.journal
      ? [{ text: `${invFirst()}. “${titleCase(s.title)}.” ` }, { text: s.journal, italic: true }, { text: ` ${s.vol}, no. ${s.no} (${s.year}): ${shortPages(...s.pages!)}.` }]
      : [{ text: `${invFirst()}. ` }, { text: titleCase(s.title), italic: true }, { text: `. ${s.city}: ${s.publisher}, ${s.year}.` }];
  }
}

// ---------- the text of the exemplary work (French and English; Spanish, Portuguese and German use English) ----------

const NB = ' ';
type Para = string; // {maslow} = cited in brackets, {maslow:n} = cited in the sentence
const FR = {
  title: 'Le télétravail et la motivation des employés',
  intro: [
    `Depuis 2020, le télétravail occupe une place durable dans de nombreuses organisations. Ce changement transforme la façon dont les employés vivent leur travail et pose une question centrale${NB}: comment préserver leur motivation lorsqu’ils travaillent loin de leurs collègues${NB}?`,
    `Ce travail présente d’abord les principales théories de la motivation, puis il examine leurs effets en contexte de télétravail avant de proposer des pistes concrètes pour les gestionnaires.`,
  ],
  body: [
    `Selon la théorie de la hiérarchie des besoins, les individus cherchent d’abord à satisfaire leurs besoins physiologiques et de sécurité, puis leurs besoins d’appartenance, d’estime et d’accomplissement {maslow}. En télétravail, le besoin d’appartenance devient plus difficile à combler.`,
    `{herzberg:n} distinguent les facteurs d’hygiène, qui évitent l’insatisfaction, des facteurs de motivation, qui suscitent l’engagement. Un bon équipement à domicile est un facteur d’hygiène, alors que la reconnaissance du travail accompli demeure un facteur de motivation.`,
    `La théorie de l’autodétermination souligne l’importance de l’autonomie, de la compétence et des relations avec les autres {deci}. Le télétravail accroît l’autonomie, mais il peut affaiblir le sentiment d’être lié à son équipe.`,
    `Le modèle des caractéristiques de l’emploi montre que la variété des tâches, leur sens et la rétroaction reçue influencent directement la motivation {hackman}. Une rétroaction régulière compense en partie la distance physique.`,
    `Ainsi, les gestionnaires peuvent soutenir la motivation en planifiant des rencontres d’équipe, en reconnaissant les efforts et en laissant aux employés une réelle marge de manœuvre.`,
    `Ces pistes demandent toutefois un suivi rigoureux, car les besoins varient selon les personnes, les tâches et le moment de l’année.`,
  ],
  conclusion: [
    `En somme, le télétravail renforce l’autonomie des employés, mais il fragilise leur sentiment d’appartenance. Les théories étudiées convergent vers une même recommandation${NB}: maintenir des liens réguliers et reconnaître le travail accompli. Une étude menée sur plusieurs années permettrait de mesurer l’effet de ces pratiques sur l’engagement.`,
  ],
  abstract: `Ce travail examine la motivation des employés en télétravail à la lumière de quatre théories classiques. Il montre que l’autonomie progresse, mais que le sentiment d’appartenance diminue, et il propose des pratiques simples pour les gestionnaires.`,
  keywords: `télétravail, motivation, autonomie, appartenance, gestion des ressources humaines`,
  method: `L’analyse repose sur une recension des écrits fondateurs de la motivation au travail et sur leur application à trois situations types de télétravail.`,
  results: `Les trois situations analysées montrent un gain d’autonomie et une baisse des échanges informels, surtout chez les nouveaux employés.`,
  discussion: `Ces résultats confirment l’importance des relations décrites par {deci:n} et rejoignent les conclusions de {hackman:n} sur la rétroaction.`,
  thanks: `Je remercie ma directrice de recherche pour ses conseils ainsi que les personnes qui ont accepté de partager leur expérience.`,
  tables: `Tableau 1. Facteurs de motivation selon les quatre théories étudiées`,
  figures: `Figure 1. Hiérarchie des besoins appliquée au télétravail`,
  appendix: `Annexe A. Grille d’entrevue utilisée pour décrire les trois situations de télétravail.`,
  execSummary: `Le télétravail accroît l’autonomie, mais réduit l’appartenance. Trois mesures sont recommandées${NB}: des rencontres régulières, une reconnaissance explicite et une plus grande latitude dans l’organisation du travail.`,
  heads: {
    'Première partie': 'Les théories de la motivation', 'Deuxième partie': 'La motivation en télétravail', 'Sous-partie': ['Les besoins et les facteurs de motivation', 'L’autonomie et les relations', 'Les pratiques des gestionnaires'],
    Section: ['Les principaux constats', 'Les pistes d’action'], Problématique: 'Le télétravail, un changement durable', 'Cadre théorique': 'Les théories de la motivation',
    Méthodologie: 'La démarche d’analyse', 'Résultats et discussion': 'Les effets observés', Développement: 'Les effets du télétravail sur la motivation',
  } as Record<string, string | string[]>,
  fill: {
    'Prénom Nom': 'Camille Tremblay', "Numéro d'étudiant": '111 222 333', 'TITRE DU TRAVAIL': 'LE TÉLÉTRAVAIL ET LA MOTIVATION DES EMPLOYÉS',
    'Titre du travail': 'Le télétravail et la motivation des employés', 'Nom du professeur ou de la professeure': 'Mme Julie Gagnon', 'SIGLE – Titre du cours': 'GRH 1001 – Comportement organisationnel',
    Établissement: 'Université TÉLUQ', 'Département, Université': 'Département des sciences humaines, Université TÉLUQ', 'SIGLE : Titre du cours': 'GRH 1001 : Comportement organisationnel',
    'Titre de l’article': 'Le télétravail et la motivation des employés', 'Auteur 1': 'Camille Tremblay', 'Auteur 2': 'Louis Roy', Affiliation: 'Université TÉLUQ',
    'Coordonnées et remerciements': 'Pour joindre l’autrice, écrire à camille.tremblay@exemple.ca.', 'Nom du professeur': 'Mme Julie Gagnon', Cours: 'GRH 1001',
    Groupe: 'Groupe 02', Matière: 'Éthique et culture', 'Nom de l’enseignant ou de l’enseignante': 'M. Marc Bouchard', École: 'École secondaire du Plateau',
    ÉTABLISSEMENT: 'UNIVERSITÉ TÉLUQ', 'TITRE DU MÉMOIRE OU DE LA THÈSE': 'LE TÉLÉTRAVAIL ET LA MOTIVATION DES EMPLOYÉS',
    'Mémoire présenté en vue de l’obtention du grade de maître ès (M.)': 'Mémoire présenté en vue de l’obtention du grade de maître ès sciences (M. Sc.)',
    Programme: 'Programme de maîtrise en gestion', 'Nom du directeur ou de la directrice': 'Mme Julie Gagnon', 'Titre du rapport': 'Le télétravail et la motivation des employés',
    'Sous-titre': 'Constats et recommandations', 'Cours ou organisation': 'GRH 1001, Université TÉLUQ',
  } as Record<string, string>,
};
const EN: typeof FR = {
  title: 'Remote Work and Employee Motivation',
  intro: [
    'Since 2020, remote work has become a lasting part of many organizations. This change transforms how employees experience their work and raises a central question: how can their motivation be preserved when they work far from their colleagues?',
    'This paper first presents the main theories of motivation, then examines their effects in remote work, and finally suggests practical steps for managers.',
  ],
  body: [
    'According to the hierarchy of needs, people first seek to meet their physiological and safety needs, then their needs for belonging, esteem, and self-actualization {maslow}. In remote work, the need for belonging becomes harder to meet.',
    '{herzberg:n} distinguish hygiene factors, which prevent dissatisfaction, from motivators, which create engagement. Good equipment at home is a hygiene factor, while recognition of work done remains a motivator.',
    'Self-determination theory stresses the importance of autonomy, competence, and relatedness {deci}. Remote work increases autonomy, but it can weaken the feeling of being connected to a team.',
    'The job characteristics model shows that task variety, task significance, and feedback directly influence motivation {hackman}. Regular feedback partly makes up for physical distance.',
    'Managers can therefore support motivation by planning team meetings, recognizing effort, and giving employees real room to decide how they work.',
    'These steps require careful follow-up, since needs vary with people, tasks, and the time of year.',
  ],
  conclusion: ['In short, remote work strengthens employee autonomy but weakens their sense of belonging. The theories studied point to the same recommendation: keep regular contact and recognize the work done. A study over several years would measure the effect of these practices on engagement.'],
  abstract: 'This paper examines the motivation of remote employees in light of four classic theories. It shows that autonomy grows while the sense of belonging declines, and it proposes simple practices for managers.',
  keywords: 'remote work, motivation, autonomy, belonging, human resource management',
  method: 'The analysis is based on a review of the founding works on work motivation and on their application to three typical remote work situations.',
  results: 'The three situations analyzed show a gain in autonomy and fewer informal exchanges, especially among new employees.',
  discussion: 'These results confirm the importance of relatedness described by {deci:n} and agree with the findings of {hackman:n} on feedback.',
  thanks: 'I thank my supervisor for her advice and the people who agreed to share their experience.',
  tables: 'Table 1. Motivation factors in the four theories studied',
  figures: 'Figure 1. The hierarchy of needs applied to remote work',
  appendix: 'Appendix A. Interview guide used to describe the three remote work situations.',
  execSummary: 'Remote work increases autonomy but reduces belonging. Three measures are recommended: regular meetings, explicit recognition, and more freedom in organizing work.',
  heads: {
    'First part': 'Theories of Motivation', 'Second part': 'Motivation in Remote Work', Subsection: ['Needs and Motivation Factors', 'Autonomy and Relatedness', 'Managers’ Practices'],
    Section: ['Main Findings', 'Courses of Action'], 'Research problem': 'Remote Work, a Lasting Change', 'Theoretical framework': 'Theories of Motivation',
    Methodology: 'Method of Analysis', 'Results and discussion': 'Observed Effects', Body: 'Effects of Remote Work on Motivation',
  },
  fill: {
    'First Last name': 'Camille Tremblay', 'Student number': '111 222 333', 'TITLE OF THE PAPER': 'REMOTE WORK AND EMPLOYEE MOTIVATION', 'Title of the paper': 'Remote Work and Employee Motivation',
    'Name of the professor': 'Dr. Julie Gagnon', 'CODE – Course title': 'HRM 1001 – Organizational Behavior', Institution: 'TÉLUQ University', 'Department, University': 'Department of Human Sciences, TÉLUQ University',
    'CODE: Course title': 'HRM 1001: Organizational Behavior', 'Instructor name': 'Dr. Julie Gagnon', 'Title of the article': 'Remote Work and Employee Motivation', 'Author 1': 'Camille Tremblay', 'Author 2': 'Louis Roy',
    Affiliation: 'TÉLUQ University', 'Contact details and acknowledgements': 'Correspondence concerning this article should be addressed to camille.tremblay@example.ca.', Course: 'HRM 1001',
    Group: 'Group 02', Subject: 'Ethics and Culture', 'Teacher name': 'Mr. Marc Bouchard', School: 'Plateau High School', INSTITUTION: 'TÉLUQ UNIVERSITY', 'TITLE OF THE THESIS': 'REMOTE WORK AND EMPLOYEE MOTIVATION',
    'Thesis submitted for the degree of Master of (M.)': 'Thesis submitted for the degree of Master of Science (M.Sc.)', Program: 'Master’s Program in Management', 'Name of the supervisor': 'Dr. Julie Gagnon',
    'Title of the report': 'Remote Work and Employee Motivation', Subtitle: 'Findings and Recommendations', 'Course or organization': 'HRM 1001, TÉLUQ University',
  },
};

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const textOf = (n: JSONContent): string => (n.text ?? '') + (n.content ?? []).map(textOf).join('');

/** The exemplary work of a norm, in the app's language (French text in French, English otherwise). */
export function modelDoc(w: WorkLayout, lang: WorkLang, date: string): JSONContent[] {
  const T = lang === 'fr' ? FR : EN;
  const f = citeFamily(w);
  const order: Src['id'][] = [];
  const number = (id: Src['id']) => { if (!order.includes(id)) order.push(id); return order.indexOf(id) + 1; };
  const notes: string[] = [];
  /** A paragraph with its citations made the norm's way (a footnote for note styles). */
  const para = (s: Para, attrs: Record<string, unknown> = {}): JSONContent => {
    const content: JSONContent[] = [];
    let at = 0;
    for (const m of s.matchAll(/\{(maslow|herzberg|deci|hackman)(:n)?\}/g)) {
      const src = SOURCES.find(x => x.id === m[1])!;
      const narrative = !!m[2];
      let before = s.slice(at, m.index);
      const c = cite(src, f, lang, narrative, number(src.id));
      if (c === 'note') {
        // Notes: the authors' names stay in the sentence when they are its subject; the note follows the clause.
        if (narrative) before += src.who.length >= 3 ? `${src.who[0].last} et al.` : src.who.map(p => p.last).join(lang === 'fr' ? ' et ' : ' and ');
        else before = before.replace(/\s+$/, '');
        if (before) content.push({ type: 'text', text: before });
        notes.push(note(src, f));
        content.push({ type: 'footnote', attrs: { text: note(src, f) } });
      } else {
        if (!narrative) before = before.replace(/\s+$/, ' ');
        if (before) content.push({ type: 'text', text: before });
        content.push(...c.map(x => ({ type: 'text', text: x.text })));
      }
      at = m.index + m[0].length;
    }
    if (at < s.length) content.push({ type: 'text', text: s.slice(at) });
    return { type: 'paragraph', attrs, content: content.filter(c => c.type !== 'text' || c.text) };
  };
  const base = workDoc(w, lang, date);
  // 1. The title page: every yellow field gets a real value, without its yellow.
  const fillText = (n: JSONContent): JSONContent => {
    if (n.type === 'text' && n.marks?.some(m => m.type === 'highlight')) {
      const inner = n.text!.replace(/^\[|\]$/g, '');
      const v = T.fill[inner] ?? T.fill[Object.keys(T.fill).find(k => plain(k) === plain(inner)) ?? ''] ?? inner;
      const marks = n.marks.filter(m => m.type !== 'highlight');
      return { ...n, text: v, ...(marks.length ? { marks } : { marks: undefined }) };
    }
    if (n.type === 'text') return { ...n, text: n.text!.replace(/\[([^\]]+)\]/g, (_, k: string) => T.fill[k] ?? k) };
    return n.content ? { ...n, content: n.content.map(fillText) } : n;
  };
  // 2. The parts: real titles for the [placeholders], and real paragraphs instead of "[Votre texte…]".
  let bodyAt = 0, subAt = 0, secAt = 0;
  const out: JSONContent[] = [];
  for (let i = 0; i < base.length; i++) {
    let n = base[i];
    const txt = textOf(n);
    if (n.type === 'paragraph' && /^\[(?:Votre texte…|Your text…|[^\]]*…)\]$/.test(txt.trim())) continue;
    if (n.type !== 'heading') { out.push(fillText(n)); continue; }
    n = { ...n, content: [{ type: 'text', text: txt.replace(/\[([^\]]+)\]/g, (_, k: string) => {
      const v = T.heads[k];
      if (Array.isArray(v)) return k === 'Section' ? v[secAt++ % v.length] : v[subAt++ % v.length];
      return v ?? k;
    }) }] };
    // A norm's instruction in its part name ("Résumé (300 mots)") is for the template, not for the finished work.
    n = { ...n, content: [{ type: 'text', text: textOf(n).replace(/\s*\(\d+\s*(?:mots|words|palabras|palavras|Wörter)\)/, '') }] };
    const head = textOf(n);
    const p = plain(head).replace(/^(?:[ivx]+|\d+(?:\.\d+)*)[.)]?\s+/, '');
    out.push(n);
    // The table of contents is filled in from the titles when the work opens: no text under its title.
    if (base[i + 1] && textOf(base[i + 1]) === TOC_MARK) continue;
    if (/^(references|bibliographie|bibliography|ouvrages cites|works cited|referencias|referencias bibliograficas|literaturverzeichnis|bibliografia|quellen)/.test(p) || /^(r[eé]f[eé]rences)/.test(p)) { out.push({ type: 'paragraph', attrs: { indentFirst: 0 }, content: [{ type: 'text', text: '⟦REFS⟧' }] }); continue; }
    if (/^(introduction|introduccion|einleitung|introducao)/.test(p)) out.push(...T.intro.map(x => para(x)));
    else if (/^(conclusion|conclusao|fazit|schluss)/.test(p)) out.push(...T.conclusion.map(x => para(x)));
    else if (/^(resume|abstract|resumen|zusammenfassung)$/.test(p)) out.push(para(p === 'resume' && lang !== 'fr' ? FR.abstract : p === 'abstract' && lang === 'fr' ? EN.abstract : T.abstract));
    else if (/^(mots-cles|keywords|palabras clave|palavras-chave|schlusselworter)/.test(p)) out.push(para(T.keywords));
    else if (/^(methode|method|metodo|methodik)/.test(p)) out.push(para(T.method));
    else if (/^(resultats|results|resultados|ergebnisse)$/.test(p)) out.push(para(T.results));
    else if (/^(discussion|discusion|discussao|diskussion)$/.test(p)) out.push(para(T.discussion));
    else if (/^(remerciements|acknowledgements|agradecimientos|agradecimentos|danksagung)/.test(p)) out.push(para(T.thanks));
    else if (/^(liste des tableaux|list of tables)/.test(p)) out.push(para(T.tables, { indentFirst: 0 }));
    else if (/^(liste des figures|list of figures)/.test(p)) out.push(para(T.figures, { indentFirst: 0 }));
    else if (/^(annexes?|appendices|appendix|anexos?|anhang)/.test(p)) out.push(para(T.appendix));
    else if (/^(sommaire executif|executive summary|sommaire|summary)/.test(p)) out.push(para(T.execSummary));
    else {
      const next = base[i + 1];
      // A part followed by its sub-parts gets one paragraph; a sub-part or a single part gets two.
      const hasSub = next?.type === 'paragraph' && base[i + 2]?.type === 'heading' && Number(base[i + 2].attrs?.level) > Number(n.attrs?.level);
      const take = hasSub ? 1 : 2;
      for (let k = 0; k < take; k++) out.push(para(T.body[bodyAt++ % T.body.length]));
    }
  }
  // 3. The reference list in the norm's format, sorted the norm's way (A to Z, or by first citation for numbers).
  {
    const used = SOURCES.filter(s => order.includes(s.id) || f === 'notes' || f === 'mcgill' || f === 'oscola' || f === 'bluebook');
    const list = f === 'numeric' ? order.map(id => SOURCES.find(s => s.id === id)!) : [...used].sort((a, b) => a.who[0].last.localeCompare(b.who[0].last));
    const entries = list.map(s => ({ type: 'paragraph', attrs: f === 'numeric' ? { indentFirst: 0 } : { indentLeft: 36, indentFirst: -36 }, content: entry(s, f, (order.indexOf(s.id) + 1) || 1).map(x => ({ type: 'text', text: x.text, ...(x.italic ? { marks: [{ type: 'italic' }] } : {}) })) }));
    const at = out.findIndex(n => textOf(n) === '⟦REFS⟧');
    if (at >= 0) out.splice(at, 1, ...entries);
    else if (order.length || f === 'notes' || f === 'mcgill' || f === 'oscola' || f === 'bluebook') {
      // A norm without a references part still lists what the work cited, at the end.
      const name = f === 'mla' ? (lang === 'fr' ? 'Ouvrages cités' : 'Works Cited') : f === 'notes' || f === 'mcgill' || f === 'oscola' || f === 'bluebook' ? (lang === 'fr' ? 'Bibliographie' : 'Bibliography') : (lang === 'fr' ? 'Références' : 'References');
      if (out.length && out[out.length - 1].type !== 'pageBreak') out.push({ type: 'pageBreak' });
      out.push({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: name }] }, ...entries);
    }
  }
  return out.filter(n => textOf(n) !== '⟦REFS⟧').map(n => (textOf(n) === TOC_MARK ? n : n));
}
