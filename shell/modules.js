// The list of modules the shell knows about.
// To add a module: create modules/<id>/index.js that follows the contract
// (see docs/module-contract.md), then add one line here.
export const modules = [
  { id: 'letter',  name: 'Office Letter',  kind: 'Documents',     color: '#2b579a', load: () => import('../modules/letter/index.js') },
  { id: 'class',   name: 'Office Class',   kind: 'Spreadsheets',  color: '#217346', load: null },
  { id: 'stage',   name: 'Office Stage',   kind: 'Presentations', color: '#b7472a', load: null },
  { id: 'prodfos', name: 'Office ProDFos', kind: 'PDF tools',     color: '#a4262c', load: null },
];
