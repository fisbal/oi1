import { createRoot } from 'react-dom/client';
import type { OI1Module } from '../../shell/contract';
import ImageApp, { EXTENSIONS } from './Image';
import './image.css';

// In 1 Image: photo editing with live settings, 31 looks, crop formats and before/after, on every screen.
const imageApp: OI1Module = {
  id: 'image',
  extensions: EXTENSIONS,
  mount(el, shell, file, handoff) {
    const root = createRoot(el);
    root.render(<ImageApp shell={shell} file={file} handoff={handoff} />);
    return { unmount: () => root.unmount() };
  },
};

export default imageApp;
