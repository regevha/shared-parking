// Build Shared_Parking_Design.docx from the assembled markdown source.
// Usage: node scripts/build_docx.js
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, TabStopType, TabStopPosition,
  TableOfContents, HeadingLevel, BorderStyle, WidthType, ShadingType,
  PageNumber, PageBreak
} = require('docx');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'docs', 'Shared_Parking_Design.md');
const OUT = path.join(ROOT, 'docs', 'Shared_Parking_Design.docx');

const md = fs.readFileSync(SRC, 'utf8');

// ── Inline run parser: bold **...**, code `...`, plain ────────────────────────
function parseRuns(text, baseOpts = {}) {
  const runs = [];
  let i = 0;
  while (i < text.length) {
    if (text.startsWith('**', i)) {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        runs.push(new TextRun({ ...baseOpts, text: text.slice(i + 2, end), bold: true }));
        i = end + 2;
        continue;
      }
    }
    if (text[i] === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        runs.push(new TextRun({ ...baseOpts, text: text.slice(i + 1, end), font: 'Consolas' }));
        i = end + 1;
        continue;
      }
    }
    // accumulate plain until next special
    let j = i;
    while (j < text.length && !text.startsWith('**', j) && text[j] !== '`') j++;
    if (j > i) {
      runs.push(new TextRun({ ...baseOpts, text: text.slice(i, j) }));
      i = j;
    } else {
      // Safety fallback
      runs.push(new TextRun({ ...baseOpts, text: text[i] }));
      i++;
    }
  }
  if (runs.length === 0) runs.push(new TextRun({ ...baseOpts, text: '' }));
  return runs;
}

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

