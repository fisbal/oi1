// The OI1 ribbon kit, shared by every app (Letter, Class, …): icons, buttons, drop-down menus, color pickers,
// groups and dialogs, all in the scene look (see kit.css).

import './kit.css';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { t, type MessageKey } from '../shell/i18n';

// ---------- icons (16 x 16, drawn with the text color) ----------

const P = (d: string) => <path d={d} />;
const ICONS: Record<string, ReactNode> = {
  paste: <>{P('M5 3h6v2H5zM4 4H3v10h10V4h-1')}{P('M7 8h5v6H7z')}</>,
  cut: <>{P('M5 12a1.5 1.5 0 1 0 0 .01M11 12a1.5 1.5 0 1 0 0 .01M6 10.8 11 3M10 10.8 5 3')}</>,
  copy: <>{P('M5 5h8v9H5z')}{P('M3 11V2h7')}</>,
  painter: <>{P('M3 2h9v4H3zM12 4h2v4H8v2')}{P('M7 10h2v5H7z')}</>,
  grow: <>{P('M2 14 6 3l4 11M3.5 10h5M12 6V2M10 4h4')}</>,
  shrink: <>{P('M2 14 6 3l4 11M3.5 10h5M10 4h4')}</>,
  clear: <>{P('M3 3h9M7.5 3 5.5 13M9 9l5 5M14 9l-5 5')}</>,
  bullets: <>{P('M3 4h.01M3 8h.01M3 12h.01M6 4h8M6 8h8M6 12h8')}</>,
  numbers: <>{P('M2 3h1v3M2 6h2M2 9.5c0-1 2-1 2 0L2 12h2M6 4h8M6 8h8M6 12h8')}</>,
  outdent: <>{P('M2 3h12M7 6.5h7M7 9.5h7M2 13h12M5 6 2 8l3 2')}</>,
  indent: <>{P('M2 3h12M7 6.5h7M7 9.5h7M2 13h12M2 6l3 2-3 2')}</>,
  left: <>{P('M2 3h12M2 6.5h8M2 10h12M2 13.5h8')}</>,
  center: <>{P('M2 3h12M4 6.5h8M2 10h12M4 13.5h8')}</>,
  right: <>{P('M2 3h12M6 6.5h8M2 10h12M6 13.5h8')}</>,
  justify: <>{P('M2 3h12M2 6.5h12M2 10h12M2 13.5h12')}</>,
  spacing: <>{P('M3 2v12M1.5 4 3 2l1.5 2M1.5 12 3 14l1.5-2M7 4h7M7 8h7M7 12h7')}</>,
  shading: <>{P('M3 8 8 3l5 5-5 5zM13 10c0 1.5 1.5 1.5 1.5 3a1 1 0 0 1-2 0c0-1.5.5-2 .5-3')}</>,
  borders: <>{P('M2 2h12v12H2z')}{P('M2 8h12M8 2v12')}</>,
  marks: <>{P('M9 14V2M12 14V2M13 2H7.5a3 3 0 0 0 0 6H9')}</>,
  find: <>{P('M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM10.5 10.5 14 14')}</>,
  replace: <>{P('M2 5h8l-2-2M14 11H6l2 2')}</>,
  select: <>{P('M2 2h3M11 2h3v3M14 11v3h-3M5 14H2v-3M2 5V2M6 6h4v4H6z')}</>,
  pagebreak: <>{P('M3 1v4h10V1M3 15v-4h10v4M1 8h2M5 8h2M9 8h2M13 8h2')}</>,
  table: <>{P('M2 3h12v10H2zM2 6.5h12M2 10h12M6 3v10M10 3v10')}</>,
  image: <>{P('M2 3h12v10H2zM2 11l4-4 3 3 2-2 3 3')}{P('M10.5 5.5h.01')}</>,
  link: <>{P('M7 9a3 3 0 0 0 4 0l2-2a3 3 0 0 0-4-4l-1 1M9 7a3 3 0 0 0-4 0L3 9a3 3 0 0 0 4 4l1-1')}</>,
  symbol: <>{P('M4 13h3v-2a4 4 0 1 1 2 0v2h3')}</>,
  date: <>{P('M2 4h12v10H2zM2 7h12M5 2v3M11 2v3')}</>,
  hr: <>{P('M1 8h14')}</>,
  header: <>{P('M3 1h10v14H3z')}{P('M5 3.5h6')}</>,
  footer: <>{P('M3 1h10v14H3z')}{P('M5 12.5h6')}</>,
  pagenum: <>{P('M3 1h10v14H3zM7 11V6l-1 1M9 11h-2')}</>,
  margins: <>{P('M2 1h12v14H2zM5 1v14M11 1v14M2 4h12M2 12h12')}</>,
  orientation: <>{P('M2 4h7v10H2zM7 2h7v7')}</>,
  size: <>{P('M3 1h7l3 3v11H3zM10 1v3h3')}</>,
  pagecolor: <>{P('M3 1h10v14H3z')}{P('M6 9c0-2 2-4 2-4s2 2 2 4a2 2 0 0 1-4 0')}</>,
  pageborder: <>{P('M2 1h12v14H2zM4 3h8v10H4z')}</>,
  spell: <>{P('M2 9 4.5 3 7 9M3 7h3M2 13l2 2 5-5M9 3h2.5a1.5 1.5 0 0 1 0 3H9V3zm0 3h3a1.5 1.5 0 0 1 0 3H9')}</>,
  language: <>{P('M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14zM1 8h14M8 1c3 3 3 11 0 14M8 1c-3 3-3 11 0 14')}</>,
  count: <>{P('M2 4h9M2 8h12M2 12h7M13 11l1 1 2-2')}</>,
  print: <>{P('M4 6V1h8v5M4 12H2V6h12v6h-2M4 9h8v6H4z')}</>,
  web: <>{P('M1 3h14v10H1zM1 6h14')}</>,
  zoomin: <>{P('M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM10.5 10.5 14 14M5 7h4M7 5v4')}</>,
  zoomout: <>{P('M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM10.5 10.5 14 14M5 7h4')}</>,
  width: <>{P('M1 8h14M3 6 1 8l2 2M13 6l2 2-2 2M5 2v12M11 2v12')}</>,
  onepage: <>{P('M4 1h8v14H4z')}</>,
  undo: <>{P('M4 6h6a4 4 0 0 1 0 8H7M6 3 3 6l3 3')}</>,
  redo: <>{P('M12 6H6a4 4 0 0 0 0 8h3M10 3l3 3-3 3')}</>,
  rowabove: <>{P('M2 8h12v6H2zM2 11h12M8 2v4M6 4h4')}</>,
  rowbelow: <>{P('M2 2h12v6H2zM2 5h12M8 10v4M6 12h4')}</>,
  colleft: <>{P('M8 2h6v12H8zM11 2v12M2 8h4M4 6v4')}</>,
  colright: <>{P('M2 2h6v12H2zM5 2v12M10 8h4M12 6v4')}</>,
  delrow: <>{P('M2 5h12v6H2zM6 7l4 2M10 7 6 9')}</>,
  delcol: <>{P('M5 2h6v12H5zM7 6l2 4M9 6l-2 4')}</>,
  deltable: <>{P('M2 3h12v10H2zM5 6l6 4M11 6l-6 4')}</>,
  hyphen: <>{P('M2 5h7M2 8h5M2 11h8M10.5 8h3')}</>,
  trash: <>{P('M3 4h10M6 4V2.5h4V4M4.5 4l.7 9.5h5.6l.7-9.5M7 6.5v5M9 6.5v5')}</>,
  alt: <>{P('M2 3h12v10H2z')}{P('M4.5 10.5 6 6l1.5 4.5M5 9h2M9.5 6v4.5h2')}</>,
  check: <>{P('M3 8.5 6.5 12 13 4.5')}</>,
  pen: <>{P('M10.5 2.5 13.5 5.5 6 13H3v-3z')}{P('M9 4l3 3')}</>,
  comment: <>{P('M2.5 3h11v8h-6l-3 2.5V11h-2z')}</>,
  commentnew: <>{P('M2.5 3h11v8h-6l-3 2.5V11h-2z')}{P('M8 5v4M6 7h4')}</>,
  prev: <>{P('M10 3 5 8l5 5')}</>,
  next: <>{P('M6 3l5 5-5 5')}</>,
  track: <>{P('M2 13h3l7.5-7.5-3-3L2 10z')}{P('M9 13h5')}</>,
  accept: <>{P('M2 4h7M2 7h5M2 10h4')}{P('M8.5 11 10.5 13 14 8.5')}</>,
  reject: <>{P('M2 4h7M2 7h5M2 10h4')}{P('M9 9l4 4M13 9l-4 4')}</>,
  markup: <>{P('M2 5h5M9 5h5')}{P('M2 10h12')}{P('M7 3v4')}</>,
  footnote: <>{P('M2 3h9M2 6h9M2 9h6')}{P('M12 2.5v3')}{P('M2 12.5h4M2 14h7')}</>,
  watermark: <>{P('M3 2h10v12H3z')}{P('M5 11 11 5')}</>,
  columns: <>{P('M2 3h5M2 6h5M2 9h5M2 12h5M9 3h5M9 6h5M9 9h5M9 12h5')}</>,
  merge: <>{P('M2 3h12v10H2zM5 8h6M9 6l2 2-2 2M7 6 5 8l2 2')}</>,
  split: <>{P('M2 3h12v10H2zM8 3v10')}</>,
  headerrow: <>{P('M2 3h12v10H2zM2 6.5h12')}{P('M2 3h12v3.5H2z')}</>,
  new: <>{P('M3 1h7l3 3v11H3zM10 1v3h3M8 7v5M5.5 9.5h5')}</>,
  open: <>{P('M1 13V3h5l1 2h7v2M1 13l2-6h12l-2 6z')}</>,
  save: <>{P('M2 2h10l2 2v10H2zM5 2v4h6V2M5 14v-5h6v5')}</>,
  saveas: <>{P('M2 2h10l2 2v4M2 2v12h6M5 2v4h6V2M10 15l1-3 3-3 2 2-3 3z')}</>,
  pdf: <>{P('M3 1h7l3 3v11H3zM10 1v3h3M5 12V8h1.5a1 1 0 0 1 0 2H5')}</>,
  close: <>{P('M3 3l10 10M13 3 3 13')}</>,
  caret: <>{P('M4 6l4 4 4-4')}</>,
  case: <>{P('M1 13 4 4l3 9M2 10h4M9 9.5a2 2 0 1 1 4 0V13M13 11.5c-1-1-4-.5-4 .5s2 1.5 4 0')}</>,
  // Linking the apps
  letter: <>{P('M3 1h7l3 3v11H3zM10 1v3h3M5 7h6M5 9.5h6M5 12h4')}</>,
  sheet: <>{P('M2 2h12v12H2zM2 6h12M2 10h12M6 2v12M10 2v12')}</>,
  prodfos: <>{P('M3 1h7l3 3v11H3zM10 1v3h3M5 12V8h1.5a1 1 0 0 1 0 2H5M9 8v4M9 8h2M9 10h1.5')}</>,
  send: <>{P('M2 8 14 2l-4 12-2.5-5zM7.5 9 14 2')}</>,
  sync: <>{P('M13 6a5.5 5.5 0 0 0-10-1M3 2v3h3M3 10a5.5 5.5 0 0 0 10 1M13 14v-3h-3')}</>,
  unlink: <>{P('M7 9a3 3 0 0 0 4 0l2-2a3 3 0 0 0-4-4M9 7a3 3 0 0 0-4 0L3 9a3 3 0 0 0 4 4M2 2l2 2M14 14l-2-2')}</>,
  share: <>{P('M8 10V2M5 5l3-3 3 3M3 8v6h10V8')}</>,
  apps: <>{P('M3 3h.01M8 3h.01M13 3h.01M3 8h.01M8 8h.01M13 8h.01M3 13h.01M8 13h.01M13 13h.01')}</>,
  // Smart tools
  search: <>{P('M7 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM10.5 10.5 14 14')}</>,
  sparkle: <>{P('M8 1.5l1.6 4.9L14.5 8l-4.9 1.6L8 14.5l-1.6-4.9L1.5 8l4.9-1.6zM13 1v3M11.5 2.5h3')}</>,
  outline: <>{P('M2 3h3M2 8h3M2 13h3M7 3h7M9 8h5M9 13h5')}</>,
  focus: <>{P('M1 5V1h4M11 1h4v4M15 11v4h-4M5 15H1v-4M5.5 8a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0')}</>,
  speak: <>{P('M2 6h3l4-3v10l-4-3H2zM11.5 5.5a3.5 3.5 0 0 1 0 5M13.5 3.5a6.5 6.5 0 0 1 0 9')}</>,
  mic: <>{P('M6 2h4v7a2 2 0 0 1-4 0zM3.5 8a4.5 4.5 0 0 0 9 0M8 12.5V15M5.5 15h5')}</>,
  toc: <>{P('M2 3h8M4 6.5h8M4 10h8M2 13.5h8M13 3h1M14 6.5h.5M14 10h.5M13 13.5h1')}</>,
  callout: <>{P('M2 3h12v8H7l-3 3v-3H2zM5 6h6M5 8.5h4')}</>,
  theme: <>{P('M8 15A7 7 0 1 1 15 8c0 2-1.5 3-3 3h-1.5a1.5 1.5 0 0 0-1 2.6A1.4 1.4 0 0 1 8 15zM4.5 7.5h.01M7 4.5h.01M10.5 5h.01')}</>,
  clean: <>{P('M10 2l4 4-6 6H4V8zM2 14h12M7 5l4 4')}</>,
  diagram: <>{P('M1.5 6h3.5v4H1.5zM6.5 6h3.5v4H6.5zM11.5 6h3v4h-3')}{P('M5 8h1.5M10 8h1.5')}</>,
  wordart: <>{P('M2 13 6 3l4 10M3.5 9.5h5')}{P('M11 13c3 0 3-4 0-4M11 9V6')}</>,
  qr: <>{P('M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM4 4h1v1H4zM11 4h1v1h-1zM4 11h1v1H4zM9 9h2v2H9zM12 9h2M9 12v2M12 12h2v2h-2z')}</>,
  sort: <>{P('M4 2v12M1.5 11.5 4 14l2.5-2.5M9 3h5M9 6.5h4M9 10h3M9 13.5h2')}</>,
  texttable: <>{P('M1 3h6M1 6h6M1 9h4M9 3h6v10H9zM9 8h6M12 3v10')}</>,
  signature: <>{P('M1 12c2-4 3-8 4-8s-1 7 1 7 2-5 3-5-0 4 1 4 2-2 3-2M1 14.5h14')}</>,
  envelope: <>{P('M1 3h14v10H1zM1 3l7 6 7-6')}</>,
  // Office Class
  sum: <>{P('M12 3H4l4.5 5L4 13h8')}</>,
  currency: <>{P('M11.5 4.5A4 4 0 1 0 11.5 11.5M2.5 7h6M2.5 9h6')}</>,
  percent: <>{P('M13 3 3 13M4.5 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM11.5 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z')}</>,
  decimal: <>{P('M2 12h.01M5 8.5a2 2 0 1 1 4 0v1a2 2 0 1 1-4 0zM11 8.5a2 2 0 1 1 4 0v1a2 2 0 1 1-4 0z')}</>,
  fx: <>{P('M7 2.5c-2 0-2 1-2.5 4L3.5 13c-.4 1.5-1.5 1.5-2 1.5M2.5 6.5h5M9 7l5 6M14 7l-5 6')}</>,
  fill: <>{P('M3 8 8 3l5 5-5 5zM13 10c0 1.5 1.5 1.5 1.5 3a1 1 0 0 1-2 0c0-1.5.5-2 .5-3')}</>,
  insrow: <>{P('M2 2h12v4H2zM2 10h12v4H2zM8 6.5v3M6.5 8h3')}</>,
  inscol: <>{P('M2 2h4v12H2zM10 2h4v12h-4zM8 6.5v3M6.5 8h3')}</>,
  chart: <>{P('M2 14h12M4 14V8M7 14V4M10 14V9M13 14V6')}</>,
  freeze: <>{P('M2 2h12v12H2zM2 5.5h12M5.5 2v12')}</>,
  // Office Code+
  play: <>{P('M4.5 2.5v11l9-5.5z')}</>,
  folder: <>{P('M1.5 13V3.5h4.5l1.5 2h7V13z')}</>,
  file: <>{P('M3.5 1.5h6l3 3v10h-9zM9.5 1.5v3h3')}</>,
  newfolder: <>{P('M1.5 13V3.5h4.5l1.5 2h7V13zM8 7.5v4M6 9.5h4')}</>,
  upload: <>{P('M8 11V2M4.5 5.5 8 2l3.5 3.5M2 10v4h12v-4')}</>,
  download: <>{P('M8 2v9M4.5 7.5 8 11l3.5-3.5M2 10v4h12v-4')}</>,
  code: <>{P('M5.5 4 1.5 8l4 4M10.5 4l4 4-4 4M9.5 2.5l-3 11')}</>,
  stage: <>{P('M1.5 2.5h13v8h-13zM8 10.5v2.5M5 14.5l3-1.5 3 1.5M4 5h5M4 7.5h3')}</>,
  phone: <>{P('M4.5 1.5h7v13h-7zM7 12.5h2')}</>,
  tablet: <>{P('M2.5 1.5h11v13h-11zM7 12.5h2')}</>,
  desktop: <>{P('M1.5 2.5h13v8.5h-13zM6 14h4M8 11v3')}</>,
  rotate: <>{P('M3 8a5 5 0 1 0 1.5-3.5M4.5 1.5v3h3')}</>,
  terminal: <>{P('M1.5 2.5h13v11h-13zM4 6l2.5 2L4 10M8 10.5h4')}</>,
  github: <>{P('M6 13.5c-3 1-3-1.5-4.5-2M10 15.5v-2.8c0-.8.1-1.2-.4-1.7 2-.2 4-1 4-4.5a3.5 3.5 0 0 0-1-2.5 3.2 3.2 0 0 0-.1-2.5s-.8-.2-2.5 1a8.5 8.5 0 0 0-4.4 0C3.9 1.3 3.1 1.5 3.1 1.5A3.2 3.2 0 0 0 3 4a3.5 3.5 0 0 0-1 2.5c0 3.5 2 4.3 4 4.5-.5.5-.5 1-.4 1.7v2.8')}</>,
  rocket: <>{P('M9.5 2.5c2-1 4-1 4-1s0 2-1 4L8 10 6 8zM6 8 3 7.5 5 5.5h3M8 10l.5 3 2-2V8M3.5 12.5l-1 1M5 13.5l-1.5 1.5M2.5 11 1 12.5')}</>,
  wrap: <>{P('M2 3.5h12M2 8h10a2 2 0 0 1 0 4H8M9.5 10.5 8 12l1.5 1.5M2 12.5h3.5')}</>,
  window: <>{P('M1.5 2.5h13v11h-13zM1.5 5.5h13M9 8.5h3v3M12 8.5 8 12.5')}</>,
  pull: <>{P('M8 1.5v8M5 6.5l3 3 3-3M2.5 11.5v3h11v-3')}</>,
  push: <>{P('M8 10V2M5 5l3-3 3 3M2.5 11.5v3h11v-3')}</>,
  rename: <>{P('M2 12.5h4M10.5 2.5l3 3-7 7H3.5v-3z')}</>,
  vtop: <>{P('M2 2h12M8 5v9M5 8l3-3 3 3')}</>,
  vmid: <>{P('M2 8h12M8 1.5v4M6 3.5l2 2 2-2M8 14.5v-4M6 12.5l2-2 2 2')}</>,
  vbot: <>{P('M2 14h12M8 2v9M5 8l3 3 3-3')}</>,
  decmore: <>{P('M2 12h.01M5 6.5a1.5 2.5 0 1 0 3 0 1.5 2.5 0 1 0-3 0M10 6.5a1.5 2.5 0 1 0 3 0 1.5 2.5 0 1 0-3 0M8 14h6M12 12.5l2 1.5-2 1.5')}</>,
  decless: <>{P('M2 12h.01M5 6.5a1.5 2.5 0 1 0 3 0 1.5 2.5 0 1 0-3 0M10 6.5a1.5 2.5 0 1 0 3 0 1.5 2.5 0 1 0-3 0M14 14H8M10 12.5 8 14l2 1.5')}</>,
  thousands: <>{P('M2.5 11.5 4 9M7 11.5 8.5 9M11.5 11.5 13 9M1.5 6h13')}</>,
  filter: <>{P('M2 2.5h12L9.5 8v5l-3 1.5V8z')}</>,
  dedupe: <>{P('M2 2.5h8v3H2zM2 7.5h8v3H2zM12 9l3 3M15 9l-3 3')}</>,
  gridlines: <>{P('M2 2h12v12H2zM2 6h12M2 10h12M6 2v12M10 2v12')}</>,
  headings: <>{P('M5 2h9v3H5zM2 5h3v9H2zM5 5h9v9H5z')}</>,
  barchart: <>{P('M2 2v12M2 4h7M2 7h11M2 10h5M2 13h9')}</>,
  linechart: <>{P('M2 2v12h12M4 11l3-4 3 2 4-5')}</>,
  areachart: <>{P('M2 2v12h12M2 13l3-5 3 2 4-5 2 2v6z')}</>,
  piechart: <>{P('M8 2a6 6 0 1 0 6 6H8zM10 1a5 5 0 0 1 5 5h-5z')}</>,
  scatter: <>{P('M2 2v12h12M5 10h.01M7 7h.01M9 9h.01M11 5h.01M12 8h.01M6 12h.01')}</>,
  stacked: <>{P('M2 14h12M4 14V9h2.5v5M4 9V6h2.5v3M9.5 14v-4H12v4M9.5 10V4H12v6')}</>,
  doughnut: <>{P('M8 2a6 6 0 1 0 6 6h-3a3 3 0 1 1-3-3zM10 1a5 5 0 0 1 5 5h-5z')}</>,
  palette: <>{P('M8 1.5a6.5 6.5 0 0 0 0 13c1 0 1.5-.6 1.5-1.3 0-1-.9-1.2-.9-2s.6-1.2 1.4-1.2h1.5a3 3 0 0 0 3-3C14.5 4 11.6 1.5 8 1.5zM4.5 8h.01M6 5h.01M10 4.5h.01')}</>,
  legend: <>{P('M2 3h12v8H2zM4 13.5h2M8 13.5h2M12 13.5h1')}</>,
  labels: <>{P('M2 14h12M4 14v-4M8 14V6M12 14V8M3 7.5h2M7 3.5h2M11 5.5h2')}</>,
  swap: <>{P('M3 5h10M10 2l3 3-3 3M13 11H3M6 8l-3 3 3 3')}</>,
  gear: <>{P('M8 10.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4zM8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.4 3.4l1.3 1.3M11.3 11.3l1.3 1.3M3.4 12.6l1.3-1.3M11.3 4.7l1.3-1.3')}</>,
  goto: <>{P('M2 4h7M2 8h4M2 12h7M11 6l3 2-3 2')}</>,
  shield: <>{P('M8 1.5 13.5 3.5v4c0 3.5-2.4 5.8-5.5 7-3.1-1.2-5.5-3.5-5.5-7v-4z')}{P('M5.5 8l1.8 1.8 3.5-3.6')}</>,
  gov: <>{P('M2 6h12L8 2.5zM3.5 6v6M6.5 6v6M9.5 6v6M12.5 6v6M1.5 14h13')}</>,
  cv: <>{P('M3 1.5h10v13H3z')}{P('M8 6.4a1.5 1.5 0 1 0 0-.01M5.5 9.6c.7-1.3 4.3-1.3 5 0M5.5 12h5')}</>,
  heart: <>{P('M8 13.5S2 10 2 6a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 4-6 7.5-6 7.5z')}</>,
  user: <>{P('M8 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3 14c.5-3 9.5-3 10 0')}</>,
  cite: <>{P('M3 4h4v4H4.5L3 11zM9 4h4v4h-2.5L9 11')}</>,
  book: <>{P('M2.5 3h4.5a1 1 0 0 1 1 1v9.5a1.5 1.5 0 0 0-1.5-1.5h-4zM13.5 3H9a1 1 0 0 0-1 1v9.5a1.5 1.5 0 0 1 1.5-1.5h4z')}</>,
  caption: <>{P('M2.5 2.5h11v7h-11zM4.5 8l2.5-3 2 2 1.5-1.5 1.5 2.5M3 12.5h6M3 14.5h10')}</>,
  index: <>{P('M3 2.5h7l3 3v8H3zM5.5 7h5M5.5 9.5h5M5.5 12h3')}</>,
  crossref: <>{P('M6.5 9.5 9.5 6.5M7 4.5l1-1a2.5 2.5 0 0 1 3.5 3.5l-1 1M9 11.5l-1 1A2.5 2.5 0 0 1 4.5 9l1-1')}</>,
  lines: <>{P('M6 4h8M6 8h8M6 12h8')}{P('M2.5 3.5v1M2.5 7.5v1M2.5 11.5v1')}</>,
  rtl: <>{P('M14 4H5M14 8H8M14 12H5M4 6.5 2 8.5l2 2')}</>,
};

