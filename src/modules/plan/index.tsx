import { createRoot } from 'react-dom/client';
import type { OI1Module } from '../../shell/contract';
import PlanApp, { EXTENSIONS } from './Plan';
import './plan.css';

// In 1 Plan: tasks on a board, a grid, a timeline and a calendar, with AI planning, on every screen.
const planApp: OI1Module = {
  id: 'plan',
  extensions: EXTENSIONS,
  mount(el, shell, file, handoff) {
    const root = createRoot(el);
    root.render(<PlanApp shell={shell} file={file} handoff={handoff} />);
    return { unmount: () => root.unmount() };
  },
};

export default planApp;
