/**
 * gen_bilingual_doc.js
 * Generates a bilingual (English + Hebrew) Word document with screenshots.
 * English section first (LTR), then Hebrew section (RTL).
 * Output: docs/Shared_Parking_Bilingual.docx
 */

'use strict';
const fs   = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, ImageRun,
  HeadingLevel, AlignmentType, PageBreak,
  Header, Footer, PageNumber, Bookmark, InternalHyperlink, BorderStyle,
} = require('docx');

const EN_DIR  = path.join(__dirname, 'screenshots', 'en');
const HE_DIR  = path.join(__dirname, 'screenshots', 'he');
const OUTPUT  = path.join(__dirname, 'Shared_Parking_Bilingual.docx');

const TARGET_W = 468; // points (~6.5 inches)

// ── Screen metadata ────────────────────────────────────────────────────────────
const SCREENS = [
  {
    file: '01_login.png',
    en: { title: 'Login Page',
          desc:  'Sign-in screen with demo account quick-fill tags for fast role switching.' },
    he: { title: 'מסך כניסה',
          desc:  'מסך הכניסה עם תגיות מילוי מהיר לחשבונות דמו ומעבר מהיר בין תפקידים.' },
  },
  {
    file: '02_my_requests.png',
    en: { title: 'My Requests',
          desc:  'Displays the current user\'s parking requests with status tags, time slots, and cancel actions.' },
    he: { title: 'הבקשות שלי',
          desc:  'מציג את בקשות החנייה של המשתמש הנוכחי עם תגיות סטטוס, חלונות זמן, ואפשרות ביטול.' },
  },
  {
    file: '03_new_request.png',
    en: { title: 'New Parking Request',
          desc:  'Form to submit a new parking request with date, time, and duration fields.' },
    he: { title: 'בקשת חנייה חדשה',
          desc:  'טופס להגשת בקשת חנייה חדשה עם שדות תאריך, שעה ומשך זמן.' },
  },
  {
    file: '04_requests_view.png',
    en: { title: 'Requests Calendar View',
          desc:  'Calendar view of all approved requests across the system — day, week, or month layout.' },
    he: { title: 'תצוגת לוח שנה — בקשות',
          desc:  'תצוגת לוח שנה של כל הבקשות המאושרות במערכת — יום, שבוע, או חודש.' },
  },
  {
    file: '05_pending_requests.png',
    en: { title: 'Pending Requests',
          desc:  'List of pending requests awaiting owner or manager approval, with search and filters.' },
    he: { title: 'בקשות ממתינות',
          desc:  'רשימת בקשות הממתינות לאישור בעל חנייה או מנהל, עם חיפוש וסינון.' },
  },
  {
    file: '06_approvals.png',
    en: { title: 'Approvals History',
          desc:  'Full approval history showing approved and rejected requests with lot assignment details.' },
    he: { title: 'היסטוריית אישורים',
          desc:  'היסטוריית אישורים מלאה המציגה בקשות מאושרות ודחויות עם פרטי שיבוץ חניה.' },
  },
  {
    file: '07_parking_status.png',
    en: { title: 'Parking Status Board',
          desc:  'Real-time lot occupancy board with a datetime picker to view status at any point in time.' },
    he: { title: 'לוח סטטוס חנייה',
          desc:  'לוח תפוסת חנייה בזמן אמת עם בורר תאריך ושעה לצפייה בסטטוס בנקודת זמן כלשהי.' },
  },
  {
    file: '08_lot_calendar.png',
    en: { title: 'Lot Calendar (Owner)',
          desc:  'Owner\'s calendar view of lot bookings, pending requests, and available time slots.' },
    he: { title: 'לוח שנה לחנייה (בעל חנייה)',
          desc:  'תצוגת לוח שנה לבעל חנייה — הזמנות, בקשות ממתינות וחלונות זמן פנויים.' },
  },
  {
    file: '09_my_lots.png',
    en: { title: 'My Lots (Owner)',
          desc:  'Owner\'s lot management screen — view, add, edit, and configure owned parking lots.' },
    he: { title: 'החניות שלי (בעל חנייה)',
          desc:  'מסך ניהול חניות לבעל חנייה — צפייה, הוספה, עריכה והגדרה של חניות בבעלותו.' },
  },
  {
    file: '10_notifications.png',
    en: { title: 'Notification Windows',
          desc:  'Notification preference configuration for managing alert time windows per day.' },
    he: { title: 'חלונות התראות',
          desc:  'הגדרת העדפות התראות לניהול חלונות זמן להתראות עבור כל יום.' },
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function imgParagraph(imgBuf, filename) {
  const w = imgBuf.readUInt32BE(16);
  const h = imgBuf.readUInt32BE(20);
  const scale = TARGET_W / w;
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 80 },
    children: [
      new ImageRun({
        type: 'png',
        data: imgBuf,
        transformation: { width: Math.round(TARGET_W), height: Math.round(h * scale) },
        altText: { title: filename, description: filename, name: filename },
      }),
    ],
  });
}

