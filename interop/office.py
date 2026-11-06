"""Independent readers and writers for the interop check (Martin, 2026-11-06: files from Office In 1 must open in the
equivalent apps, and theirs in Office In 1). openpyxl, python-docx and python-pptx stand in for Excel, Word and
PowerPoint: they read files the way Office's own format rules say, with none of Office In 1's code.

  python3 interop/office.py read-xlsx|read-docx|read-pptx FILE   -> JSON on stdout
  python3 interop/office.py make-xlsx|make-docx|make-pptx FILE   -> writes a file like Office would
"""
import io
import json
import sys
import zlib
import struct


def color(c):
    """#rrggbb of an openpyxl / python-docx / python-pptx colour, or None."""
    try:
        if c is None:
            return None
        rgb = getattr(c, 'rgb', c)
        if rgb is None:
            return None
        s = str(rgb)
        if len(s) == 8:
            s = s[2:]
        return '#' + s.lower() if len(s) == 6 and all(ch in '0123456789abcdefABCDEF' for ch in s) else None
    except Exception:
        return None


def png_bytes():
    """A tiny red PNG, made here so no file is needed."""
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    raw = b''.join(b'\x00' + b'\xff\x00\x00' * 8 for _ in range(8))
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 8, 8, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')


# ---------- Excel ----------

def read_xlsx(path):
    import openpyxl
    wb = openpyxl.load_workbook(path)
    out = {'sheets': []}
    for ws in wb.worksheets:
        cells = {}
        for row in ws.iter_rows():
            for c in row:
                if c.value is None and not c.has_style:
                    continue
                f = c.fill.fgColor if c.fill is not None and c.fill.fill_type == 'solid' else None
                b = c.border
                cells[c.coordinate] = {
                    'value': c.value if not hasattr(c.value, 'isoformat') else c.value.isoformat(),
                    'format': c.number_format,
                    'bold': bool(c.font.b), 'italic': bool(c.font.i),
                    'color': color(c.font.color), 'fill': color(f),
                    'border': (b.bottom.style if b is not None and b.bottom is not None else None),
                    'align': c.alignment.horizontal,
                }
        out['sheets'].append({
            'name': ws.title, 'cells': cells,
            'merged': [str(r) for r in ws.merged_cells.ranges],
            'widths': {k: v.width for k, v in ws.column_dimensions.items() if v.width},
        })
    return out


def make_xlsx(path):
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
    import datetime
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = 'Budget'
    ws['A1'] = 'Poste'
    ws['B1'] = 'Montant'
    for ref in ('A1', 'B1'):
        ws[ref].font = Font(bold=True, color='FFFFFF')
        ws[ref].fill = PatternFill('solid', fgColor='4472C4')
    ws['A2'] = 'Loyer'
    ws['B2'] = 1227.5
    ws['B2'].number_format = '#,##0.00\\ [$$-C0C]'
    ws['A3'] = 'Rent USD'
    ws['B3'] = 900
    ws['B3'].number_format = '"$"#,##0.00'
    ws['A4'] = 'Miete'
    ws['B4'] = 750.25
    ws['B4'].number_format = '#,##0.00\\ "€"'
    ws['B4'].font = Font(italic=True, color='C00000')
    ws['B4'].fill = PatternFill('solid', fgColor='FFFF00')
    ws['A5'] = 'Total'
    ws['B5'] = '=SUM(B2:B4)'
    ws['B5'].border = Border(bottom=Side(style='double'))
    ws['A6'] = 'Date'
    ws['B6'] = datetime.date(2026, 11, 6)
    ws['B6'].number_format = 'yyyy-mm-dd'
    ws['A7'] = 'Taux'
    ws['B7'] = 0.15
    ws['B7'].number_format = '0%'
    ws.merge_cells('A9:B9')
    ws['A9'] = 'Fusion'
    ws['A9'].alignment = Alignment(horizontal='center')
    ws.column_dimensions['A'].width = 24
    wb.create_sheet('Notes')['A1'] = 'Deuxième feuille'
    wb.save(path)


# ---------- Word ----------

