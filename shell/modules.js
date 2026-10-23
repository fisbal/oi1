// The list of modules the shell knows about.
// To add a module: create modules/<id>/index.js that follows the contract
// (see docs/module-contract.md), then add one line here.
export const modules = [
  { id: 'letter',    name: 'Office Letter',    kind: 'Documents',          color: '#2b579a', load: () => import('../modules/letter/index.js') },
  { id: 'class',     name: 'Office Class',     kind: 'Spreadsheets',       color: '#217346', load: null },
  { id: 'stage',     name: 'Office Stage',     kind: 'Presentations',      color: '#b7472a', load: null },
  { id: 'prodfos',   name: 'Office ProDFos',   kind: 'PDF tools',          color: '#a4262c', load: null },
  { id: 'assistant', name: 'Office Assistant', kind: 'AI help in every app', color: '#5c2d91', load: null },
  { id: 'notes',     name: 'Office Notes',     kind: 'Quick notes',        color: '#7719aa', load: null },
  { id: 'plan',      name: 'Office Plan',      kind: 'Calendar and tasks', color: '#0078d4', load: null },
  { id: 'mail',      name: 'Office Mail',      kind: 'Email',              color: '#005a9e', load: null },
  { id: 'draw',      name: 'Office Draw',      kind: 'Diagrams and sketches', color: '#c239b3', load: null },
  { id: 'form',      name: 'Office Form',      kind: 'Forms and surveys',  color: '#008272', load: null },
];
