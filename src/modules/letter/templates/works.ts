// "Mise en page des travaux" (Martin, 2026-11-02): pick the norm of a school or university work and the whole
// document takes shape at once. The page (paper, margins), the text (font, size, line spacing, first-line indent),
// the headings, the page number and, on an empty document, the parts in the right order with yellow [fields]:
// title page, table of contents, introduction, body, conclusion, references, appendices.
// APA-Provost follows the TELUQ library's page (bibliotheque.teluq.ca/Mise_Page_Travaux): letter paper, 2.5 cm
// margins, Times New Roman or Arial 12, double spacing, first line indented by 5 spaces, page number top right,
// level 1 headings centered and bold, level 2 left and bold, level 3 indented and bold, each part on a new page.

import type { JSONContent } from '@tiptap/core';
import type { DocStyles, StyleDef } from '../model';
import { FIELD_COLOR } from './markup';

type L = { fr: string; en: string };
/** Headings: Provost (centered, left, indented), APA 7, MLA, plain bold, numbered caps (IEEE). */
type Heads = 'provost' | 'apa' | 'mla' | 'plain' | 'caps';
/** Where the page number goes: top right, bottom center, bottom right, or MLA's "Name 1" top right. */
type Num = 'tr' | 'bc' | 'br' | 'mla' | null;
/** The first page: a Québec title page, APA student or professional, MLA heading block, school cover, thesis, report, none. */
type Title = 'qc' | 'apa' | 'apaPro' | 'mla' | 'school' | 'thesis' | 'report' | 'none';
/** A part: [heading level (0 = page break, -1 = table of contents), French, English]. */
type Part = [number, string, string];

export interface WorkLayout {
  id: string;
  name: L;
  /** The rules in one short line, like "Times 12 · double · 2,5 cm". */
  hint: L;
  size: 'letter' | 'a4';
  /** Margins in cm: top, right, bottom, left. */
  m: [number, number, number, number];
  font: string;
  pt: number;
  line: number;
  /** First-line indent in points (5 spaces is about 36 pt). */
  indent: number;
  after: number;
  align: 'left' | 'justify';
  heads: Heads;
  num: Num;
  title: Title;
  parts: Part[];
}

const BODY: Part[] = [
  [-1, '', ''], [0, '', ''],
  [1, 'Introduction', 'Introduction'],
  [1, '1. [Première partie]', '1. [First part]'], [2, '1.1 [Sous-partie]', '1.1 [Subsection]'], [2, '1.2 [Sous-partie]', '1.2 [Subsection]'],
  [1, '2. [Deuxième partie]', '2. [Second part]'], [2, '2.1 [Sous-partie]', '2.1 [Subsection]'],
  [1, 'Conclusion', 'Conclusion'], [0, '', ''],
  [1, 'Références', 'References'], [0, '', ''],
  [1, 'Annexes', 'Appendices'],
];
const ESSAY: Part[] = [
  [1, 'Introduction', 'Introduction'], [1, '[Développement]', '[Body]'], [1, 'Conclusion', 'Conclusion'], [0, '', ''], [1, 'Références', 'References'],
];
const IMRAD: Part[] = [
  [1, 'Résumé', 'Abstract'], [0, '', ''], [1, 'Introduction', 'Introduction'], [1, 'Méthode', 'Method'], [1, 'Résultats', 'Results'],
  [1, 'Discussion', 'Discussion'], [1, 'Conclusion', 'Conclusion'], [0, '', ''], [1, 'Références', 'References'],
];
const THESIS: Part[] = [
  [1, 'Résumé', 'Résumé'], [1, 'Abstract', 'Abstract'], [0, '', ''], [-1, '', ''], [0, '', ''],
  [1, 'Liste des tableaux', 'List of tables'], [1, 'Liste des figures', 'List of figures'], [0, '', ''],
  [1, 'Remerciements', 'Acknowledgements'], [0, '', ''],
  [1, 'Introduction', 'Introduction'], [0, '', ''],
  [1, 'Chapitre 1 – [Problématique]', 'Chapter 1 – [Research problem]'], [2, '1.1 [Section]', '1.1 [Section]'], [0, '', ''],
  [1, 'Chapitre 2 – [Cadre théorique]', 'Chapter 2 – [Theoretical framework]'], [2, '2.1 [Section]', '2.1 [Section]'], [0, '', ''],
  [1, 'Chapitre 3 – [Méthodologie]', 'Chapter 3 – [Methodology]'], [0, '', ''],
  [1, 'Chapitre 4 – [Résultats et discussion]', 'Chapter 4 – [Results and discussion]'], [0, '', ''],
  [1, 'Conclusion', 'Conclusion'], [0, '', ''], [1, 'Bibliographie', 'Bibliography'], [0, '', ''], [1, 'Annexes', 'Appendices'],
];
const p = (fr: string, en: string): Part[] => fr.split('|').map((x, i) => [1, x, en.split('|')[i]] as Part);

