/**
 * gen_hebrew_light_doc.js
 * Generates a Hebrew-only RTL Word document with screenshots (light mode).
 * Output: docs/Shared_Parking_Hebrew_Light.docx
 */

'use strict';
const fs   = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, ImageRun,
  HeadingLevel, AlignmentType, PageBreak,
  Header, Footer, PageNumber, Bookmark, InternalHyperlink, BorderStyle,
} = require('C:/src/nvm/v25.4.0/node_modules/docx');

const HE_LIGHT_DIR = path.join(__dirname, 'screenshots', 'he_light');
const OUTPUT       = path.join(__dirname, 'Shared_Parking_Hebrew_Light.docx');
const TARGET_W     = 468; // points

// ── Screen metadata ────────────────────────────────────────────────────────────
const SCREENS = [
  {
    file:   '01_login.png',
    anchor: 'he_01',
    title:  'מסך כניסה',
    desc:   'מסך הכניסה למערכת עם תגיות מילוי מהיר לחשבונות דמו ומעבר מהיר בין תפקידים.',
  },
  {
    file:   '02_my_requests.png',
    anchor: 'he_02',
    title:  'הבקשות שלי',
    desc:   'רשימת בקשות החנייה של המשתמש עם תגיות סטטוס, חלונות זמן ואפשרות ביטול.',
  },
  {
    file:   '03_new_request.png',
    anchor: 'he_03',
    title:  'בקשת חנייה חדשה',
    desc:   'טופס להגשת בקשת חנייה חדשה עם שדות תאריך, שעה ומשך זמן.',
  },
  {
    file:   '04_requests_view.png',
    anchor: 'he_04',
    title:  'לוח שנה — בקשות',
    desc:   'תצוגת לוח שנה של כל הבקשות המאושרות — יום, שבוע או חודש.',
  },
  {
    file:   '05_pending_requests.png',
    anchor: 'he_05',
    title:  'בקשות ממתינות',
    desc:   'רשימת בקשות הממתינות לאישור בעל חנייה או מנהל, עם חיפוש וסינון.',
  },
  {
    file:   '06_approvals.png',
    anchor: 'he_06',
    title:  'היסטוריית אישורים',
    desc:   'היסטוריית אישורים מלאה הכוללת בקשות מאושרות ודחויות עם פרטי שיבוץ החנייה.',
  },
  {
    file:   '07_parking_status.png',
    anchor: 'he_07',
    title:  'לוח סטטוס חנייה',
    desc:   'לוח תפוסת חנייה בזמן אמת עם בורר תאריך ושעה לצפייה בכל נקודת זמן.',
  },
  {
    file:   '08_lot_calendar.png',
    anchor: 'he_08',
    title:  'לוח שנה לחנייה (בעלת חנייה)',
    desc:   'תצוגת לוח שנה לבעלת חנייה — הזמנות, בקשות ממתינות וחלונות זמן פנויים.',
  },
  {
    file:   '09_my_lots.png',
    anchor: 'he_09',
    title:  'החניות שלי (בעלת חנייה)',
    desc:   'מסך ניהול חניות לבעלת חנייה — צפייה, הוספה, עריכה והגדרת חניות.',
  },
  {
    file:   '10_notifications.png',
    anchor: 'he_10',
    title:  'חלונות התראות',
    desc:   'הגדרת העדפות התראות לניהול חלונות זמן עבור כל יום בשבוע.',
  },
];

// ── TOC link labels ────────────────────────────────────────────────────────────
const TOC_ENTRIES = [
  { num: '01', anchor: 'he_01', label: 'מסך כניסה' },
  { num: '02', anchor: 'he_02', label: 'הבקשות שלי' },
  { num: '03', anchor: 'he_03', label: 'בקשת חנייה חדשה' },
  { num: '04', anchor: 'he_04', label: 'לוח שנה — בקשות' },
  { num: '05', anchor: 'he_05', label: 'בקשות ממתינות' },
  { num: '06', anchor: 'he_06', label: 'היסטוריית אישורים' },
  { num: '07', anchor: 'he_07', label: 'לוח סטטוס חנייה' },
  { num: '08', anchor: 'he_08', label: 'לוח שנה לחנייה (בעלת חנייה)' },
  { num: '09', anchor: 'he_09', label: 'החניות שלי (בעלת חנייה)' },
  { num: '10', anchor: 'he_10', label: 'חלונות התראות' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function imgParagraph(imgBuf, filename) {
  const w     = imgBuf.readUInt32BE(16);
  const h     = imgBuf.readUInt32BE(20);
  const scale = TARGET_W / w;
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing:   { after: 80 },
    children:  [
      new ImageRun({
        type:           'png',
        data:           imgBuf,
        transformation: { width: Math.round(TARGET_W), height: Math.round(h * scale) },
        altText:        { title: filename, description: filename, name: filename },
      }),
    ],
  });
}

