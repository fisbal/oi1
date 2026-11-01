import { createRoot } from 'react-dom/client';
import type { OI1Module } from '../../shell/contract';
import MailApp, { EXTENSIONS } from './Mail';
import './mail.css';

// In 1 Mail: write, reply, templates, mail merge and contacts; sends through the phone or PC mail app, Gmail, Outlook or a .eml file.
const mailApp: OI1Module = {
  id: 'mail',
  extensions: EXTENSIONS,
  mount(el, shell, file, handoff) {
    const root = createRoot(el);
    root.render(<MailApp shell={shell} file={file} handoff={handoff} />);
    return { unmount: () => root.unmount() };
  },
};

export default mailApp;
