import { createRoot } from 'react-dom/client';
import type { OI1Module } from '../../shell/contract';
import Notes, { EXTENSIONS } from './Notes';
import './notes.css';

// In 1 Notes: notebooks, sections and pages, to-dos, tags, sketches, study cards and AI, on every screen.
const notesApp: OI1Module = {
  id: 'notes',
  extensions: EXTENSIONS,
  mount(el, shell, file, handoff) {
    const root = createRoot(el);
    root.render(<Notes shell={shell} file={file} handoff={handoff} />);
    return { unmount: () => root.unmount() };
  },
};

export default notesApp;
