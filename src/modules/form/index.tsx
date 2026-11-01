import { createRoot } from 'react-dom/client';
import type { OI1Module } from '../../shell/contract';
import FormApp, { EXTENSIONS } from './Form';
import './form.css';

// In 1 Form: forms, surveys and quizzes with 23 kinds of questions, answers and results, on every screen.
const formApp: OI1Module = {
  id: 'form',
  extensions: EXTENSIONS,
  mount(el, shell, file, handoff) {
    const root = createRoot(el);
    root.render(<FormApp shell={shell} file={file} handoff={handoff} />);
    return { unmount: () => root.unmount() };
  },
};

export default formApp;
