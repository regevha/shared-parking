const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, ImageRun,
  HeadingLevel, AlignmentType, PageOrientation,
  Header, Footer, PageNumber, BorderStyle,
} = require('docx');

const SS = path.join(__dirname, 'screenshots');

const screens = [
  {
    file: '01_login.png',
    title: '1. Login',
    role: '',
    desc: 'The login screen greets unauthenticated users. Quick-fill tags let reviewers sign in as User, Owner or Manager instantly using the demo accounts (password: password123).',
  },
  {
    file: '02_my_requests.png',
    title: '2. My Requests',
    role: 'Role: User',
    desc: 'Lists the current user\'s active parking requests (pending + approved). On mobile the table switches to a card layout. Pending requests can be edited; any request can be cancelled. Stats cards at the bottom summarise totals.',
  },
  {
    file: '03_new_request.png',
    title: '3. New Request',
    role: 'Role: User',
    desc: 'Form for submitting a new parking request. Shows the user\'s active requests (max 3) with real-time status badges. Duration options are dynamically filtered so the end time never exceeds 20:00. Business rules are summarised in an info card at the bottom.',
  },
  {
    file: '04_requests_view.png',
    title: '4. Requests View (Calendar)',
    role: 'Role: User',
    desc: 'A react-big-calendar showing all requests across the system. The current user\'s own events are starred. Default view is Day on mobile, Week on desktop. Stats cards below show total, pending, approved and rejected counts.',
  },
  {
    file: '05_request_detail.png',
    title: '5. Request Detail',
    role: 'Role: User',
    desc: 'Detailed view of a single request showing full metadata and — for approved requests — assigned lot, floor, owner and approval timestamp. A live message thread below allows the requester and the lot owner to communicate. Messages are persisted server-side with 7-day audit retention.',
  },
  {
    file: '06_pending_requests.png',
    title: '6. Pending Requests',
    role: 'Role: Owner',
    desc: 'Lists all requests awaiting approval. Owners see Approve / Reject action buttons; the owner\'s own requests are tagged "(You)". A toggle hides previously rejected requests. Time-conflict detection prevents approving overlapping slots on the same lot.',
  },
  {
    file: '07_approvals.png',
    title: '7. Approvals',
    role: 'Role: Owner / Manager',
    desc: 'Full history of all approved requests across the system. Rows where the current owner is the lot owner are highlighted. Actions column links to the Request Detail page or opens a message preview.',
  },
  {
    file: '08_parking_status.png',
    title: '8. Parking Status',
    role: 'Role: All',
    desc: 'Floor-by-floor accordion view of all lots with colour-coded status tags (available / blocked / unowned / unowned-blocked). A status legend and summary stats cards help at-a-glance monitoring.',
  },
  {
    file: '09_lot_calendar.png',
    title: '9. Lot Calendar',
    role: 'Role: Owner',
    desc: 'Calendar view scoped to the owner\'s lots. Booked slots appear in red, pending requests in orange, blocked periods in dark red. The lot selector allows filtering to a single lot. Clicking an event opens an approval / rejection modal.',
  },
  {
    file: '10_my_lots.png',
    title: '10. My Lots',
    role: 'Role: Owner',
    desc: 'Table of all lots assigned to the logged-in owner with their current status and blocked-until date. Standard pagination (10 per page, hidden when not needed).',
  },
  {
    file: '11_admin_panel.png',
    title: '11. Admin Panel',
    role: 'Role: Manager',
    desc: 'Sidebar-navigated panel with five sections: User Management, Lot Management, Import / Export, System Configuration, Reports and Broadcast Messages. Each section has an info banner at the bottom.',
  },
];

function img(file, widthPx = 580) {
  const data = fs.readFileSync(path.join(SS, file));
  const { width: origW, height: origH } = sizeOf(data);
  const scale = widthPx / origW;
  return new ImageRun({
    type: 'png',
    data,
    transformation: {
      width:  Math.round(origW * scale),
      height: Math.round(origH * scale),
    },
    altText: { title: file, description: file, name: file },
  });
}

// Minimal PNG size reader — reads IHDR chunk
function sizeOf(buf) {
  // PNG: bytes 16-23 contain width (4) + height (4) in big-endian
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  return { width: w, height: h };
}

// DXA constants (1 inch = 1440 DXA)
const PAGE_W  = 12240; // 8.5 in
const PAGE_H  = 15840; // 11  in
const MARGIN  = 1080;  // 0.75 in
const CONTENT = PAGE_W - MARGIN * 2; // 10080 DXA ≈ 7 in → 660 px @ 96dpi

const border = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };

const children = [];

// ── Cover ──────────────────────────────────────────────────────────────────
children.push(
  new Paragraph({ text: '', spacing: { before: 2880 } }),
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Parking Management System', bold: true, size: 48, font: 'Arial' })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Application Screen Review', size: 32, font: 'Arial', color: '555555' })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Dark Mode — March 2026', size: 24, font: 'Arial', color: '888888' })],
    spacing: { before: 240 },
  }),
  new Paragraph({ text: '', pageBreakBefore: true }),
);

// ── Screens ────────────────────────────────────────────────────────────────
screens.forEach((s, i) => {
  // Section heading
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: s.title, bold: true, size: 32, font: 'Arial' })],
      spacing: { before: i === 0 ? 0 : 480, after: 120 },
    }),
  );

  // Role badge (if any)
  if (s.role) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: s.role, size: 20, font: 'Arial', italics: true, color: '1677FF' })],
        spacing: { after: 160 },
      }),
    );
  }

  // Description
  children.push(
    new Paragraph({
      children: [new TextRun({ text: s.desc, size: 22, font: 'Arial' })],
      spacing: { after: 240 },
    }),
  );

  // Screenshot — fit to content width (660 px ≈ 7 in)
  const imgW = 660;
  children.push(
    new Paragraph({
      children: [img(s.file, imgW)],
      border: { top: border, bottom: border, left: border, right: border },
      spacing: { after: 120 },
    }),
  );

  // Page break between screens (not after the last one)
  if (i < screens.length - 1) {
    children.push(new Paragraph({ children: [], pageBreakBefore: false, spacing: { after: 0 } }));
    children.push(new Paragraph({ text: '', pageBreakBefore: true }));
  }
});

// ── Document ───────────────────────────────────────────────────────────────
const doc = new Document({
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run:       { size: 32, bold: true, font: 'Arial', color: '111111' },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 },
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        size:   { width: PAGE_W, height: PAGE_H },
        margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
      },
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'Parking Management System  |  Screen Review  |  Page ', size: 18, color: '888888', font: 'Arial' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '888888', font: 'Arial' }),
          ],
        })],
      }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then(buf => {
  const out = path.join(__dirname, 'parking-screen-review.docx');
  fs.writeFileSync(out, buf);
  console.log('Written:', out);
});