export const WORK_LAYOUTS: WorkLayout[] = [
  { id: 'apaProvost', name: { fr: 'APA-Provost (TELUQ, universités du Québec)', en: 'APA-Provost (TELUQ, Québec universities)' }, hint: { fr: 'Times 12 · double · 2,5 cm · retrait 5 espaces', en: 'Times 12 · double · 2.5 cm · 5-space indent' },
    size: 'letter', m: [2.5, 2.5, 2.5, 2.5], font: 'Times New Roman', pt: 12, line: 2, indent: 36, after: 0, align: 'left', heads: 'provost', num: 'tr', title: 'qc', parts: BODY },
  { id: 'apa7', name: { fr: 'APA 7e éd. – travail étudiant', en: 'APA 7th ed. – student paper' }, hint: { fr: 'Times 12 · double · 2,54 cm', en: 'Times 12 · double · 1 in' },
    size: 'letter', m: [2.54, 2.54, 2.54, 2.54], font: 'Times New Roman', pt: 12, line: 2, indent: 36, after: 0, align: 'left', heads: 'apa', num: 'tr', title: 'apa', parts: ESSAY },
  { id: 'apa7Pro', name: { fr: 'APA 7e éd. – article professionnel', en: 'APA 7th ed. – professional paper' }, hint: { fr: 'Times 12 · double · résumé · titre courant', en: 'Times 12 · double · abstract · running head' },
    size: 'letter', m: [2.54, 2.54, 2.54, 2.54], font: 'Times New Roman', pt: 12, line: 2, indent: 36, after: 0, align: 'left', heads: 'apa', num: 'tr', title: 'apaPro', parts: IMRAD },
  { id: 'mla9', name: { fr: 'MLA 9e éd.', en: 'MLA 9th ed.' }, hint: { fr: 'Times 12 · double · Nom + page en haut', en: 'Times 12 · double · Name + page at top' },
    size: 'letter', m: [2.54, 2.54, 2.54, 2.54], font: 'Times New Roman', pt: 12, line: 2, indent: 36, after: 0, align: 'left', heads: 'mla', num: 'mla', title: 'mla',
    parts: [[1, '[Développement]', '[Body]'], [0, '', ''], [1, 'Ouvrages cités', 'Works Cited']] },
  { id: 'chicago', name: { fr: 'Chicago / Turabian', en: 'Chicago / Turabian' }, hint: { fr: 'Times 12 · double · notes de bas de page', en: 'Times 12 · double · footnotes' },
    size: 'letter', m: [2.54, 2.54, 2.54, 2.54], font: 'Times New Roman', pt: 12, line: 2, indent: 36, after: 0, align: 'left', heads: 'plain', num: 'bc', title: 'apa',
    parts: [[1, 'Introduction', 'Introduction'], [1, '[Développement]', '[Body]'], [1, 'Conclusion', 'Conclusion'], [0, '', ''], [1, 'Bibliographie', 'Bibliography']] },
  { id: 'harvard', name: { fr: 'Harvard (auteur-date)', en: 'Harvard (author-date)' }, hint: { fr: 'Arial 11 · 1,5 · A4 2,54 cm', en: 'Arial 11 · 1.5 · A4 2.54 cm' },
    size: 'a4', m: [2.54, 2.54, 2.54, 2.54], font: 'Arial', pt: 11, line: 1.5, indent: 0, after: 12, align: 'left', heads: 'plain', num: 'br', title: 'report', parts: ESSAY },
  { id: 'ieee', name: { fr: 'IEEE (génie, informatique)', en: 'IEEE (engineering, computing)' }, hint: { fr: 'Times 10 · simple · titres numérotés', en: 'Times 10 · single · numbered headings' },
    size: 'letter', m: [1.9, 1.9, 2.54, 1.9], font: 'Times New Roman', pt: 10, line: 1, indent: 14, after: 0, align: 'justify', heads: 'caps', num: null, title: 'apaPro',
    parts: p('Résumé|I. Introduction|II. [Méthode]|III. [Résultats]|IV. Conclusion|Références', 'Abstract|I. Introduction|II. [Method]|III. [Results]|IV. Conclusion|References') },
  { id: 'vancouver', name: { fr: 'Vancouver (sciences de la santé)', en: 'Vancouver (health sciences)' }, hint: { fr: 'Arial 12 · double · IMRaD', en: 'Arial 12 · double · IMRaD' },
    size: 'a4', m: [2.5, 2.5, 2.5, 2.5], font: 'Arial', pt: 12, line: 2, indent: 0, after: 12, align: 'left', heads: 'plain', num: 'br', title: 'report', parts: IMRAD },
  { id: 'iso690', name: { fr: 'ISO 690 (Europe, France)', en: 'ISO 690 (Europe, France)' }, hint: { fr: 'Times 12 · 1,5 · justifié · A4', en: 'Times 12 · 1.5 · justified · A4' },
    size: 'a4', m: [2.5, 2.5, 2.5, 2.5], font: 'Times New Roman', pt: 12, line: 1.5, indent: 28, after: 6, align: 'justify', heads: 'plain', num: 'bc', title: 'report', parts: BODY },
  { id: 'dissertation', name: { fr: 'Dissertation (France)', en: 'Dissertation essay (France)' }, hint: { fr: 'Times 12 · 1,5 · intro, I, II, III, conclusion', en: 'Times 12 · 1.5 · intro, I, II, III, conclusion' },
    size: 'a4', m: [2.5, 2.5, 2.5, 2.5], font: 'Times New Roman', pt: 12, line: 1.5, indent: 28, after: 6, align: 'justify', heads: 'plain', num: 'bc', title: 'school',
    parts: p('Introduction|I. [Thèse]|II. [Antithèse]|III. [Synthèse]|Conclusion', 'Introduction|I. [Thesis]|II. [Antithesis]|III. [Synthesis]|Conclusion') },
  { id: 'cegep', name: { fr: 'Travail de cégep (Québec)', en: 'CEGEP paper (Québec)' }, hint: { fr: 'Arial 12 · 1,5 · page de présentation', en: 'Arial 12 · 1.5 · cover page' },
    size: 'letter', m: [2.5, 2.5, 2.5, 2.5], font: 'Arial', pt: 12, line: 1.5, indent: 0, after: 12, align: 'justify', heads: 'provost', num: 'tr', title: 'qc', parts: BODY },
  { id: 'school', name: { fr: 'Travail scolaire (secondaire)', en: 'School assignment (high school)' }, hint: { fr: 'Arial 12 · 1,5 · page de présentation', en: 'Arial 12 · 1.5 · cover page' },
    size: 'letter', m: [2.5, 2.5, 2.5, 2.5], font: 'Arial', pt: 12, line: 1.5, indent: 0, after: 12, align: 'left', heads: 'plain', num: 'br', title: 'school', parts: ESSAY },
  { id: 'master', name: { fr: 'Mémoire de maîtrise', en: "Master's thesis" }, hint: { fr: 'Times 12 · 1,5 · reliure 3,5 cm', en: 'Times 12 · 1.5 · 3.5 cm binding' },
    size: 'letter', m: [2.5, 2.5, 2.5, 3.5], font: 'Times New Roman', pt: 12, line: 1.5, indent: 36, after: 0, align: 'justify', heads: 'provost', num: 'tr', title: 'thesis', parts: THESIS },
  { id: 'phd', name: { fr: 'Thèse de doctorat', en: 'Doctoral thesis' }, hint: { fr: 'Times 12 · double · reliure 3,8 cm', en: 'Times 12 · double · 3.8 cm binding' },
    size: 'letter', m: [2.5, 2.5, 2.5, 3.8], font: 'Times New Roman', pt: 12, line: 2, indent: 36, after: 0, align: 'justify', heads: 'provost', num: 'tr', title: 'thesis', parts: THESIS },
  { id: 'internship', name: { fr: 'Rapport de stage', en: 'Internship report' }, hint: { fr: 'Arial 11 · 1,15 · organisation, mandat, bilan', en: 'Arial 11 · 1.15 · organization, mandate, review' },
    size: 'letter', m: [2.5, 2.5, 2.5, 2.5], font: 'Arial', pt: 11, line: 1.15, indent: 0, after: 8, align: 'justify', heads: 'plain', num: 'br', title: 'report',
    parts: [[1, 'Remerciements', 'Acknowledgements'], [0, '', ''], [-1, '', ''], [0, '', ''], ...p("Introduction|Présentation de l'organisation|Mandat du stage|Réalisations|Bilan et apprentissages|Conclusion", 'Introduction|The organization|Internship mandate|What I did|Review and learning|Conclusion'), [0, '', ''], [1, 'Annexes', 'Appendices']] },
  { id: 'research', name: { fr: 'Rapport de recherche', en: 'Research report' }, hint: { fr: 'Times 12 · 1,5 · résumé, méthode, résultats', en: 'Times 12 · 1.5 · abstract, method, results' },
    size: 'letter', m: [2.5, 2.5, 2.5, 2.5], font: 'Times New Roman', pt: 12, line: 1.5, indent: 36, after: 0, align: 'justify', heads: 'provost', num: 'tr', title: 'qc', parts: [[-1, '', ''], [0, '', ''], ...IMRAD] },
  { id: 'lab', name: { fr: 'Rapport de laboratoire', en: 'Lab report' }, hint: { fr: 'Calibri 11 · 1,15 · but, hypothèse, résultats', en: 'Calibri 11 · 1.15 · aim, hypothesis, results' },
    size: 'letter', m: [2.5, 2.5, 2.5, 2.5], font: 'Calibri', pt: 11, line: 1.15, indent: 0, after: 8, align: 'left', heads: 'plain', num: 'br', title: 'school',
    parts: p('But|Hypothèse|Matériel|Manipulations|Résultats|Analyse|Conclusion', 'Aim|Hypothesis|Materials|Procedure|Results|Analysis|Conclusion') },
  { id: 'review', name: { fr: 'Compte rendu de lecture', en: 'Book review' }, hint: { fr: 'Times 12 · 1,5 · résumé et analyse critique', en: 'Times 12 · 1.5 · summary and critique' },
    size: 'letter', m: [2.5, 2.5, 2.5, 2.5], font: 'Times New Roman', pt: 12, line: 1.5, indent: 36, after: 0, align: 'justify', heads: 'provost', num: 'tr', title: 'qc',
    parts: p("Présentation de l'ouvrage|Résumé|Analyse critique|Conclusion|Référence", 'About the book|Summary|Critical analysis|Conclusion|Reference') },
  { id: 'essay', name: { fr: 'Essai argumentatif', en: 'Argumentative essay' }, hint: { fr: 'Calibri 12 · 1,5 · intro, arguments, conclusion', en: 'Calibri 12 · 1.5 · intro, arguments, conclusion' },
    size: 'letter', m: [2.5, 2.5, 2.5, 2.5], font: 'Calibri', pt: 12, line: 1.5, indent: 28, after: 6, align: 'justify', heads: 'plain', num: 'br', title: 'qc',
    parts: p('Introduction|[Premier argument]|[Deuxième argument]|[Contre-argument et réfutation]|Conclusion|Références', 'Introduction|[First argument]|[Second argument]|[Counter-argument and rebuttal]|Conclusion|References') },
  { id: 'article', name: { fr: 'Article scientifique', en: 'Scientific article' }, hint: { fr: 'Times 12 · double · résumé, mots-clés, IMRaD', en: 'Times 12 · double · abstract, keywords, IMRaD' },
    size: 'letter', m: [2.54, 2.54, 2.54, 2.54], font: 'Times New Roman', pt: 12, line: 2, indent: 36, after: 0, align: 'left', heads: 'apa', num: 'tr', title: 'apaPro', parts: [[1, 'Mots-clés', 'Keywords'], ...IMRAD] },
  { id: 'caseStudy', name: { fr: 'Étude de cas (gestion)', en: 'Case study (business)' }, hint: { fr: 'Calibri 11 · 1,15 · diagnostic et recommandations', en: 'Calibri 11 · 1.15 · diagnosis and recommendations' },
    size: 'letter', m: [2.5, 2.5, 2.5, 2.5], font: 'Calibri', pt: 11, line: 1.15, indent: 0, after: 8, align: 'justify', heads: 'plain', num: 'br', title: 'report',
    parts: p("Sommaire exécutif|Contexte|Problématique|Analyse|Solutions possibles|Recommandations|Plan d'action|Conclusion", 'Executive summary|Context|Problem|Analysis|Options|Recommendations|Action plan|Conclusion') },
  { id: 'proposal', name: { fr: 'Projet de recherche (proposition)', en: 'Research proposal' }, hint: { fr: 'Times 12 · 1,5 · objectifs, méthode, échéancier', en: 'Times 12 · 1.5 · aims, method, timeline' },
    size: 'letter', m: [2.5, 2.5, 2.5, 2.5], font: 'Times New Roman', pt: 12, line: 1.5, indent: 36, after: 0, align: 'justify', heads: 'provost', num: 'tr', title: 'qc',
    parts: p('Problématique|Question de recherche|Objectifs|Cadre théorique|Méthodologie|Échéancier|Budget|Références', 'Research problem|Research question|Aims|Theoretical framework|Methodology|Timeline|Budget|References') },
  { id: 'reflective', name: { fr: 'Travail réflexif / portfolio', en: 'Reflective paper / portfolio' }, hint: { fr: 'Calibri 12 · 1,5 · expérience et apprentissages', en: 'Calibri 12 · 1.5 · experience and learning' },
    size: 'letter', m: [2.5, 2.5, 2.5, 2.5], font: 'Calibri', pt: 12, line: 1.5, indent: 0, after: 10, align: 'left', heads: 'plain', num: 'br', title: 'qc',
    parts: p("Introduction|L'expérience|Analyse|Apprentissages|Pistes pour la suite|Conclusion", 'Introduction|The experience|Analysis|What I learned|Next steps|Conclusion') },
  { id: 'apa6', name: { fr: 'APA 6e éd. (ancienne norme)', en: 'APA 6th ed. (older norm)' }, hint: { fr: 'Times 12 · double · titre courant', en: 'Times 12 · double · running head' },
    size: 'letter', m: [2.54, 2.54, 2.54, 2.54], font: 'Times New Roman', pt: 12, line: 2, indent: 36, after: 0, align: 'left', heads: 'apa', num: 'tr', title: 'apaPro', parts: ESSAY },
  { id: 'chicagoAD', name: { fr: 'Chicago auteur-date', en: 'Chicago author-date' }, hint: { fr: 'Times 12 · double · références auteur-date', en: 'Times 12 · double · author-date references' },
    size: 'letter', m: [2.54, 2.54, 2.54, 2.54], font: 'Times New Roman', pt: 12, line: 2, indent: 36, after: 0, align: 'left', heads: 'plain', num: 'tr', title: 'apa', parts: ESSAY },
  { id: 'mcgill', name: { fr: 'Guide McGill (droit, Canada)', en: 'McGill Guide (law, Canada)' }, hint: { fr: 'Times 12 · 1,5 · notes de bas de page · justifié', en: 'Times 12 · 1.5 · footnotes · justified' },
    size: 'letter', m: [2.5, 2.5, 2.5, 2.5], font: 'Times New Roman', pt: 12, line: 1.5, indent: 0, after: 12, align: 'justify', heads: 'plain', num: 'bc', title: 'qc',
    parts: [[-1, '', ''], [0, '', ''], ...p('Introduction|I. [Première partie]|II. [Deuxième partie]|Conclusion|Bibliographie (législation, jurisprudence, doctrine)', 'Introduction|I. [First part]|II. [Second part]|Conclusion|Bibliography (legislation, jurisprudence, secondary sources)')] },
  { id: 'oscola', name: { fr: 'OSCOLA (droit, Royaume-Uni)', en: 'OSCOLA (law, UK)' }, hint: { fr: 'Times 12 · 1,5 · A4 · notes de bas de page', en: 'Times 12 · 1.5 · A4 · footnotes' },
    size: 'a4', m: [2.54, 2.54, 2.54, 2.54], font: 'Times New Roman', pt: 12, line: 1.5, indent: 0, after: 12, align: 'justify', heads: 'plain', num: 'bc', title: 'report',
    parts: p('Introduction|[Analyse]|Conclusion|Bibliographie', 'Introduction|[Analysis]|Conclusion|Bibliography') },
  { id: 'bluebook', name: { fr: 'Bluebook (droit, États-Unis)', en: 'Bluebook (law, US)' }, hint: { fr: 'Times 12 · double · notes de bas de page', en: 'Times 12 · double · footnotes' },
    size: 'letter', m: [2.54, 2.54, 2.54, 2.54], font: 'Times New Roman', pt: 12, line: 2, indent: 36, after: 0, align: 'left', heads: 'plain', num: 'bc', title: 'apa',
    parts: p('Introduction|I. [Background]|II. [Analysis]|Conclusion', 'Introduction|I. Background|II. Analysis|Conclusion') },
  { id: 'ama', name: { fr: 'AMA (médecine)', en: 'AMA (medicine)' }, hint: { fr: 'Arial 12 · double · références numérotées', en: 'Arial 12 · double · numbered references' },
    size: 'letter', m: [2.54, 2.54, 2.54, 2.54], font: 'Arial', pt: 12, line: 2, indent: 0, after: 12, align: 'left', heads: 'plain', num: 'tr', title: 'apaPro', parts: IMRAD },
  { id: 'acs', name: { fr: 'ACS (chimie)', en: 'ACS (chemistry)' }, hint: { fr: 'Times 12 · double · IMRaD', en: 'Times 12 · double · IMRaD' },
    size: 'letter', m: [2.54, 2.54, 2.54, 2.54], font: 'Times New Roman', pt: 12, line: 2, indent: 36, after: 0, align: 'left', heads: 'plain', num: 'br', title: 'apaPro',
    parts: p('Résumé|Introduction|Partie expérimentale|Résultats et discussion|Conclusion|Références', 'Abstract|Introduction|Experimental section|Results and discussion|Conclusions|References') },
  { id: 'cse', name: { fr: 'CSE (biologie)', en: 'CSE (biology)' }, hint: { fr: 'Times 12 · double · IMRaD', en: 'Times 12 · double · IMRaD' },
    size: 'letter', m: [2.54, 2.54, 2.54, 2.54], font: 'Times New Roman', pt: 12, line: 2, indent: 36, after: 0, align: 'left', heads: 'plain', num: 'br', title: 'apaPro', parts: IMRAD },
  { id: 'asa', name: { fr: 'ASA (sociologie)', en: 'ASA (sociology)' }, hint: { fr: 'Times 12 · double · titre en majuscules', en: 'Times 12 · double · caps headings' },
    size: 'letter', m: [2.54, 2.54, 2.54, 2.54], font: 'Times New Roman', pt: 12, line: 2, indent: 36, after: 0, align: 'left', heads: 'caps', num: 'tr', title: 'apaPro', parts: [...IMRAD.slice(0, -1), [1, 'Références', 'References']] },
  { id: 'commentary', name: { fr: 'Commentaire de texte (France)', en: 'Text commentary (France)' }, hint: { fr: 'Times 12 · 1,5 · intro, deux axes, conclusion', en: 'Times 12 · 1.5 · intro, two axes, conclusion' },
    size: 'a4', m: [2.5, 2.5, 2.5, 2.5], font: 'Times New Roman', pt: 12, line: 1.5, indent: 28, after: 6, align: 'justify', heads: 'plain', num: 'bc', title: 'school',
    parts: p('Introduction|I. [Premier axe]|II. [Deuxième axe]|Conclusion', 'Introduction|I. [First axis]|II. [Second axis]|Conclusion') },
  { id: 'synthesis', name: { fr: 'Note de synthèse', en: 'Synthesis note' }, hint: { fr: 'Arial 11 · 1,15 · A4 · plan en deux parties', en: 'Arial 11 · 1.15 · A4 · two-part plan' },
    size: 'a4', m: [2.5, 2.5, 2.5, 2.5], font: 'Arial', pt: 11, line: 1.15, indent: 0, after: 8, align: 'justify', heads: 'plain', num: 'bc', title: 'none',
    parts: p('[Titre]|Introduction|I. [Première partie]|II. [Deuxième partie]|Conclusion', '[Title]|Introduction|I. [First part]|II. [Second part]|Conclusion') },
  { id: 'readingSheet', name: { fr: 'Fiche de lecture', en: 'Reading sheet' }, hint: { fr: 'Calibri 11 · 1,15 · auteur, thèmes, avis', en: 'Calibri 11 · 1.15 · author, themes, opinion' },
    size: 'letter', m: [2, 2, 2, 2], font: 'Calibri', pt: 11, line: 1.15, indent: 0, after: 8, align: 'left', heads: 'plain', num: null, title: 'none',
    parts: p("Référence complète|L'auteur|Résumé|Thèmes et idées principales|Citations marquantes|Mon avis", 'Full reference|The author|Summary|Main themes and ideas|Key quotes|My opinion') },
  { id: 'critical', name: { fr: 'Résumé critique', en: 'Critical summary' }, hint: { fr: 'Times 12 · 1,5 · résumé puis critique', en: 'Times 12 · 1.5 · summary then critique' },
    size: 'letter', m: [2.5, 2.5, 2.5, 2.5], font: 'Times New Roman', pt: 12, line: 1.5, indent: 36, after: 0, align: 'justify', heads: 'provost', num: 'tr', title: 'qc',
    parts: p('Introduction|Résumé du texte|Critique|Conclusion|Référence', 'Introduction|Summary of the text|Critique|Conclusion|Reference') },
  { id: 'project', name: { fr: 'Rapport de projet (génie)', en: 'Project report (engineering)' }, hint: { fr: 'Arial 11 · 1,15 · cahier des charges, conception, essais', en: 'Arial 11 · 1.15 · requirements, design, tests' },
    size: 'letter', m: [2.5, 2.5, 2.5, 2.5], font: 'Arial', pt: 11, line: 1.15, indent: 0, after: 8, align: 'justify', heads: 'plain', num: 'br', title: 'report',
    parts: [[1, 'Sommaire', 'Summary'], [0, '', ''], [-1, '', ''], [0, '', ''], ...p('1. Introduction|2. Cahier des charges|3. Conception|4. Réalisation|5. Essais et résultats|6. Coûts et échéancier|7. Conclusion et recommandations|Références|Annexes', '1. Introduction|2. Requirements|3. Design|4. Build|5. Tests and results|6. Costs and timeline|7. Conclusion and recommendations|References|Appendices')] },
  { id: 'business', name: { fr: "Plan d'affaires", en: 'Business plan' }, hint: { fr: 'Calibri 11 · 1,15 · marché, stratégie, finances', en: 'Calibri 11 · 1.15 · market, strategy, finances' },
    size: 'letter', m: [2.5, 2.5, 2.5, 2.5], font: 'Calibri', pt: 11, line: 1.15, indent: 0, after: 8, align: 'left', heads: 'plain', num: 'br', title: 'report',
    parts: [[1, 'Sommaire exécutif', 'Executive summary'], [0, '', ''], [-1, '', ''], [0, '', ''], ...p("L'entreprise|Produits et services|Étude de marché|Concurrence|Stratégie marketing|Opérations|Équipe|Prévisions financières|Annexes", 'The company|Products and services|Market study|Competition|Marketing strategy|Operations|Team|Financial forecast|Appendices')] },
  { id: 'bachelor', name: { fr: 'Mémoire de licence / baccalauréat', en: "Bachelor's thesis" }, hint: { fr: 'Times 12 · 1,5 · reliure 3 cm', en: 'Times 12 · 1.5 · 3 cm binding' },
    size: 'a4', m: [2.5, 2.5, 2.5, 3], font: 'Times New Roman', pt: 12, line: 1.5, indent: 28, after: 6, align: 'justify', heads: 'plain', num: 'bc', title: 'thesis', parts: THESIS },
  { id: 'poster', name: { fr: 'Résumé de communication (colloque)', en: 'Conference abstract' }, hint: { fr: 'Times 12 · simple · 300 mots', en: 'Times 12 · single · 300 words' },
    size: 'letter', m: [2.54, 2.54, 2.54, 2.54], font: 'Times New Roman', pt: 12, line: 1, indent: 0, after: 8, align: 'justify', heads: 'plain', num: null, title: 'none',
    parts: p('[Titre de la communication]|Auteurs et affiliations|Résumé (300 mots)|Mots-clés', '[Title of the talk]|Authors and affiliations|Abstract (300 words)|Keywords') },
];

