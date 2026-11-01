import { createRoot } from 'react-dom/client';
import type { OI1Module } from '../../shell/contract';
import Stage, { EXTENSIONS } from './Stage';
import './stage.css';

// In 1 Stage: presentations, with OI1's own .pptx reader and writer.
const stageApp: OI1Module = {
  id: 'stage',
  extensions: EXTENSIONS,
  mount(el, shell, file, handoff) {
    const root = createRoot(el);
    root.render(<Stage shell={shell} file={file} handoff={handoff} />);
    return { unmount: () => root.unmount() };
  },
};

export default stageApp;