/** The icon of each app in OI1, for app switchers and "Send to" menus. */
export const appIcon = (id: string) => ({ letter: 'letter', class: 'sheet', stage: 'stage', code: 'code', prodfos: 'prodfos' } as Record<string, string>)[id] ?? 'apps';

export function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.3"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>
  );
}

// ---------- buttons ----------

interface BtnProps {
  icon?: string;
  label?: ReactNode;
  title: MessageKey | string;
  onClick: () => unknown;
  active?: boolean;
  disabled?: boolean;
  big?: boolean;
  style?: CSSProperties;
  /** Show the label next to the icon. */
  text?: boolean;
}

const tr = (key: string) => (key.includes('.') ? t(key as MessageKey) : key);

/** A ribbon button. It keeps the editor's selection, so formatting applies to the selected text. */
export function Btn({ icon, label, title, onClick, active, disabled, big, style, text }: BtnProps) {
  const name = tr(title);
  return (
    <button type="button" className={`rb${big ? ' big' : ''}${active ? ' on' : ''}${text ? ' txt' : ''}`}
      title={name} aria-label={name} aria-pressed={active} disabled={disabled} style={style}
      onMouseDown={e => e.preventDefault()} onClick={() => onClick()}>
      {icon && (big ? <span className="key"><Icon name={icon} size={20} /></span> : <Icon name={icon} size={16} />)}
      {label ?? (text || big ? <span className="rb-label">{name}</span> : null)}
    </button>
  );
}