def read_docx(path):
    import docx
    d = docx.Document(path)
    paras = []
    for p in d.paragraphs:
        runs = []
        for r in p.runs:
            runs.append({'text': r.text, 'bold': bool(r.bold), 'italic': bool(r.italic), 'underline': bool(r.underline),
                         'color': color(r.font.color.rgb) if r.font.color is not None and r.font.color.type is not None else None,
                         'size': r.font.size.pt if r.font.size else None, 'font': r.font.name})
        paras.append({'text': p.text, 'style': p.style.name if p.style is not None else None,
                      'align': str(p.alignment) if p.alignment is not None else None, 'runs': runs})
    tables = [[[c.text for c in row.cells] for row in t.rows] for t in d.tables]
    sec = d.sections[0]
    images = sum(1 for r in d.part.rels.values() if 'image' in r.reltype)
    return {'paragraphs': paras, 'tables': tables, 'images': images,
            'page': {'width_in': round(sec.page_width.inches, 2), 'height_in': round(sec.page_height.inches, 2),
                     'left_in': round(sec.left_margin.inches, 2), 'top_in': round(sec.top_margin.inches, 2)},
            'header': '\n'.join(p.text for p in sec.header.paragraphs), 'footer': '\n'.join(p.text for p in sec.footer.paragraphs)}


def make_docx(path):
    import docx
    from docx.shared import Pt, RGBColor, Inches
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    d = docx.Document()
    s = d.sections[0]
    s.page_width, s.page_height = Inches(8.5), Inches(11)
    s.left_margin = s.right_margin = Inches(1)
    s.header.paragraphs[0].text = 'En-tête Word'
    d.add_heading('Rapport annuel', level=1)
    p = d.add_paragraph('Texte ')
    r = p.add_run('gras rouge')
    r.bold = True
    r.font.color.rgb = RGBColor(0xC0, 0x00, 0x00)
    r2 = p.add_run(' et italique Georgia 14')
    r2.italic = True
    r2.font.name = 'Georgia'
    r2.font.size = Pt(14)
    c = d.add_paragraph('Centré')
    c.alignment = WD_ALIGN_PARAGRAPH.CENTER
    d.add_paragraph('Premier point', style='List Bullet')
    d.add_paragraph('Deuxième point', style='List Bullet')
    d.add_paragraph('Étape un', style='List Number')
    d.add_heading('Chiffres', level=2)
    t = d.add_table(rows=2, cols=2)
    t.style = 'Table Grid'
    for i, row in enumerate([('Poste', 'Montant'), ('Loyer', '1 227 $')]):
        for j, v in enumerate(row):
            t.cell(i, j).text = v
    d.add_picture(io.BytesIO(png_bytes()), width=Inches(1))
    d.add_paragraph('Fin du document')
    d.save(path)


# ---------- PowerPoint ----------

def read_pptx(path):
    from pptx import Presentation
    pr = Presentation(path)
    slides = []
    for s in pr.slides:
        shapes = []
        for sh in s.shapes:
            item = {'kind': sh.shape_type and str(sh.shape_type), 'name': sh.name, 'text': sh.text_frame.text if sh.has_text_frame else None}
            if sh.has_text_frame:
                runs = [r for p in sh.text_frame.paragraphs for r in p.runs]
                item['bold'] = any(bool(r.font.bold) for r in runs)
                cols = []
                for r in runs:
                    try:
                        if r.font.color is not None and r.font.color.type is not None:
                            cols.append(color(r.font.color.rgb))
                    except Exception:
                        pass
                item['colors'] = [c for c in cols if c]
            try:
                if sh.fill.type == 1:
                    item['fill'] = color(sh.fill.fore_color.rgb)
            except Exception:
                pass
            if getattr(sh, 'has_table', False) and sh.has_table:
                item['table'] = [[c.text for c in row.cells] for row in sh.table.rows]
            if sh.shape_type == 13:
                item['picture'] = True
            shapes.append(item)
        notes = s.notes_slide.notes_text_frame.text if s.has_notes_slide else ''
        slides.append({'shapes': shapes, 'notes': notes, 'title': s.shapes.title.text if s.shapes.title is not None else None})
    return {'width': pr.slide_width, 'height': pr.slide_height, 'slides': slides}