function separator() {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC', space: 1 } },
    children: [],
  });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

function enHeading(text, anchor) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 160, after: 120 },
    children: [
      anchor
        ? new Bookmark({ id: anchor, children: [new TextRun({ text, size: 26, bold: true, font: 'Arial' })] })
        : new TextRun({ text, size: 26, bold: true, font: 'Arial' }),
    ],
  });
}

function enDesc(text) {
  return new Paragraph({
    spacing: { after: 160 },
    children: [new TextRun({ text, size: 22, font: 'Arial', color: '444444', italics: true })],
  });
}

function heHeading(text, anchor) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { before: 160, after: 120 },
    children: [
      anchor
        ? new Bookmark({ id: anchor, children: [new TextRun({ text, size: 26, bold: true, font: 'Arial', rightToLeft: true })] })
        : new TextRun({ text, size: 26, bold: true, font: 'Arial', rightToLeft: true }),
    ],
  });
}

function heDesc(text) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { after: 160 },
    children: [new TextRun({ text, size: 22, font: 'Arial', color: '444444', italics: true, rightToLeft: true })],
  });
}

// ── Document builder ────────────────────────────────────────────────────────────
function buildDoc() {
  const children = [];
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  // ── Title page ──────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({ spacing: { before: 2800 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [new TextRun({ text: 'Shared Parking', size: 56, bold: true, font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [new TextRun({ text: 'מערכת חנייה משותפת', size: 40, bold: true, font: 'Arial', rightToLeft: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      children: [new TextRun({ text: 'Screen Captures  •  צילומי מסך', size: 30, font: 'Arial', color: '555555' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [new TextRun({ text: 'Dark Mode — Sarah (Owner Role)', size: 24, font: 'Arial', color: '888888' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: dateStr, size: 22, font: 'Arial', color: 'AAAAAA' })],
    }),
    pageBreak(),
  );

  // ── Table of Contents ───────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 160 },
      children: [new TextRun({ text: 'Table of Contents', size: 32, bold: true, font: 'Arial' })],
    }),
  );
  SCREENS.forEach((s, i) => {
    const num = String(i + 1).padStart(2, '0');
    children.push(new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: `${num}.  `, size: 22, font: 'Arial' }),
        new InternalHyperlink({
          anchor: `en_${num}`,
          children: [new TextRun({ text: s.en.title, style: 'Hyperlink', size: 22, font: 'Arial' })],
        }),
        new TextRun({ text: '   •   ', size: 22, font: 'Arial', color: 'AAAAAA' }),
        new InternalHyperlink({
          anchor: `he_${num}`,
          children: [new TextRun({ text: s.he.title, style: 'Hyperlink', size: 22, font: 'Arial', rightToLeft: true })],
        }),
      ],
    }));
  });
  children.push(pageBreak());

  // ══ PART 1 — ENGLISH ════════════════════════════════════════════════════════
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 320 },
      children: [new TextRun({ text: 'Part 1 — English', size: 36, bold: true, font: 'Arial' })],
    }),
  );

  SCREENS.forEach((s, i) => {
    const num = String(i + 1).padStart(2, '0');
    const anchor = `en_${num}`;
    const imgPath = path.join(EN_DIR, s.file);
    const imgBuf  = fs.readFileSync(imgPath);

    children.push(
      enHeading(`${num}. ${s.en.title}`, anchor),
      enDesc(s.en.desc),
      imgParagraph(imgBuf, s.file),
      separator(),
    );
    if (i < SCREENS.length - 1) children.push(pageBreak());
  });

  children.push(pageBreak());

  // ══ PART 2 — HEBREW ═════════════════════════════════════════════════════════
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      spacing: { before: 240, after: 320 },
      children: [new TextRun({ text: 'חלק ב — עברית', size: 36, bold: true, font: 'Arial', rightToLeft: true })],
    }),
  );

  SCREENS.forEach((s, i) => {
    const num = String(i + 1).padStart(2, '0');
    const anchor = `he_${num}`;
    const imgPath = path.join(HE_DIR, s.file);
    const imgBuf  = fs.readFileSync(imgPath);

    children.push(
      heHeading(`${num}. ${s.he.title}`, anchor),
      heDesc(s.he.desc),
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
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 32, bold: true, font: 'Arial', color: '111111' },
          paragraph: { spacing: { before: 240, after: 240 } },
        },
        {
          id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, font: 'Arial', color: '222222' },
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
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'Shared Parking — Screen Captures  •  צילומי מסך', size: 18, font: 'Arial', color: 'AAAAAA' })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Page ', size: 18, font: 'Arial', color: 'AAAAAA' }),
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
  console.log('Building bilingual document...');
  const doc    = buildDoc();
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUTPUT, buffer);
  console.log(`Created: ${OUTPUT}`);
  console.log(`Size: ${(buffer.length / 1024).toFixed(0)} KB`);
})();
