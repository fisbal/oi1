// Shared by the promo pages (video.html, guide.html, index.html) and the install page (../get/).
// Everything that changes with the app (version, ready apps, screenshots) comes from info.json,
// which scripts/promo.mjs writes from the real app at every build. Links come from config.json.
(function () {
  const here = document.currentScript ? new URL('.', document.currentScript.src).href : './';

  const FEATURES = {
    Letter: { fr: ['Ouvre et garde vos .docx', 'Correcteur en 5 langues', '35 lettres et 20 CV prêts'],
              en: ['Opens and keeps your .docx', 'Spell check in 5 languages', '35 letters and 20 CVs ready'] },
    Class: { fr: ['440+ fonctions de tableur', 'Graphiques et fichiers .xlsx', 'Valeur cible, Solveur'],
             en: ['440+ spreadsheet functions', 'Charts and .xlsx files', 'Goal Seek, Solver'] },
    Stage: { fr: ['Thèmes et animations', 'Fichiers .pptx', 'S’adapte à votre public'],
             en: ['Themes and animations', '.pptx files', 'Adapts to your audience'] },
    Assistant: { fr: ['Dites-le en mots simples', 'Il crée les documents liés', 'Avec ou sans IA'],
                 en: ['Say it in plain words', 'It makes the linked documents', 'With or without AI'] },
    Plan: { fr: ['Tableau, grille, échéancier', 'Agenda et tâches', '22 plans prêts'],
            en: ['Board, grid, timeline', 'Calendar and tasks', '22 ready plans'] },
    Notes: { fr: ['Notes rapides', 'Téléphone, tablette, PC', 'Avec ou sans IA'],
             en: ['Quick notes', 'Phone, tablet, PC', 'With or without AI'] },
    Draw: { fr: ['Diagrammes et croquis', 'Téléphone, tablette, PC', 'Images PNG, JPG, SVG'],
            en: ['Diagrams and sketches', 'Phone, tablet, PC', 'PNG, JPG, SVG pictures'] },
    Form: { fr: ['Formulaires, sondages, quiz', '23 sortes de questions', 'Réponses et résultats'],
            en: ['Forms, surveys, quizzes', '23 kinds of questions', 'Answers and results'] },
    'Code+': { fr: ['Sites web et applis', 'Aperçu en direct', 'Publiez en un clic'],
               en: ['Websites and apps', 'Live preview', 'Publish in one click'] },
  };

  const T = {
    fr: {
      tagline: 'Tout votre bureau. Une seule app.',
      count: n => `${n} applis.<br><b>1</b> seul endroit.`,
      soonLine: (r, s) => `${r} prêtes aujourd’hui · ${s} bientôt`,
      countSub: 'Fini de sauter d’un logiciel à l’autre.',
      linkedTitle: 'Tout est <b>lié</b>.',
      linkedSub: 'Un tableau de Class dans votre lettre se met à jour tout seul.',
      everywhereTitle: 'Partout avec <b>vous</b>.',
      perks: ['Se met à jour tout seul', 'Enregistré sur votre appareil', '5 langues', 'Fonctionne hors ligne'],
      scan: 'Scannez pour installer',
      store: 'Disponible sur', storeName: 'Microsoft Store',
      orVisit: 'ou visitez',
      soon: 'Bientôt',
      pause: 'Pause', play: 'Lecture',
    },
    en: {
      tagline: 'Your whole office. One app.',
      count: n => `${n} apps.<br><b>1</b> place.`,
      soonLine: (r, s) => `${r} ready today · ${s} coming soon`,
      countSub: 'No more jumping from one program to another.',
      linkedTitle: 'Everything is <b>linked</b>.',
      linkedSub: 'A Class table in your letter updates by itself.',
      everywhereTitle: 'Everywhere with <b>you</b>.',
      perks: ['Updates itself', 'Saved on your device', '5 languages', 'Works offline'],
      scan: 'Scan to install',
      store: 'Get it from', storeName: 'Microsoft Store',
      orVisit: 'or visit',
      soon: 'Soon',
      pause: 'Pause', play: 'Play',
    },
  };

  const FALLBACK = {
    version: '', apps: {}, shots: {},
    links: {
      store: 'https://apps.microsoft.com/detail/9NW4XQH95MRB', storeApp: 'ms-windows-store://pdp/?productid=9NW4XQH95MRB',
      site: 'https://fisbal.github.io/oi1/', get: 'https://fisbal.github.io/oi1/get/', kit: 'https://fisbal.github.io/oi1/promo/',
      apk: 'https://github.com/fisbal/fisbal.github.io/releases/download/oi1-updates/OfficeIn1.apk',
      exe: 'https://github.com/fisbal/fisbal.github.io/releases/download/oi1-updates/OfficeIn1-Setup.exe',
      dmg: 'https://github.com/fisbal/fisbal.github.io/releases/download/oi1-updates/OfficeIn1.dmg',
    },
  };

  async function json(name) {
    try { const r = await fetch(here + name, { cache: 'no-cache' }); if (r.ok) return await r.json(); } catch { /* offline */ }
    return null;
  }

  /** info.json from the last build, config.json for the links (newer if edited since), defaults otherwise. */
  async function load() {
    const [info, config] = await Promise.all([json('info.json'), json('config.json')]);
    const out = Object.assign({}, FALLBACK, info || {});
    out.links = Object.assign({}, FALLBACK.links, (info && info.links) || {}, config || {});
    for (const key of Object.keys(out.links)) if (key.startsWith('_') || key === 'upcoming') delete out.links[key];
    out.base = here;
    return out;
  }

  function lang() {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'fr' || q === 'en') return q;
    return (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
  }

  const host = url => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

  /** Ready-to-paste texts for each network. {n} = number of ready apps, {apps} = their names, {get} = install page. */
  const CAPTIONS = {
    fr: {
      facebook: 'Lettres, tableurs, présentations, PDF, notes, agenda… {n} applis dans une seule{soon} : Office In 1. 💛\n\nVos fichiers .docx, .xlsx et .pptx s’ouvrent tels quels, tout est lié (un tableau mis à jour dans votre lettre), et l’app se met à jour toute seule sur Windows, Android, Mac et le Web.\n\n👉 Installer : {get}\n🪟 Sur Windows : Microsoft Store\n\n#OfficeIn1 #Productivité #Bureautique #Québec',
      instagram: '{n} applis. 1 seul endroit. ✨\nOffice In 1 réunit {apps}.\n\nOuvre vos .docx, .xlsx et .pptx, fonctionne hors ligne et se met à jour tout seul.\n\n🔗 Lien dans la bio · Microsoft Store\n\n#OfficeIn1 #productivité #bureautique #étudiants #entrepreneur #québec',
      tiktok: 'Toute ma bureautique dans UNE app 🤯 {n} applis en 1{soon} : lettres, tableurs, présentations, PDF… #OfficeIn1 #productivité #astuce #bureautique #québec',
      whatsapp: '*Office In 1* — tout votre bureau dans une seule app 💛\nLettres, tableurs, présentations, PDF, notes et agenda, liés entre eux.\nWindows (Microsoft Store), Android, Mac et Web — mises à jour automatiques.\n\nInstaller : {get}',
    },
    en: {
      facebook: 'Letters, spreadsheets, presentations, PDFs, notes, calendar… {n} apps in one{soon}: Office In 1. 💛\n\nYour .docx, .xlsx and .pptx files open as they are, everything is linked (a table that updates inside your letter), and the app updates itself on Windows, Android, Mac and the Web.\n\n👉 Install: {get}\n🪟 On Windows: Microsoft Store\n\n#OfficeIn1 #Productivity #Office',
      instagram: '{n} apps. 1 place. ✨\nOffice In 1 brings together {apps}.\n\nOpens your .docx, .xlsx and .pptx, works offline and updates itself.\n\n🔗 Link in bio · Microsoft Store\n\n#OfficeIn1 #productivity #office #students #entrepreneur',
      tiktok: 'My whole office in ONE app 🤯 {n} apps in 1{soon}: letters, spreadsheets, slides, PDF… #OfficeIn1 #productivity #techtok #office',
      whatsapp: '*Office In 1* — your whole office in one app 💛\nLetters, spreadsheets, presentations, PDFs, notes and calendar, all linked.\nWindows (Microsoft Store), Android, Mac and Web — updates itself.\n\nInstall: {get}',
    },
  };

  function caption(lang, net, data) {
    const all = data.apps[lang] || data.apps.fr || [];
    const ready = all.filter(a => a.ready), soon = all.filter(a => !a.ready);
    const and = lang === 'fr' ? ' et ' : ' and ';
    const join = names => names.length > 1 ? names.slice(0, -1).join(', ') + and + names[names.length - 1] : names.join('');
    // {n} counts every app of the suite (as on its home screen); the ones still coming are named right after.
    const soonNote = soon.length ? (lang === 'fr' ? ` (${join(soon.map(a => a.name))} : bientôt)` : ` (${join(soon.map(a => a.name))}: coming soon)`) : '';
    return CAPTIONS[lang][net].replaceAll('{n}', String(all.length || 11)).replaceAll('{apps}', join(ready.map(a => a.name)) + soonNote)
      .replaceAll('{soon}', soonNote).replaceAll('{get}', data.links.get);
  }

  window.OI1Kit = { load, lang, T, FEATURES, host, caption };
})();
