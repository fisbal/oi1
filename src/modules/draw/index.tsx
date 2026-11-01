import { createRoot } from 'react-dom/client';
import type { OI1Module } from '../../shell/contract';
import Draw, { EXTENSIONS } from './Draw';
import './draw.css';

// In 1 Draw: free drawing, shapes, diagrams and AI drawing, on every screen.
const drawApp: OI1Module = {
  id: 'draw',
  extensions: EXTENSIONS,
  mount(el, shell, file, handoff) {
    const root = createRoot(el);
    root.render(<Draw shell={shell} file={file} handoff={handoff} />);
    return { unmount: () => root.unmount() };
  },
};

export default drawApp;