const CM = 2.54;
/** The page margins in inches, as Letter keeps them. */
export const workMargins = (w: WorkLayout) => ({ top: w.m[0] / CM, right: w.m[1] / CM, bottom: w.m[2] / CM, left: w.m[3] / CM });

/** The document's styles for a norm: body text, then headings in the norm's look (black, the body's font). */
export function workStyles(st: DocStyles, w: WorkLayout): DocStyles {
  const base: StyleDef = { font: w.font, size: w.pt, color: '#000000', lineHeight: w.line, letterSpacing: 0, caps: false };
  const sp = w.line >= 1.5 ? 0 : 6;
  const h = (d: StyleDef): StyleDef => ({ ...base, bold: true, italic: false, before: sp + 6, after: sp + 6, indent: 0, ...d });
  const look: Record<Heads, [StyleDef, StyleDef, StyleDef, StyleDef, StyleDef]> = {
    provost: [h({ align: 'center' }), h({ align: 'left' }), h({ align: 'left', indent: 36 }), h({ align: 'left', indent: 36, italic: true }), h({ align: 'left', indent: 36, bold: false, italic: true })],
    apa: [h({ align: 'center' }), h({ align: 'left' }), h({ align: 'left', italic: true }), h({ align: 'left', indent: 36 }), h({ align: 'left', indent: 36, italic: true })],
    mla: [h({ align: 'left' }), h({ align: 'left', italic: true }), h({ align: 'left', bold: false, italic: true }), h({ align: 'left', bold: false }), h({ align: 'left', bold: false })],
    plain: [h({ size: w.pt + 2 }), h({}), h({ italic: true }), h({ bold: false, italic: true }), h({ bold: false })],
    caps: [h({ align: 'center', caps: true, bold: false, size: w.pt }), h({ italic: true, bold: false }), h({ italic: true, bold: false, indent: 14 }), h({ bold: false }), h({ bold: false })],
  };
  const [h1, h2, h3, h4, h5] = look[w.heads];
  return {
    ...st,
    normal: { ...base, bold: undefined, italic: undefined, before: 0, after: w.after, align: w.align, indent: w.indent || undefined },
    title: { ...base, size: w.pt + 4, bold: true, align: 'center', before: 0, after: 12 },
    subtitle: { ...base, align: 'center', after: 12 },
    h1, h2, h3, h4, h5, h6: h5,
  };
}

