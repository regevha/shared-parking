const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = require('docx');
const fs = require('fs');

const screens = [
  {
    title: 'מסך התחברות והרשמה',
    description: 'מסך הכניסה למערכת. המשתמש יכול להתחבר עם שם משתמש וסיסמה, או להירשם כמשתמש חדש. קיימות שתי רמות גישה: משתמש רגיל ובעל חניה.',
    elements: ['שדה שם משתמש', 'שדה סיסמה', 'כפתור התחברות', 'קישור להרשמה', 'טופס הרשמה עם בחירת תפקיד']
  },
  {
    title: 'לוח הבקרה הראשי',
    description: 'המסך הראשי לאחר ההתחברות. מציג סיכום של הבקשות הפעילות, סטטוס חניות, ותפריט ניווט.',
    elements: ['סיכום בקשות פעילות', 'ניווט ראשי', 'התראות והודעות', 'כפתור הגשת בקשה חדשה']
  },
  {
    title: 'הגשת בקשת חניה',
    description: 'טופס להגשת בקשה לחניה משותפת. המשתמש בוחר תאריכים, שעות ומיקום חניה רצוי.',
    elements: ['בחירת תאריך התחלה וסיום', 'בחירת שעות', 'רשימת חניות זמינות', 'כפתור שליחת הבקשה']
  },
  {
    title: 'הבקשות שלי',
    description: 'רשימת כל הבקשות שהמשתמש הגיש. מציגה סטטוס כל בקשה: ממתינה, מאושרת, נדחתה, או בוטלה. בקשות שאושרו אוטומטית מסומנות בתג סגול.',
    elements: ['טבלת בקשות', 'עמודת סטטוס (ממתין/מאושר/נדחה/בוטל)', 'תג אישור אוטומטי', 'כפתור ביטול בקשה', 'תצוגה מותאמת לנייד']
  },
  {
    title: 'אישור בקשות (לבעלי חניות)',
    description: 'מסך לבעלי חניות לניהול ואישור בקשות חנייה בחניות שלהם. מציג את כל הבקשות הממתינות לאישור.',
    elements: ['רשימת בקשות ממתינות', 'פרטי המבקש', 'תאריכים ושעות', 'כפתורי אישור ודחייה', 'שם מאשר הבקשה']
  },
  {
    title: 'פרטי בקשה',
    description: 'מסך מפורט לצפייה בפרטי בקשה ספציפית. כולל את כל המידע על הבקשה, הסטטוס, ופרטי האישור.',
    elements: ['פרטי הבקשה המלאים', 'סטטוס נוכחי', 'שם מאשר הבקשה (אם אושרה)', 'היסטוריית שינויים', 'כפתורי פעולה']
  },
  {
    title: 'ניהול חניות (לבעלי חניות)',
    description: 'מסך לניהול חניות בבעלות המשתמש. מאפשר הוספה, עריכה והסרה של חניות, וניהול הגדרות.',
    elements: ['רשימת חניות', 'כפתור הוספת חניה', 'עריכת פרטי חניה', 'הגדרות זמינות', 'סטטיסטיקות שימוש']
  },
  {
    title: 'ממשק מותאם לנייד',
    description: 'כל מסכי המערכת מותאמים לתצוגה במכשירים ניידים. התפריט מתמזג לכפתור המבורגר, והטבלאות מוצגות כרטיסיות.',
    elements: ['תפריט המבורגר', 'כרטיסיות במקום טבלאות', 'כפתורים גדולים למסך מגע', 'תמיכה ב-RTL (ימין לשמאל)']
  }
];

function makeRTLParagraph(text, options = {}) {
  return new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    ...options,
    children: [new TextRun({ text, rightToLeft: true, font: 'Arial', ...options.run })]
  });
}

const children = [];

children.push(new Paragraph({
  bidirectional: true,
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'תיעוד מסכי המערכת', bold: true, size: 40, font: 'Arial', rightToLeft: true })]
}));
children.push(new Paragraph({
  bidirectional: true,
  alignment: AlignmentType.CENTER,
  children: [new TextRun({ text: 'מערכת חנייה משותפת', size: 28, font: 'Arial', rightToLeft: true })]
}));
children.push(new Paragraph({ children: [] }));

for (const screen of screens) {
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    children: [new TextRun({ text: screen.title, bold: true, size: 32, font: 'Arial', rightToLeft: true })]
  }));
  children.push(makeRTLParagraph(screen.description, { run: { size: 24 } }));
  children.push(new Paragraph({ children: [] }));
  children.push(makeRTLParagraph('רכיבים עיקריים:', { run: { bold: true, size: 24 } }));
  for (const el of screen.elements) {
    children.push(new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: '\u2022 ' + el, font: 'Arial', size: 24, rightToLeft: true })]
    }));
  }
  children.push(new Paragraph({ children: [] }));
}

const doc = new Document({
  sections: [{
    properties: {
      page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } }
    },
    children
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('screens_hebrew.docx', buf);
  console.log('Done: screens_hebrew.docx');
});