/** A labeled group of ribbon buttons, like "Font" or "Paragraph". */
export function Group({ label, children }: { label: MessageKey | string; children: ReactNode }) {
  return (
    <div className="rgroup" role="group" aria-label={tr(label)}>
      <div className="rgroup-body">{children}</div>
      <div className="rgroup-label">{tr(label)}</div>
    </div>
  );
}

// ---------- drop-down menus ----------

export function useOutsideClose(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open, close]);
  return ref;
}

/** A button that opens a panel. `children` gets a function to close the panel. */
export function Drop({ icon, label, title, children, active, swatch, big, text, wide, disabled }: {
  icon?: string; label?: ReactNode; title: MessageKey | string; children: (close: () => void) => ReactNode;
  active?: boolean; swatch?: string | null; big?: boolean; text?: boolean; wide?: boolean; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const ref = useOutsideClose(open, close);
  const panel = useRef<HTMLDivElement>(null);
  const name = tr(title);
  // The panel opens under its button, then moves back inside the screen: on a phone the ribbon scrolls sideways,
  // and a list opened from a button near the edge would otherwise open out of sight.
  useLayoutEffect(() => {
    const el = panel.current;
    if (!open || !el) return;
    el.style.marginLeft = '';
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    // Its own width first: past the screen's edge the browser would squeeze it, then widen it once moved back.
    el.style.maxWidth = `${vw - 16}px`;
    el.style.width = 'max-content';
    // Measured without the opening animation's small zoom, so the panel ends exactly inside the screen.
    const r = el.getBoundingClientRect(), w = el.offsetWidth, left = r.left + r.width / 2 - w / 2;
    let dx = 0;
    if (left + w > vw - 8) dx = vw - 8 - left - w;
    if (left + dx < 8) dx = 8 - left;
    el.style.marginLeft = `${dx}px`;
    el.style.maxHeight = `${Math.max(160, Math.min(vh * 0.7, vh - r.top - 12))}px`;
  }, [open]);
  return (
    <div className="drop" ref={ref}>
      <button type="button" className={`rb${big ? ' big' : ''}${active ? ' on' : ''}${text ? ' txt' : ''}`} title={name} aria-label={name}
        aria-haspopup="true" aria-expanded={open} disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={() => setOpen(o => !o)}>
        {icon && <span className={`rb-icon${big ? ' key' : ''}`}><Icon name={icon} size={big ? 20 : 16} />{swatch !== undefined && <i className="swatch" style={{ background: swatch ?? 'transparent' }} />}</span>}
        {label ?? (text || big ? <span className="rb-label">{name}</span> : null)}
        <span className="rb-caret"><Icon name="caret" size={10} /></span>
      </button>
      {open && <div ref={panel} className={`drop-panel${wide ? ' wide' : ''}`} role="menu" onMouseDown={e => { if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault(); }}>{children(close)}</div>}
    </div>
  );
}

export function MenuItem({ label, onClick, active, hint }: { label: ReactNode; onClick: () => unknown; active?: boolean; hint?: string }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={!!active} className={`menu-item${active ? ' on' : ''}`} onClick={() => onClick()}>
      <span>{label}</span>{hint && <span className="hint">{hint}</span>}
    </button>
  );
}

