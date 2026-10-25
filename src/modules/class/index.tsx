import { createRoot } from 'react-dom/client';
import type { OI1Module } from '../../shell/contract';
import Class, { EXTENSIONS } from './Class';
import './class.css';

// Office Class: the spreadsheet, with OI1's own formula engine and .xlsx reader and writer.
const sheetApp: OI1Module = {
  id: 'class',
  extensions: EXTENSIONS,
  mount(el, shell, file, handoff) {
    const root = createRoot(el);
    root.render(<Class shell={shell} file={file} handoff={handoff} />);
    return { unmount: () => root.unmount() };
  },
};

export default sheetApp;