function stripInlineFormatting(s) {
  return s.replace(/\*\*/g, '').replace(/`/g, '');
}

function buildTable(headerCells, rows) {
  const totalWidth = 9360;
  const colCount = headerCells.length;
  const colWidth = Math.floor(totalWidth / colCount);
  const columnWidths = Array(colCount).fill(colWidth);
  // adjust last to account for rounding
  columnWidths[colCount - 1] = totalWidth - colWidth * (colCount - 1);

  const mkCell = (text, isHeader) => new TableCell({
    borders: BORDERS,
    width: { size: columnWidths[0], type: WidthType.DXA },
    shading: isHeader ? { fill: 'D5E8F0', type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: parseRuns(text, { bold: isHeader, size: 20 }) })],
  });

  const headerRow = new TableRow({
    tableHeader: true,
    children: headerCells.map(c => mkCell(c, true)),
  });
  const bodyRows = rows.map(r => new TableRow({
    children: r.map((c, idx) => new TableCell({
      borders: BORDERS,
      width: { size: columnWidths[idx], type: WidthType.DXA },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: parseRuns(c, { size: 20 }) })],
    })),
  }));

  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths,
    rows: [headerRow, ...bodyRows],
  });
}

// ── Markdown walker ───────────────────────────────────────────────────────────
function convert(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0;

  while (i < lines.length) {
    let line = lines[i];

    // skip blank
    if (line.trim() === '') { i++; continue; }

    // horizontal rule
    if (/^---+\s*$/.test(line)) {
      out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '888888', space: 4 } }, children: [new TextRun('')] }));
      i++;
      continue;
    }

    // headings
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2].trim();
      const heading = level === 1 ? HeadingLevel.HEADING_1
                   : level === 2 ? HeadingLevel.HEADING_2
                   : level === 3 ? HeadingLevel.HEADING_3
                   : HeadingLevel.HEADING_4;
      out.push(new Paragraph({ heading, children: parseRuns(text) }));
      i++;
      continue;
    }

    // blockquote (treat as italic indented)
    if (line.startsWith('> ')) {
      const parts = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        parts.push(lines[i].slice(2));
        i++;
      }
      out.push(new Paragraph({
        indent: { left: 360 },
        children: parseRuns(parts.join(' '), { italics: true, color: '555555' }),
      }));
      continue;
    }

    // table
    if (line.trim().startsWith('|') && i + 1 < lines.length && /^\s*\|[\s|:-]+\|\s*$/.test(lines[i + 1])) {
      const parseRow = (ln) => ln.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(s => s.trim());
      const header = parseRow(line);
      i += 2; // skip header + separator
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(parseRow(lines[i]));
        i++;
      }
      // normalize row lengths
      const cols = header.length;
      const normRows = rows.map(r => {
        const copy = r.slice(0, cols);
        while (copy.length < cols) copy.push('');
        return copy;
      });
      out.push(buildTable(header, normRows));
      out.push(new Paragraph({ children: [new TextRun('')] })); // spacer
      continue;
    }

    // unordered list
    if (/^[-*]\s+/.test(line)) {
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        const text = lines[i].replace(/^[-*]\s+/, '');
        out.push(new Paragraph({
          numbering: { reference: 'bullets', level: 0 },
          children: parseRuns(text),
        }));
        i++;
      }
      continue;
    }

    // ordered list
    if (/^\d+\.\s+/.test(line)) {
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        const text = lines[i].replace(/^\d+\.\s+/, '');
        out.push(new Paragraph({
          numbering: { reference: 'numbers', level: 0 },
          children: parseRuns(text),
        }));
        i++;
      }
      continue;
    }

    // paragraph — accumulate until blank line or structural token
    const para = [line];
    i++;
    while (i < lines.length) {
      const nxt = lines[i];
      if (nxt.trim() === '') break;
      if (/^#{1,4}\s+/.test(nxt)) break;
      if (/^---+\s*$/.test(nxt)) break;
      if (nxt.trim().startsWith('|')) break;
      if (/^[-*]\s+/.test(nxt)) break;
      if (/^\d+\.\s+/.test(nxt)) break;
      if (nxt.startsWith('> ')) break;
      para.push(nxt);
      i++;
    }
    out.push(new Paragraph({ children: parseRuns(para.join(' ')) }));
  }

  return out;
}

const bodyChildren = convert(md);

// ── Title page ────────────────────────────────────────────────────────────────
const titlePage = [
  new Paragraph({ spacing: { before: 2400 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Shared Parking', size: 56, bold: true })] }),
  new Paragraph({ spacing: { before: 200 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'System Design Document', size: 40, bold: true, color: '2E75B6' })] }),
  new Paragraph({ spacing: { before: 600 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Basis for a new development project', size: 28, italics: true, color: '555555' })] }),
  new Paragraph({ spacing: { before: 2400 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Audience: Product Manager & Software Architect', size: 24 })] }),
  new Paragraph({ spacing: { before: 200 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: new Date().toISOString().slice(0, 10), size: 22, color: '777777' })] }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ── TOC page ──────────────────────────────────────────────────────────────────
const tocPage = [
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Table of Contents')] }),
  new Paragraph({ children: [new TextRun({ text: '(Update the TOC in Word: right-click → Update Field, or press F9.)', italics: true, color: '777777', size: 20 })] }),
  new Paragraph({ children: [new TextRun('')] }),
  new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-3' }),
  new Paragraph({ children: [new PageBreak()] }),
];

// ── Document ──────────────────────────────────────────────────────────────────
const doc = new Document({
  creator: 'Claude',
  title: 'Shared Parking — System Design Document',
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, font: 'Arial', color: '1F3864' },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, font: 'Arial', color: '2E75B6' },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 24, bold: true, font: 'Arial', color: '2E75B6' },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
      { id: 'Heading4', name: 'Heading 4', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, italics: true, font: 'Arial' },
        paragraph: { spacing: { before: 160, after: 100 }, outlineLevel: 3 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets',
        levels: [{ level: 0, format: LevelFormat.BULLET, text: '\u2022', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: 'numbers',
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 }, // US Letter
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'Shared Parking — System Design', size: 18, color: '888888' })],
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'Page ', size: 18, color: '888888' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '888888' }),
            new TextRun({ text: ' of ', size: 18, color: '888888' }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: '888888' }),
          ],
        })],
      }),
    },
    children: [...titlePage, ...tocPage, ...bodyChildren],
  }],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(OUT, buf);
  console.log('Wrote', OUT, buf.length, 'bytes');
});
