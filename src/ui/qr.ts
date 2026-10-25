// QR codes, shared by the apps (Letter's QR picture, Code+'s "open on your phone").

/** A QR code for a link or text, as a PNG picture. */
export async function qrDataUrl(text: string, dark = '#000000', light = '#FFFFFF', level: 'L' | 'M' = 'M'): Promise<string> {
  const { default: qrcode } = await import('qrcode-generator');
  const qr = qrcode(0, level);
  qr.addData(text, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  const cell = 8, margin = 4 * cell;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = n * cell + margin * 2;
  const g = canvas.getContext('2d')!;
  g.fillStyle = light;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = dark;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) g.fillRect(margin + c * cell, margin + r * cell, cell, cell);
  return canvas.toDataURL('image/png');
}
