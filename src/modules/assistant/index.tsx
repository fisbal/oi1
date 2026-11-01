import { createRoot } from 'react-dom/client';
import type { OI1Module } from '../../shell/contract';
import Assistant from './Assistant';
import './assistant.css';

// Office Assistant: the AI app of Office In 1. Say a task in plain words; it makes the documents in the right
// Offices and links them.
const assistantApp: OI1Module = {
  id: 'assistant',
  extensions: [],
  mount(el, shell, _file, handoff) {
    const root = createRoot(el);
    root.render(<Assistant shell={shell} handoff={handoff} />);
    return { unmount: () => root.unmount() };
  },
};

export default assistantApp;