def make_pptx(path):
    from pptx import Presentation
    from pptx.util import Inches, Pt
    from pptx.dml.color import RGBColor
    from pptx.enum.shapes import MSO_SHAPE
    pr = Presentation()
    pr.slide_width, pr.slide_height = Inches(13.333), Inches(7.5)
    s = pr.slides.add_slide(pr.slide_layouts[0])
    s.shapes.title.text = 'Présentation PowerPoint'
    s.placeholders[1].text = 'Sous-titre'
    s2 = pr.slides.add_slide(pr.slide_layouts[1])
    s2.shapes.title.text = 'Plan'
    body = s2.placeholders[1].text_frame
    body.text = 'Un'
    p = body.add_paragraph()
    p.text = 'Un et demi'
    p.level = 1
    p2 = body.add_paragraph()
    run = p2.add_run()
    run.text = 'Deux en rouge'
    run.font.bold = True
    run.font.color.rgb = RGBColor(0xFF, 0x00, 0x00)
    run.font.size = Pt(28)
    box = s2.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(8), Inches(5), Inches(3), Inches(1.2))
    box.text = 'Forme verte'
    box.fill.solid()
    box.fill.fore_color.rgb = RGBColor(0x70, 0xAD, 0x47)
    tbl = s2.shapes.add_table(2, 2, Inches(8), Inches(2), Inches(4), Inches(1.5)).table
    for i, row in enumerate([('A', 'B'), ('1', '2')]):
        for j, v in enumerate(row):
            tbl.cell(i, j).text = v
    s2.shapes.add_picture(io.BytesIO(png_bytes()), Inches(1), Inches(5.5), Inches(1), Inches(1))
    s2.notes_slide.notes_text_frame.text = 'Notes du présentateur'
    pr.save(path)


# ---------- Mail, calendar, contacts (Outlook, Gmail, Apple Mail, Google/Apple calendars) ----------

def read_eml(path):
    from email import policy
    from email.parser import BytesParser
    with open(path, 'rb') as f:
        m = BytesParser(policy=policy.default).parse(f)
    html = m.get_body(preferencelist=('html',))
    plain = m.get_body(preferencelist=('plain',))
    atts = [{'name': a.get_filename(), 'type': a.get_content_type(), 'size': len(a.get_payload(decode=True) or b'')} for a in m.iter_attachments()]
    return {'from': str(m['from']), 'to': str(m['to']), 'cc': str(m['cc'] or ''), 'subject': str(m['subject']),
            'html': html.get_content() if html else None, 'text': plain.get_content() if plain else None, 'attachments': atts,
            'defects': [str(d) for d in m.defects]}


def make_eml(path):
    from email.message import EmailMessage
    m = EmailMessage()
    m['From'] = 'Zoé Tremblay <zoe@example.com>'
    m['To'] = 'Martin <martin@example.com>, Ana <ana@example.com>'
    m['Cc'] = 'Équipe <equipe@example.com>'
    m['Subject'] = 'Réunion de lundi — budget 2027'
    m['Date'] = 'Fri, 06 Nov 2026 10:00:00 -0500'
    m.set_content('Bonjour Martin,\nVoici le budget.\nZoé')
    m.add_alternative('<p>Bonjour <b>Martin</b>,</p><p style="color:#c00000">Voici le budget.</p><p>Zoé</p>', subtype='html')
    m.add_attachment(png_bytes(), maintype='image', subtype='png', filename='graphique.png')
    with open(path, 'wb') as f:
        f.write(bytes(m))


def read_ics(path):
    import icalendar
    with open(path, 'rb') as f:
        cal = icalendar.Calendar.from_ical(f.read())
    return {'events': [{'summary': str(e.get('summary')), 'start': e.decoded('dtstart').isoformat(), 'end': e.decoded('dtend').isoformat(),
                        'description': str(e.get('description') or '')} for e in cal.walk('VEVENT')]}


def read_vcf(path):
    import vobject
    with open(path, encoding='utf-8') as f:
        cards = list(vobject.readComponents(f.read()))
    return {'cards': [{'name': c.fn.value, 'emails': [e.value for e in c.contents.get('email', [])]} for c in cards]}


def make_vcf(path):
    import vobject
    out = []
    for name, mail in [('Zoé Tremblay', 'zoe@example.com'), ('Ana Souza', 'ana@example.com')]:
        c = vobject.vCard()
        c.add('fn').value = name
        c.add('n').value = vobject.vcard.Name(family=name.split()[1], given=name.split()[0])
        e = c.add('email')
        e.value = mail
        e.type_param = 'INTERNET'
        out.append(c.serialize())
    with open(path, 'w', encoding='utf-8') as f:
        f.write(''.join(out))


if __name__ == '__main__':
    cmd, path = sys.argv[1], sys.argv[2]
    if cmd.startswith('read-'):
        json.dump({'read-xlsx': read_xlsx, 'read-docx': read_docx, 'read-pptx': read_pptx, 'read-eml': read_eml, 'read-ics': read_ics, 'read-vcf': read_vcf}[cmd](path), sys.stdout, ensure_ascii=False, default=str)
    else:
        {'make-xlsx': make_xlsx, 'make-docx': make_docx, 'make-pptx': make_pptx, 'make-eml': make_eml, 'make-vcf': make_vcf}[cmd](path)
