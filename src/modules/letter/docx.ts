// .docx open and save for Office Letter.
// Open: mammoth turns the Word file into HTML, which the editor loads.
// Save: we walk the editor's document tree and build a real Word file with the docx library.

import type { JSONContent } from '@tiptap/react';
import {
  AlignmentType, Document, ExternalHyperlink, HeadingLevel, ImageRun, LevelFormat, Packer, Paragraph,
  ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
  type IParagraphOptions, type ParagraphChild,
} from 'docx';

export async function docxToHtml(data: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  // The browser build of mammoth reads `arrayBuffer`; its Node build (used by the tests) reads `buffer`.
  const result = await mammoth.convertToHtml({ arrayBuffer: data, buffer: data } as { arrayBuffer: ArrayBuffer });
  return result.value;
}

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];

const ALIGN: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED,
};

const PAGE_WIDTH_PX = 600; // usable width of a Letter/A4 page at 96 dpi, roughly

/** Turns '#f00', '#ff0000' or 'rgb(255, 0, 0)' into 'FF0000', which Word expects. */
export function toHex(color: string | undefined): string | undefined {
  if (!color) return undefined;
  const c = color.trim();
  let m = c.match(/^#([0-9a-f]{3})$/i);
  if (m) return m[1].split('').map(ch => ch + ch).join('').toUpperCase();
  m = c.match(/^#([0-9a-f]{6})$/i);
  if (m) return m[1].toUpperCase();
  m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (m) return [m[1], m[2], m[3]].map(n => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
  return undefined;
}

function dataUrlToImage(src: string): { data: Uint8Array; type: 'png' | 'jpg' | 'gif' | 'bmp' } | null {
  const m = src.match(/^data:image\/(png|jpe?g|gif|bmp);base64,(.*)$/i);
  if (!m) return null;
  const bin = atob(m[2]);
  const data = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
  const type = m[1].toLowerCase().startsWith('jp') ? 'jpg' : (m[1].toLowerCase() as 'png' | 'gif' | 'bmp');
  return { data, type };
}

function imageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise(resolve => {
    const fallback = { width: 400, height: 300 };
    if (typeof Image === 'undefined') return resolve(fallback);
    const img = new Image();
    const timer = setTimeout(() => resolve(fallback), 2000);
    img.onload = () => { clearTimeout(timer); resolve({ width: img.naturalWidth || 400, height: img.naturalHeight || 300 }); };
    img.onerror = () => { clearTimeout(timer); resolve(fallback); };
    img.src = src;
  });
}

class DocxWriter {
  private listCount = 0;
  private quoteDepth = 0;

  async blocks(nodes: JSONContent[] = [], list?: { kind: 'bullet' | 'number'; level: number; instance: number }): Promise<(Paragraph | Table)[]> {
    const out: (Paragraph | Table)[] = [];
    for (const node of nodes) out.push(...(await this.block(node, list)));
    return out;
  }

  private async block(node: JSONContent, list?: { kind: 'bullet' | 'number'; level: number; instance: number }): Promise<(Paragraph | Table)[]> {
    const align = ALIGN[(node.attrs?.textAlign as string) ?? ''];
    const listOpts: Partial<IParagraphOptions> = list
      ? list.kind === 'bullet'
        ? { bullet: { level: list.level } }
        : { numbering: { reference: 'oi1-numbers', level: list.level, instance: list.instance } }
      : {};

    switch (node.type) {
      case 'paragraph':
        return [new Paragraph({
          children: await this.inline(node.content),
          alignment: align,
          indent: this.quoteDepth ? { left: 720 * this.quoteDepth } : undefined,
          ...listOpts,
        })];
      case 'heading': {
        const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6);
        return [new Paragraph({ children: await this.inline(node.content), heading: HEADINGS[level - 1], alignment: align })];
      }
      case 'bulletList':
      case 'orderedList': {
        const kind = node.type === 'bulletList' ? 'bullet' : 'number';
        const level = list ? list.level + 1 : 0;
        const instance = kind === 'number' && !list ? ++this.listCount : list?.instance ?? ++this.listCount;
        const items: (Paragraph | Table)[] = [];
        for (const item of node.content ?? []) items.push(...(await this.blocks(item.content, { kind, level, instance })));
        return items;
      }
      case 'blockquote': {
        this.quoteDepth++;
        const inner = await this.blocks(node.content);
        this.quoteDepth--;
        return inner;
      }
      case 'codeBlock':
        return [new Paragraph({ children: [new TextRun({ text: textOf(node), font: 'Consolas' })] })];
      case 'horizontalRule':
        return [new Paragraph({ border: { bottom: { style: 'single', size: 6, color: 'AAAAAA', space: 1 } }, children: [] })];
      case 'image': {
        const run = await this.image(node.attrs?.src as string);
        return [new Paragraph({ children: run ? [run] : [] })];
      }
      case 'table':
        return [await this.table(node)];
      default:
        return node.content ? this.blocks(node.content, list) : [];
    }
  }

  private async table(node: JSONContent): Promise<Table> {
    const rows: TableRow[] = [];
    for (const row of node.content ?? []) {
      const cells: TableCell[] = [];
      for (const cell of row.content ?? []) {
        const children = (await this.blocks(cell.content)).filter((c): c is Paragraph => c instanceof Paragraph);
        cells.push(new TableCell({
          children: children.length ? children : [new Paragraph('')],
          columnSpan: Number(cell.attrs?.colspan) || 1,
          rowSpan: Number(cell.attrs?.rowspan) || 1,
          shading: cell.type === 'tableHeader' ? { fill: 'F2F2F2', type: ShadingType.CLEAR, color: 'auto' } : undefined,
        }));
      }
      rows.push(new TableRow({ children: cells, tableHeader: row.content?.[0]?.type === 'tableHeader' }));
    }
    return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
  }

  private async image(src: string | undefined): Promise<ImageRun | null> {
    if (!src) return null;
    const img = dataUrlToImage(src);
    if (!img) return null; // linked web images are not embedded
    const size = await imageSize(src);
    const scale = Math.min(1, PAGE_WIDTH_PX / size.width);
    return new ImageRun({ data: img.data, type: img.type, transformation: { width: Math.round(size.width * scale), height: Math.round(size.height * scale) } });
  }

  private async inline(nodes: JSONContent[] = []): Promise<ParagraphChild[]> {
    const out: ParagraphChild[] = [];
    for (const node of nodes) {
      if (node.type === 'hardBreak') { out.push(new TextRun({ break: 1 })); continue; }
      if (node.type === 'image') { const run = await this.image(node.attrs?.src as string); if (run) out.push(run); continue; }
      if (node.type !== 'text' || !node.text) continue;
      const marks = Object.fromEntries((node.marks ?? []).map(m => [m.type, m.attrs ?? {}]));
      const highlight = marks.highlight ? toHex(marks.highlight.color as string) ?? 'FFFF00' : undefined;
      const run = new TextRun({
        text: node.text,
        bold: 'bold' in marks,
        italics: 'italic' in marks,
        underline: 'underline' in marks || 'link' in marks ? {} : undefined,
        strike: 'strike' in marks,
        color: 'link' in marks ? '0563C1' : toHex(marks.textStyle?.color as string),
        font: 'code' in marks ? 'Consolas' : undefined,
        shading: highlight ? { fill: highlight, type: ShadingType.CLEAR, color: 'auto' } : undefined,
      });
      out.push('link' in marks && marks.link.href
        ? new ExternalHyperlink({ link: String(marks.link.href), children: [run] })
        : run);
    }
    return out;
  }
}

function textOf(node: JSONContent): string {
  return node.text ?? (node.content ?? []).map(textOf).join('');
}

export async function jsonToDocx(doc: JSONContent, title: string): Promise<Blob> {
  const children = await new DocxWriter().blocks(doc.content);
  const document = new Document({
    title,
    creator: 'Office In 1',
    styles: { default: { document: { run: { font: 'Calibri', size: 22 }, paragraph: { spacing: { after: 160 } } } } },
    numbering: {
      config: [{
        reference: 'oi1-numbers',
        levels: [0, 1, 2, 3, 4, 5].map(level => ({
          level,
          format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN][level % 3],
          text: `%${level + 1}.`,
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
        })),
      }],
    },
    sections: [{ children: children.length ? children : [new Paragraph('')] }],
  });
  return Packer.toBlob(document);
}
