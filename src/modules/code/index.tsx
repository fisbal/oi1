import { createRoot } from 'react-dom/client';
import type { OI1Module } from '../../shell/contract';
import Code, { EXTENSIONS } from './Code';
import './code.css';

// In 1 Code+: websites and apps written, run and published from the browser.
const codeApp: OI1Module = {
  id: 'code',
  extensions: EXTENSIONS,
  mount(el, shell, file, handoff) {
    const root = createRoot(el);
    root.render(<Code shell={shell} file={file} handoff={handoff} />);
    return { unmount: () => root.unmount() };
  },
};

export default codeApp;
