// Ready pages for In 1 Notes (meeting, lecture, journal, recipe, travel…). Each is built in English or French; other
// languages are translated on the device when a translator is there (see Notes.tsx), otherwise English is used.

export interface NoteTemplate { id: string; icon: string; paper?: 'lines' | 'grid' | 'cornell' | 'dots' | 'plain'; build: (w: (t: [string, string]) => string, today: string) => { title: string; html: string } }

const task = (s: string) => `<li data-type="taskItem" data-checked="false"><p>${s}</p></li>`;
const tasks = (items: string[]) => `<ul data-type="taskList">${items.map(task).join('')}</ul>`;
const ul = (items: string[]) => `<ul>${items.map(s => `<li><p>${s}</p></li>`).join('')}</ul>`;
const ol = (items: string[]) => `<ol>${items.map(s => `<li><p>${s}</p></li>`).join('')}</ol>`;
const h = (n: number, s: string) => `<h${n}>${s}</h${n}>`;
const p = (s = '') => `<p>${s}</p>`;
const table = (head: string[], rows: number) =>
  `<table><tbody><tr>${head.map(c => `<th><p>${c}</p></th>`).join('')}</tr>${Array.from({ length: rows }, () => `<tr>${head.map(() => '<td><p></p></td>').join('')}</tr>`).join('')}</tbody></table>`;