function separator() {
  return new Paragraph({
    border:   { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DDDDDD', space: 1 } },
    children: [],
  });
}

function heHeading(text, anchor) {
  return new Paragraph({
    heading:       HeadingLevel.HEADING_2,
    bidirectional: true,
    alignment:     AlignmentType.RIGHT,
    spacing:       { before: 160, after: 120 },
    children: [
      new Bookmark({
        id:       anchor,
        children: [new TextRun({ text, size: 26, bold: true, font: 'Arial', rightToLeft: true })],
      }),
    ],
  });
}

function heDesc(text) {
  return new Paragraph({
    bidirectional: true,
    alignment:     AlignmentType.RIGHT,
    spacing:       { after: 160 },
    children: [new TextRun({ text, size: 22, font: 'Arial', color: '555555', italics: true, rightToLeft: true })],
  });
}

// ── Document builder ────────────────────────────────────────────────────────────
function buildDoc() {
  const children = [];

  // ── Title page ──────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({ spacing: { before: 2800 }, children: [] }),

    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing:   { after: 180 },
      children:  [new TextRun({ text: 'מערכת חנייה משותפת', size: 104, bold: true, font: 'Arial', rightToLeft: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing:   { after: 180 },
      children:  [new TextRun({ text: 'צילומי מסך — מצב יום, עברית', size: 68, font: 'Arial', color: '555555', rightToLeft: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing:   { after: 180 },
      children:  [new TextRun({ text: 'Sarah — בעלת חנייה', size: 52, font: 'Arial', color: '888888', rightToLeft: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing:   { after: 400 },
      children:  [new TextRun({ text: '12 באפריל 2026', size: 44, font: 'Arial', color: 'AAAAAA', rightToLeft: true })],
    }),

    pageBreak(),
  );

  // ── Table of Contents ───────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      alignment:     AlignmentType.RIGHT,
      bidirectional: true,
      spacing:       { after: 160 },
      children:      [new TextRun({ text: 'תוכן העניינים', size: 60, bold: true, font: 'Arial', rightToLeft: true })],
    }),
  );

  TOC_ENTRIES.forEach(({ num, anchor, label }) => {
    children.push(new Paragraph({
      alignment:     AlignmentType.RIGHT,
      bidirectional: true,
      spacing:       { after: 80 },
      children: [
        new TextRun({ text: `${num}.  `, size: 44, font: 'Arial' }),
        new InternalHyperlink({
          anchor,
          children: [new TextRun({ text: label, style: 'Hyperlink', size: 44, font: 'Arial', rightToLeft: true })],
        }),
      ],
    }));
  });

  children.push(pageBreak());

  // ── Screen sections ─────────────────────────────────────────────────────────
  SCREENS.forEach((s, i) => {
    const num    = String(i + 1).padStart(2, '0');
    const imgBuf = fs.readFileSync(path.join(HE_LIGHT_DIR, s.file));

    children.push(
      heHeading(`${num}. ${s.title}`, s.anchor),
      heDesc(s.desc),
      imgParagraph(imgBuf, s.file),
      separator(),
    );

    if (i < SCREENS.length - 1) children.push(pageBreak());
  });

  // ── Assemble document ───────────────────────────────────────────────────────
  return new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 24 } } },
      paragraphStyles: [
        {
          id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run:       { size: 28, bold: true, font: 'Arial' },
          paragraph: { spacing: { before: 160, after: 120 } },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size:   { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment:     AlignmentType.RIGHT,
            bidirectional: true,
            children: [new TextRun({
              text:        'מערכת חנייה משותפת — צילומי מסך',
              size:        18,
              font:        'Arial',
              color:       'AAAAAA',
              rightToLeft: true,
            })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'עמוד ', size: 18, font: 'Arial', color: 'AAAAAA' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 18, font: 'Arial', color: 'AAAAAA' }),
            ],
          })],
        }),
      },
      children,
    }],
  });
}

(async () => {
  console.log('Building Hebrew light document...');
  const doc    = buildDoc();
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUTPUT, buffer);
  console.log(`Created: ${OUTPUT}`);
  console.log(`Size: ${(buffer.length / 1024).toFixed(1)} KB`);
})();
