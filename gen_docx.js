const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel,
        AlignmentType, PageBreak, Header, Footer, PageNumber,
        InternalHyperlink, Bookmark, BorderStyle } = require('docx');

const SCREENSHOT_DIR = path.join(__dirname, 'docs', 'screenshots');
const OUTPUT = path.join(SCREENSHOT_DIR, 'Screen_Captures.docx');

const SCREENS = [
  { file: '01_login.png',            title: 'Login Page',           desc: 'Sign-in screen with demo account quick-fill tags for fast switching between roles.' },
  { file: '02_my_requests.png',      title: 'My Requests',          desc: 'Displays the current user\'s active parking requests with status tags, time slots, and cancel actions.' },
  { file: '03_new_request.png',      title: 'New Request',          desc: 'Form to submit a new parking request with date, time, and duration fields.' },
  { file: '04_requests_view.png',    title: 'Requests View',        desc: 'Calendar view showing all requests across the system in day, week, or month layout.' },
  { file: '05_pending_requests.png', title: 'Pending Requests',     desc: 'List of pending requests awaiting owner or manager approval, with filter controls.' },
  { file: '06_approvals.png',        title: 'Approvals',            desc: 'Approval history showing approved and rejected requests with lot assignment details.' },
  { file: '07_parking_status.png',   title: 'Parking Status',       desc: 'Real-time lot occupancy board with datetime picker to view status at any point in time.' },
  { file: '08_lot_calendar.png',     title: 'Lot Calendar',         desc: 'Owner\'s calendar view of lot bookings, pending requests, blocked periods, and available slots.' },
  { file: '09_my_lots.png',          title: 'My Lots',              desc: 'Owner\'s lot management screen for viewing and configuring owned parking lots.' },
  { file: '10_notifications.png',    title: 'Notification Windows', desc: 'Notification preference configuration for managing alert time windows.' },
];

// Target image width: 9360 DXA content width = 6.5 inches = ~468pt
const TARGET_WIDTH_PT = 468;

function buildDoc() {
  const tocEntries = [];
  const contentChildren = [];

  // Title page
  contentChildren.push(
    new Paragraph({ spacing: { before: 3000 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: 'Shared Parking', size: 52, bold: true, font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: 'Screen Captures', size: 40, bold: true, font: 'Arial', color: '555555' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: 'Dark Mode \u2014 Sarah (Owner Role)', size: 28, font: 'Arial', color: '777777' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }), size: 24, font: 'Arial', color: '999999' })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // Table of Contents (manual)
  contentChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 300 },
      children: [new TextRun({ text: 'Table of Contents', size: 32, bold: true, font: 'Arial' })],
    }),
  );

  SCREENS.forEach((s, i) => {
    const num = String(i + 1).padStart(2, '0');
    const anchor = `screen_${num}`;
    contentChildren.push(
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({ text: `${num}.  `, size: 22, font: 'Arial' }),
          new InternalHyperlink({
            anchor,
            children: [new TextRun({ text: s.title, style: 'Hyperlink', size: 22, font: 'Arial' })],
          }),
        ],
      }),
    );
  });

  contentChildren.push(new Paragraph({ children: [new PageBreak()] }));

  // Screen sections
  SCREENS.forEach((s, i) => {
    const num = String(i + 1).padStart(2, '0');
    const anchor = `screen_${num}`;
    const imgPath = path.join(SCREENSHOT_DIR, s.file);
    const imgBuf = fs.readFileSync(imgPath);

    // Read PNG dimensions
    const imgW = imgBuf.readUInt32BE(16);
    const imgH = imgBuf.readUInt32BE(20);
    const scale = TARGET_WIDTH_PT / imgW;
    const displayW = Math.round(TARGET_WIDTH_PT);
    const displayH = Math.round(imgH * scale);

    // Heading with bookmark
    contentChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 200, after: 200 },
        children: [
          new TextRun({ text: `${num}. `, size: 28, bold: true, font: 'Arial' }),
          new Bookmark({
            id: anchor,
            children: [new TextRun({ text: s.title, size: 28, bold: true, font: 'Arial' })],
          }),
        ],
      }),
    );

    // Description
    contentChildren.push(
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: s.desc, size: 22, font: 'Arial', color: '444444', italics: true })],
      }),
    );

    // Image
    contentChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        children: [
          new ImageRun({
            type: 'png',
            data: imgBuf,
            transformation: { width: displayW, height: displayH },
            altText: { title: s.title, description: s.desc, name: s.file },
          }),
        ],
      }),
    );

    // Separator line
    contentChildren.push(
      new Paragraph({
        spacing: { before: 100, after: 100 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC', space: 1 } },
        children: [],
      }),
    );

    // Page break (except after last)
    if (i < SCREENS.length - 1) {
      contentChildren.push(new Paragraph({ children: [new PageBreak()] }));
    }
  });

  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 24 } } },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: 'Arial' },
          paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'Shared Parking \u2014 Screen Captures', size: 18, font: 'Arial', color: '999999' })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Page ', size: 18, font: 'Arial', color: '999999' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 18, font: 'Arial', color: '999999' }),
            ],
          })],
        }),
      },
      children: contentChildren,
    }],
  });

  return doc;
}

(async () => {
  const doc = buildDoc();
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(OUTPUT, buffer);
  console.log(`Created: ${OUTPUT}`);
  console.log(`Size: ${(buffer.length / 1024).toFixed(0)} KB`);
})();