export const NOTE_TEMPLATES: NoteTemplate[] = [
  { id: 'meeting', icon: '🤝', build: (w, d) => ({ title: `${w(['Meeting', 'Réunion'])} ${d}`, html:
    h(2, w(['Attendees', 'Participants'])) + ul(['']) + h(2, w(['Agenda', 'Ordre du jour'])) + ol(['']) + h(2, w(['Notes', 'Notes'])) + p() +
    h(2, w(['Decisions', 'Décisions'])) + ul(['']) + h(2, w(['Actions', 'Actions'])) + tasks([w(['Who does what, by when', 'Qui fait quoi, pour quand'])]) }) },
  { id: 'lecture', icon: '🎓', paper: 'lines', build: (w, d) => ({ title: `${w(['Class', 'Cours'])} ${d}`, html:
    h(2, w(['Subject', 'Sujet'])) + p() + h(2, w(['Key ideas', 'Idées clés'])) + ul(['']) + h(2, w(['Words to know', 'Mots à retenir'])) +
    p(w(['word :: meaning', 'mot :: définition'])) + h(2, w(['Questions', 'Questions'])) + p('❓ ') + h(2, w(['Homework', 'Devoirs'])) + tasks(['']) }) },
  { id: 'cornell', icon: '📐', paper: 'cornell', build: w => ({ title: w(['Cornell notes', 'Notes Cornell']), html:
    table([w(['Cues / questions', 'Mots-clés / questions']), w(['Notes', 'Notes'])], 6) + h(2, w(['Summary', 'Résumé'])) + p() }) },
  { id: 'todo', icon: '✅', build: (w, d) => ({ title: `${w(['To do', 'À faire'])} ${d}`, html:
    h(2, w(['Today', 'Aujourd’hui'])) + tasks(['', '', '']) + h(2, w(['This week', 'Cette semaine'])) + tasks(['']) + h(2, w(['Someday', 'Un jour'])) + tasks(['']) }) },
  { id: 'journal', icon: '📔', paper: 'lines', build: (w, d) => ({ title: d, html:
    h(2, w(['How I feel', 'Comment je me sens'])) + p() + h(2, w(['What happened', 'Ce qui s’est passé'])) + p() +
    h(2, w(['Three good things', 'Trois bonnes choses'])) + ol(['', '', '']) + h(2, w(['Tomorrow', 'Demain'])) + p() }) },
  { id: 'gratitude', icon: '🙏', build: (w, d) => ({ title: `${w(['Gratitude', 'Gratitude'])} ${d}`, html:
    p(w(['Today I am thankful for:', 'Aujourd’hui je suis reconnaissant pour :'])) + ol(['', '', '', '', '']) + h(2, w(['A kind thing I did', 'Une gentillesse que j’ai faite'])) + p() }) },
  { id: 'week', icon: '🗓️', paper: 'grid', build: w => ({ title: w(['Week plan', 'Plan de la semaine']), html:
    table([w(['Day', 'Jour']), w(['Plans', 'Prévu']), w(['Done', 'Fait'])], 0).replace('</tbody>', [['Monday', 'Lundi'], ['Tuesday', 'Mardi'], ['Wednesday', 'Mercredi'], ['Thursday', 'Jeudi'], ['Friday', 'Vendredi'], ['Saturday', 'Samedi'], ['Sunday', 'Dimanche']]
      .map(x => `<tr><td><p>${w(x as [string, string])}</p></td><td><p></p></td><td><p></p></td></tr>`).join('') + '</tbody>') + h(2, w(['Goals of the week', 'Objectifs de la semaine'])) + tasks(['', '', '']) }) },
  { id: 'project', icon: '🗂️', build: w => ({ title: w(['Project', 'Projet']), html:
    h(2, w(['Goal', 'Objectif'])) + p() + h(2, w(['Why', 'Pourquoi'])) + p() + h(2, w(['Steps', 'Étapes'])) + tasks(['', '', '']) +
    h(2, w(['People', 'Personnes'])) + ul(['']) + h(2, w(['Risks', 'Risques'])) + p('⚠️ ') + h(2, w(['Deadline', 'Échéance'])) + p('📅 ') }) },
  { id: 'brainstorm', icon: '💡', paper: 'dots', build: w => ({ title: w(['Brainstorm', 'Remue-méninges']), html:
    h(2, w(['Question', 'Question'])) + p() + h(2, w(['All the ideas (no judging)', 'Toutes les idées (sans juger)'])) + ul(['💡 ', '💡 ', '💡 ']) +
    h(2, w(['Best three', 'Les trois meilleures'])) + ol(['', '', '']) + h(2, w(['Next step', 'Prochaine étape'])) + tasks(['']) }) },
  { id: 'proscons', icon: '⚖️', build: w => ({ title: w(['Pros and cons', 'Pour et contre']), html:
    h(2, w(['Choice', 'Choix'])) + p() + table([w(['Pros', 'Pour']), w(['Cons', 'Contre'])], 5) + h(2, w(['Decision', 'Décision'])) + p() }) },
  { id: 'swot', icon: '🧭', build: w => ({ title: 'SWOT', html:
    `<table><tbody><tr><th><p>${w(['Strengths', 'Forces'])}</p></th><th><p>${w(['Weaknesses', 'Faiblesses'])}</p></th></tr><tr><td><p></p></td><td><p></p></td></tr>` +
    `<tr><th><p>${w(['Opportunities', 'Opportunités'])}</p></th><th><p>${w(['Threats', 'Menaces'])}</p></th></tr><tr><td><p></p></td><td><p></p></td></tr></tbody></table>` }) },
  { id: 'goals', icon: '🎯', build: w => ({ title: w(['My goals', 'Mes objectifs']), html:
    h(2, w(['This year', 'Cette année'])) + tasks(['', '', '']) + h(2, w(['This month', 'Ce mois-ci'])) + tasks(['', '']) + h(2, w(['Why it matters', 'Pourquoi c’est important'])) + p() }) },
  { id: 'habits', icon: '📈', paper: 'grid', build: w => ({ title: w(['Habit tracker', 'Suivi des habitudes']), html:
    table([w(['Habit', 'Habitude']), w(['Mon', 'Lun']), w(['Tue', 'Mar']), w(['Wed', 'Mer']), w(['Thu', 'Jeu']), w(['Fri', 'Ven']), w(['Sat', 'Sam']), w(['Sun', 'Dim'])], 5) }) },
  { id: 'recipe', icon: '🍳', build: w => ({ title: w(['Recipe', 'Recette']), html:
    p(w(['For 4 people · 30 minutes', 'Pour 4 personnes · 30 minutes'])) + h(2, w(['Ingredients', 'Ingrédients'])) + tasks(['', '', '']) +
    h(2, w(['Steps', 'Étapes'])) + ol(['', '', '']) + h(2, w(['Tips', 'Astuces'])) + p('💡 ') }) },
  { id: 'shopping', icon: '🛒', build: w => ({ title: w(['Shopping list', 'Liste de courses']), html:
    h(3, w(['Fruit and vegetables', 'Fruits et légumes'])) + tasks(['']) + h(3, w(['Fridge', 'Frigo'])) + tasks(['']) + h(3, w(['Cupboard', 'Placard'])) + tasks(['']) + h(3, w(['House', 'Maison'])) + tasks(['']) }) },
  { id: 'travel', icon: '✈️', build: w => ({ title: w(['Trip', 'Voyage']), html:
    h(2, w(['Where and when', 'Où et quand'])) + p('📅 ') + h(2, w(['Tickets and bookings', 'Billets et réservations'])) + tasks(['', '']) +
    h(2, w(['Places to see', 'À visiter'])) + ul(['']) + h(2, w(['Budget', 'Budget'])) + table([w(['What', 'Quoi']), w(['Cost', 'Coût'])], 4) }) },
  { id: 'packing', icon: '🧳', build: w => ({ title: w(['Packing list', 'Liste de bagages']), html:
    h(3, w(['Papers', 'Papiers'])) + tasks([w(['Passport / ID', 'Passeport / carte d’identité']), w(['Tickets', 'Billets'])]) + h(3, w(['Clothes', 'Vêtements'])) + tasks(['', '']) +
    h(3, w(['Toiletries', 'Toilette'])) + tasks(['']) + h(3, w(['Electronics', 'Électronique'])) + tasks([w(['Phone charger', 'Chargeur de téléphone'])]) }) },
  { id: 'reading', icon: '📚', paper: 'lines', build: w => ({ title: w(['Book notes', 'Notes de lecture']), html:
    p(w(['Title · Author', 'Titre · Auteur'])) + h(2, w(['In one sentence', 'En une phrase'])) + p() + h(2, w(['Ideas I keep', 'Idées que je garde'])) + ul(['']) +
    h(2, w(['Quotes', 'Citations'])) + '<blockquote><p></p></blockquote>' + h(2, w(['My opinion', 'Mon avis'])) + p('⭐⭐⭐⭐☆') }) },
  { id: 'study', icon: '🧠', build: w => ({ title: w(['Study cards', 'Fiches de révision']), html:
    p(w(['Write one card per line: question :: answer. Then use Study mode.', 'Une fiche par ligne : question :: réponse. Puis utilisez le mode Réviser.'])) +
    p(w(['Capital of France :: Paris', 'Capitale de la France :: Paris'])) + p(w(['2 × 8 :: 16', '2 × 8 :: 16'])) + p() }) },
  { id: 'interview', icon: '🎤', build: w => ({ title: w(['Interview', 'Entretien']), html:
    p(w(['Person · Role · Date', 'Personne · Poste · Date'])) + h(2, w(['Questions', 'Questions'])) + ol(['', '', '']) + h(2, w(['Answers', 'Réponses'])) + p() + h(2, w(['Impression', 'Impression'])) + p() }) },
  { id: 'call', icon: '📞', build: (w, d) => ({ title: `${w(['Phone call', 'Appel'])} ${d}`, html:
    p(w(['With · Number', 'Avec · Numéro'])) + h(2, w(['Why', 'Motif'])) + p() + h(2, w(['What was said', 'Ce qui a été dit'])) + p() + h(2, w(['Follow-up', 'Suites'])) + tasks(['']) }) },
  { id: 'bug', icon: '🐞', build: w => ({ title: w(['Problem report', 'Rapport de problème']), html:
    h(2, w(['What happens', 'Ce qui se passe'])) + p() + h(2, w(['Steps to see it', 'Étapes pour le voir'])) + ol(['', '']) + h(2, w(['What should happen', 'Ce qui devrait se passer'])) + p() + h(2, w(['Device', 'Appareil'])) + p() }) },
  { id: 'workout', icon: '💪', paper: 'grid', build: (w, d) => ({ title: `${w(['Workout', 'Entraînement'])} ${d}`, html:
    table([w(['Exercise', 'Exercice']), w(['Sets', 'Séries']), w(['Reps', 'Répétitions']), w(['Weight', 'Poids'])], 5) + h(2, w(['How it went', 'Ressenti'])) + p() }) },
  { id: 'budget', icon: '💰', build: w => ({ title: w(['Month budget', 'Budget du mois']), html:
    table([w(['Income / expense', 'Revenu / dépense']), w(['Planned', 'Prévu']), w(['Real', 'Réel'])], 6) + p(w(['Tip: send this table to In 1 Class to calculate it.', 'Astuce : envoyez ce tableau à In 1 Class pour le calculer.'])) }) },
  { id: 'contacts', icon: '👥', build: w => ({ title: w(['Contacts', 'Contacts']), html:
    table([w(['Name', 'Nom']), w(['Phone', 'Téléphone']), w(['Email', 'Courriel']), w(['Notes', 'Notes'])], 5) }) },
];
