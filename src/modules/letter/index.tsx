import { createRoot } from 'react-dom/client';
import type { OI1Module } from '../../shell/contract';
import Letter, { EXTENSIONS } from './Letter';
import './letter.css';

// Office Letter: the word processor, on TipTap (ProseMirror).
const letter: OI1Module = {
  id: 'letter',
  extensions: EXTENSIONS,
  mount(el, shell, file, handoff) {
    const root = createRoot(el);
    root.render(<Letter shell={shell} file={file} handoff={handoff} />);
    return { unmount: () => root.unmount() };
  },
};

export default letter;