// ---------- the parts, ready for the editor ----------

const FIELD = /\[([^[\]\n]{1,120})\]/g;
function text(s: string, bold = false): JSONContent[] {
  const out: JSONContent[] = [];
  const marks = bold ? [{ type: 'bold' }] : [];
  let at = 0;
  for (const m of s.matchAll(FIELD)) {
    if (m.index > at) out.push({ type: 'text', text: s.slice(at, m.index), ...(bold ? { marks } : {}) });
    out.push({ type: 'text', text: m[0], marks: [...marks, { type: 'highlight', attrs: { color: FIELD_COLOR } }] });
    at = m.index + m[0].length;
  }
  if (at < s.length) out.push({ type: 'text', text: s.slice(at), ...(bold ? { marks } : {}) });
  return out;
}
const line = (s: string, attrs: Record<string, unknown> = {}, bold = false): JSONContent => {
  const content = text(s, bold);
  return { type: 'paragraph', attrs: { textAlign: 'center', indentFirst: 0, ...attrs }, ...(content.length ? { content } : {}) };
};
const gap = (n: number) => Array.from({ length: n }, () => line(''));

/** The text that marks where the table of contents goes, until Letter fills it in. */
export const TOC_MARK = '⟦TOC⟧';

function titlePage(w: WorkLayout, fr: boolean, date: string): JSONContent[] {
  const T = (a: string, b: string) => (fr ? a : b);
  const brk: JSONContent = { type: 'pageBreak' };
  switch (w.title) {
    case 'qc': return [
      line(T('[Prénom Nom]', '[First Last name]')), line(T("[Numéro d'étudiant]", '[Student number]')), ...gap(5),
      line(T('[TITRE DU TRAVAIL]', '[TITLE OF THE PAPER]'), {}, true), ...gap(5),
      line(T('Travail présenté à', 'Paper presented to')), line(T('[Nom du professeur ou de la professeure]', '[Name of the professor]')), ...gap(1),
      line(T('dans le cadre du cours', 'for the course')), line(T('[SIGLE – Titre du cours]', '[CODE – Course title]')), ...gap(5),
      line(T('[Établissement]', '[Institution]')), line(date), brk];
    case 'apa': return [...gap(4),
      line(T('[Titre du travail]', '[Title of the paper]'), {}, true), ...gap(1),
      line(T('[Prénom Nom]', '[First Last name]')), line(T('[Département, Université]', '[Department, University]')),
      line(T('[SIGLE : Titre du cours]', '[CODE: Course title]')), line(T('[Nom du professeur ou de la professeure]', '[Instructor name]')), line(date), brk];
    case 'apaPro': return [...gap(4),
      line(T('[Titre de l’article]', '[Title of the article]'), {}, true), ...gap(1),
      line(T('[Auteur 1], [Auteur 2]', '[Author 1], [Author 2]')), line(T('[Affiliation]', '[Affiliation]')), ...gap(2),
      line(T('Note de l’auteur', 'Author note'), {}, true), line(T('[Coordonnées et remerciements]', '[Contact details and acknowledgements]'), { textAlign: 'left' }), brk];
    case 'mla': return [
      line(T('[Prénom Nom]', '[First Last name]'), { textAlign: 'left' }), line(T('[Nom du professeur]', '[Instructor name]'), { textAlign: 'left' }),
      line(T('[Cours]', '[Course]'), { textAlign: 'left' }), line(date, { textAlign: 'left' }), line(T('[Titre du travail]', '[Title of the paper]'))];
    case 'school': return [
      line(T('[Prénom Nom]', '[First Last name]')), line(T('[Groupe]', '[Group]')), ...gap(6),
      line(T('[Titre du travail]', '[Title of the assignment]'), {}, true), line(T('[Matière]', '[Subject]')), ...gap(6),
      line(T('Travail présenté à', 'Presented to')), line(T('[Nom de l’enseignant ou de l’enseignante]', '[Teacher name]')), ...gap(4),
      line(T('[École]', '[School]')), line(date), brk];
    case 'thesis': return [
      line(T('[ÉTABLISSEMENT]', '[INSTITUTION]')), ...gap(5),
      line(T('[TITRE DU MÉMOIRE OU DE LA THÈSE]', '[TITLE OF THE THESIS]'), {}, true), ...gap(3),
      line(T('par', 'by')), line(T('[Prénom Nom]', '[First Last name]')), ...gap(3),
      line(T('[Mémoire présenté en vue de l’obtention du grade de maître ès (M.)]', '[Thesis submitted for the degree of Master of (M.)]')),
      line(T('[Programme]', '[Program]')), ...gap(3), line(T('Sous la direction de [Nom du directeur ou de la directrice]', 'Supervised by [Name of the supervisor]')), ...gap(3), line(date), brk];
    case 'report': return [...gap(6),
      line(T('[Titre du rapport]', '[Title of the report]'), {}, true), line(T('[Sous-titre]', '[Subtitle]')), ...gap(6),
      line(T('[Prénom Nom]', '[First Last name]')), line(T('[Cours ou organisation]', '[Course or organization]')), line(date), brk];
    default: return [];
  }
}

/** The whole document for a norm, in French or English: title page, then the parts in order. */
export function workDoc(w: WorkLayout, lang: 'fr' | 'en', date: string): JSONContent[] {
  const fr = lang === 'fr';
  const out = titlePage(w, fr, date);
  const say = fr ? '[Votre texte…]' : '[Your text…]';
  for (const [level, a, b] of w.parts) {
    if (level === 0) { if (out.length && out[out.length - 1].type !== 'pageBreak') out.push({ type: 'pageBreak' }); continue; }
    if (level === -1) {
      out.push({ type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [{ type: 'text', text: fr ? 'Table des matières' : 'Table of contents' }] });
      out.push({ type: 'paragraph', attrs: { indentFirst: 0 }, content: [{ type: 'text', text: TOC_MARK }] });
      continue;
    }
    out.push({ type: 'heading', attrs: { level }, content: text(fr ? a : b) });
    out.push({ type: 'paragraph', content: text(say) });
  }
  return out;
}