// ---------- colors ----------

// Word's standard palette: a row of theme colors with lighter and darker shades, then standard colors.
const THEME = ['#FFFFFF', '#000000', '#E7E6E6', '#44546A', '#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'];
const STANDARD = ['#C00000', '#FF0000', '#FFC000', '#FFFF00', '#92D050', '#00B050', '#00B0F0', '#0070C0', '#002060', '#7030A0'];

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c =>
    Math.round(amount > 0 ? c + (255 - c) * amount : c * (1 + amount)));
  return `#${ch.map(c => c.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

const SHADES = [0.8, 0.6, 0.4, -0.25, -0.5];

export function ColorGrid({ onPick, none, value }: { onPick: (c: string | null) => void; none?: MessageKey; value?: string | null }) {
  const custom = useRef<HTMLInputElement>(null);
  const cell = (c: string) => (
    <button key={c} type="button" className={`color-cell${value?.toUpperCase() === c ? ' on' : ''}`} style={{ background: c }}
      title={c} aria-label={c} onClick={() => onPick(c)} />
  );
  return (
    <div className="colors">
      {none && <button type="button" className="menu-item" onClick={() => onPick(null)}>{t(none)}</button>}
      <div className="color-row">{THEME.map(cell)}</div>
      <div className="color-shades">
        {SHADES.map(s => <div key={s} className="color-row">{THEME.map(c => cell(shade(c, c === '#FFFFFF' ? -Math.abs(s) / 2 : c === '#000000' ? Math.abs(s) : s)))}</div>)}
      </div>
      <div className="colors-label">{t('letter.standardColors')}</div>
      <div className="color-row">{STANDARD.map(cell)}</div>
      <label className="menu-item more-colors">
        {t('letter.moreColors')}
        <input ref={custom} type="color" defaultValue={value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
          onChange={e => onPick(e.target.value.toUpperCase())} />
      </label>
    </div>
  );
}

// ---------- dialogs ----------

export function Dialog({ title, children, onClose, onOk }: { title: string; children: ReactNode; onClose: () => void; onOk?: () => void | boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
  }, []);
  return (
    <dialog ref={ref} className="oi-dialog" onClose={onClose} onCancel={onClose}>
      <form method="dialog" onSubmit={e => { e.preventDefault(); if (onOk?.() !== false) onClose(); }}>
        <h2>{title}</h2>
        <div className="dialog-body">{children}</div>
        <div className="dialog-buttons">
          {onOk && <button type="submit" className="primary">{t('letter.ok')}</button>}
          <button type="button" onClick={onClose}>{onOk ? t('letter.cancel') : t('letter.close')}</button>
        </div>
      </form>
    </dialog>
  );
}

/** A number box that applies its value on Enter or when it loses focus. */
export function NumberBox({ value, onChange, step = 0.1, min, max, unit, label }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; unit: string; label: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = parseFloat(text.replace(',', '.'));
    if (!isNaN(n)) onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n)));
    else setText(String(value));
  };
  return (
    <label className="numbox" title={label}>
      <span>{label}</span>
      <input type="number" inputMode="decimal" aria-label={`${label} (${unit})`} value={text} step={step} min={min} max={max}
        onChange={e => setText(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
      <span className="unit">{unit}</span>
    </label>
  );
}

// ---------- combo boxes (font and size) ----------

export interface ComboGroup { label?: string; items: string[] }

/**
 * A text box with a full list under it, like Word's font and size boxes: the whole list shows when it opens,
 * typing narrows it, Enter takes the highlighted item (or what was typed), Escape puts the old value back.
 */
export function Combo({ value, groups, onPick, label, className, itemStyle, inputMode, numeric }: {
  value: string; groups: ComboGroup[]; onPick: (v: string) => void; label: string; className: string;
  itemStyle?: (item: string) => CSSProperties; inputMode?: 'decimal'; numeric?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [typed, setTyped] = useState(false);
  const [index, setIndex] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const ref = useOutsideClose(open, () => { setOpen(false); setText(value); });
  // The ribbon scrolls sideways, so the list is placed on the page under the box instead of inside the ribbon.
  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setAt({ left: Math.max(8, Math.min(r.left, window.innerWidth - 270)), top: r.bottom + 4 });
  }, [open, ref]);
  useEffect(() => { if (!open) setText(value); }, [value, open]);
  const q = typed ? text.trim().toLowerCase() : '';
  const shown = groups
    .map(g => ({ ...g, items: q ? g.items.filter(i => (numeric ? i.startsWith(q) : i.toLowerCase().includes(q))) : g.items }))
    .filter(g => g.items.length);
  const flat = shown.flatMap(g => g.items);
  useEffect(() => {
    if (!open) return;
    const at = q ? 0 : Math.max(0, flat.indexOf(value));
    setIndex(at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, q]);
  useEffect(() => { list.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest' }); }, [index, open]);
  const pick = (v: string) => { setOpen(false); setTyped(false); setText(v); if (v.trim()) onPick(v.trim()); };
  let n = -1;
  return (
    <div className={`combo ${className}`} ref={ref}>
      <input value={text} aria-label={label} title={label} inputMode={inputMode} role="combobox" aria-expanded={open}
        style={itemStyle?.(value)}
        onFocus={e => { e.currentTarget.select(); setTyped(false); setOpen(true); }}
        onMouseDown={() => setOpen(true)}
        onChange={e => { setText(e.target.value); setTyped(true); setOpen(true); }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setIndex(i => Math.min(flat.length - 1, i + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(0, i - 1)); }
          else if (e.key === 'Enter') { e.preventDefault(); pick(typed && !flat.some(f => f.toLowerCase() === q) && (numeric || !flat.length) ? text : flat[index] ?? text); }
          else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); setTyped(false); setText(value); }
          else if (e.key === 'Tab') setOpen(false);
        }} />
      <button type="button" className="combo-caret" tabIndex={-1} aria-label={label} onMouseDown={e => e.preventDefault()}
        onClick={() => { setTyped(false); setOpen(o => !o); }}><Icon name="caret" size={10} /></button>
      {open && flat.length > 0 && (
        <div className="drop-panel combo-list" role="listbox" ref={list} onMouseDown={e => e.preventDefault()}
          style={at ? { left: at.left, top: at.top, translate: 'none', maxHeight: `min(420px, ${window.innerHeight - at.top - 12}px)` } : { visibility: 'hidden' }}>
          {shown.map((g, gi) => (
            <div key={g.label ?? gi}>
              {g.label && <span className="kicker">{g.label}</span>}
              {g.items.map(item => {
                n++;
                const at = n;
                return (
                  <button key={`${g.label}-${item}`} type="button" role="option" aria-selected={item === value}
                    className={`menu-item${at === index ? ' on' : ''}${item === value ? ' current' : ''}`}
                    style={itemStyle?.(item)} onMouseEnter={() => setIndex(at)} onClick={() => pick(item)}>{item}</button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
