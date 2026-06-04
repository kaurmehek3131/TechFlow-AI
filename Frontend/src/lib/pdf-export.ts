import { jsPDF } from "jspdf";

type PDFMetadata = {
  title: string;
  subject?: string;
  grade?: string;
  duration?: string;
  language?: string;
  topic?: string;
};

// Helper to sanitize emojis or special characters that standard PDF fonts can't render
function cleanText(text: string): string {
  if (!text) return "";
  // Replace common emojis with text equivalents or remove them
  return text
    .replace(/[🎓📖🎯⏱️🏫🤝✏️✅📚🧠📘⭐💡📝❓🎉]/g, "")
    .replace(/[^\x00-\x7F]/g, (char) => {
      // Keep common accented characters or characters for supported languages if standard font supports,
      // but standard Helvetica only supports Western characters. For Japanese/Chinese/Hindi, standard Helvetica
      // might render boxes. To make the app highly robust, if language is Chinese, Hindi, Japanese, etc.
      // we print them, but in standard Helvetica they might show as placeholders.
      // To provide a robust experience, we clean up emojis but keep non-ASCII letters.
      return char;
    })
    .trim();
}

// Draw page background decoration, header and footer on every page
function drawPageTemplate(doc: jsPDF, pageNum: number, totalPages: number, metadata: PDFMetadata) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Header band
  doc.setFillColor(49, 46, 129); // indigo-900 (primary)
  doc.rect(0, 0, pageWidth, 8, "F");

  // Bottom footer band
  doc.setDrawColor(229, 231, 235); // gray-200
  doc.setLineWidth(0.5);
  doc.line(15, pageHeight - 15, pageWidth - 15, pageHeight - 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128); // gray-500
  
  // Footer text
  doc.text("TechFlow AI — AI-Powered Educational Platform", 15, pageHeight - 10);
  doc.text(`Page ${pageNum}`, pageWidth - 25, pageHeight - 10);
}

// Render metadata block at the top of the first page
function renderMetadataBlock(doc: jsPDF, metadata: PDFMetadata, startY: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Draw card background
  doc.setFillColor(249, 250, 251); // gray-50
  doc.setDrawColor(229, 231, 235); // gray-200
  doc.setLineWidth(0.5);
  doc.roundedRect(15, startY, pageWidth - 30, 28, 3, 3, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(75, 85, 99); // gray-600

  // Draw metadata fields
  const colW = (pageWidth - 30) / 3;
  
  doc.text("Subject:", 20, startY + 8);
  doc.setFont("helvetica", "normal");
  doc.text(cleanText(metadata.subject || "N/A"), 20 + 16, startY + 8);

  doc.setFont("helvetica", "bold");
  doc.text("Grade Level:", 20 + colW, startY + 8);
  doc.setFont("helvetica", "normal");
  doc.text(cleanText(metadata.grade || "N/A"), 20 + colW + 24, startY + 8);

  doc.setFont("helvetica", "bold");
  doc.text("Duration:", 20 + colW * 2, startY + 8);
  doc.setFont("helvetica", "normal");
  doc.text(cleanText(metadata.duration || "N/A"), 20 + colW * 2 + 18, startY + 8);

  doc.setFont("helvetica", "bold");
  doc.text("Language:", 20, startY + 18);
  doc.setFont("helvetica", "normal");
  doc.text(cleanText(metadata.language || "English"), 20 + 20, startY + 18);

  doc.setFont("helvetica", "bold");
  doc.text("Topic:", 20 + colW, startY + 18);
  doc.setFont("helvetica", "normal");
  doc.text(cleanText(metadata.topic || "N/A"), 20 + colW + 12, startY + 18);

  return startY + 36;
}

// Function to split content into paragraphs and render it page by page
function renderMarkdownContent(doc: jsPDF, text: string, startY: number, metadata: PDFMetadata): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 15;
  const contentWidth = pageWidth - marginX * 2;
  const bottomThreshold = pageHeight - 20;

  let y = startY;

  // Split lines
  const lines = text.split("\n");
  
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) {
      y += 4; // Paragraph spacing
      continue;
    }

    // Check page overflow before rendering
    if (y > bottomThreshold) {
      doc.addPage();
      y = 20;
    }

    // Heading 1 (# or 🎓)
    if (rawLine.startsWith("#") || rawLine.startsWith("🎓")) {
      const val = cleanText(rawLine.replace(/^[#\s🎓\s—]+/, ""));
      y += 6;
      if (y > bottomThreshold) { doc.addPage(); y = 20; }
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(30, 27, 75); // Dark blue / indigo
      doc.text(val, marginX, y);
      
      // Bottom line under H1
      y += 2;
      doc.setDrawColor(229, 231, 235);
      doc.line(marginX, y, marginX + contentWidth, y);
      y += 6;
    }
    // Heading 2 (## or emojis)
    else if (rawLine.startsWith("##") || rawLine.match(/^(📖|🎯|⏱️|🏫|🤝|✏️|✅)/)) {
      const val = cleanText(rawLine.replace(/^(##|📖|🎯|⏱️|🏫|🤝|✏️|✅)+/, "").replace(/^[\s—\-\*]+/, ""));
      y += 4;
      if (y > bottomThreshold) { doc.addPage(); y = 20; }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(55, 65, 81); // gray-700
      doc.text(val, marginX, y);
      y += 6;
    }
    // List Item
    else if (rawLine.startsWith("-") || rawLine.startsWith("*") || rawLine.startsWith("•")) {
      const val = cleanText(rawLine.replace(/^[\-\*\•\s]+/, ""));
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(55, 65, 81);

      // Wrap text
      const wrapped = doc.splitTextToSize(val, contentWidth - 8);
      for (const wrappedLine of wrapped) {
        if (y > bottomThreshold) { doc.addPage(); y = 20; }
        // Draw bullet
        doc.setFillColor(79, 70, 229);
        doc.circle(marginX + 2, y - 3, 1.2, "F");
        doc.text(wrappedLine, marginX + 8, y);
        y += 5;
      }
    }
    // Regular paragraph
    else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(75, 85, 99); // gray-600

      // If it contains a lot of bold tokens like **word**, clean them up
      const cleanedLine = cleanText(rawLine.replace(/\*\*([^*]+)\*\*/g, "$1"));
      const wrapped = doc.splitTextToSize(cleanedLine, contentWidth);
      for (const wrappedLine of wrapped) {
        if (y > bottomThreshold) { doc.addPage(); y = 20; }
        doc.text(wrappedLine, marginX, y);
        y += 5;
      }
    }
  }

  return y;
}

// Custom Rubric drawing function (renders analytical matrix)
function renderRubricTable(doc: jsPDF, rubricJsonStr: string, startY: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 15;
  const tableWidth = pageWidth - marginX * 2;
  const bottomThreshold = pageHeight - 25;

  let y = startY;

  let rubricObj: any = null;
  try {
    rubricObj = JSON.parse(rubricJsonStr);
  } catch (e) {
    // If not valid JSON, just render as markdown text
    return renderMarkdownContent(doc, rubricJsonStr, startY, {});
  }

  const criteria = rubricObj.criteria || [];
  const guidance = rubricObj.teacher_guidance || rubricObj.guidance || "";

  if (criteria.length === 0) {
    return renderMarkdownContent(doc, rubricJsonStr, startY, {});
  }

  // Draw Rubric header
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 27, 75);
  doc.text("Grading Rubric Matrix", marginX, y);
  y += 6;

  // Table structure: 5 columns
  // Criteria (20%), Excellent (20%), Good (20%), Developing (20%), Beginning (20%)
  const colWidth = tableWidth / 5;
  const headers = ["Criteria", "Excellent (4)", "Good (3)", "Developing (2)", "Beginning (1)"];

  // Draw Header Row
  doc.setFillColor(79, 70, 229); // Indigo background
  doc.rect(marginX, y - 5, tableWidth, 8, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  for (let c = 0; c < 5; c++) {
    doc.text(headers[c], marginX + c * colWidth + 2, y - 1);
  }
  y += 5;

  // Draw Rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);

  for (const crit of criteria) {
    const critName = crit.name || crit.criteria || "Criteria";
    const levels = [
      crit.levels?.Excellent || crit.Excellent || "",
      crit.levels?.Good || crit.Good || "",
      crit.levels?.Developing || crit.Developing || "",
      crit.levels?.Beginning || crit.Beginning || ""
    ];

    // Compute cell lines for wrapping
    const wrappedCritName = doc.splitTextToSize(cleanText(critName), colWidth - 4);
    const wrappedLevels = levels.map(lvl => doc.splitTextToSize(cleanText(lvl), colWidth - 4));
    
    // Find max lines to calculate row height
    const maxLines = Math.max(
      wrappedCritName.length,
      ...wrappedLevels.map(wl => wl.length)
    );
    
    const rowHeight = maxLines * 4.5 + 6;

    // Check page overflow
    if (y + rowHeight > bottomThreshold) {
      doc.addPage();
      y = 25;
      
      // Re-draw table header on new page
      doc.setFillColor(79, 70, 229);
      doc.rect(marginX, y - 5, tableWidth, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      for (let c = 0; c < 5; c++) {
        doc.text(headers[c], marginX + c * colWidth + 2, y - 1);
      }
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(55, 65, 81);
    }

    // Draw borders
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.rect(marginX, y - 5, tableWidth, rowHeight, "D");
    for (let c = 1; c < 5; c++) {
      doc.line(marginX + c * colWidth, y - 5, marginX + c * colWidth, y - 5 + rowHeight);
    }

    // Render cells
    // Col 1: Criteria Name
    doc.setFont("helvetica", "bold");
    let cellY = y;
    for (const line of wrappedCritName) {
      doc.text(line, marginX + 2, cellY);
      cellY += 4.5;
    }

    // Col 2-5: Levels
    doc.setFont("helvetica", "normal");
    for (let colIdx = 0; colIdx < 4; colIdx++) {
      let lvlY = y;
      for (const line of wrappedLevels[colIdx]) {
        doc.text(line, marginX + (colIdx + 1) * colWidth + 2, lvlY);
        lvlY += 4.5;
      }
    }

    y += rowHeight;
  }

  // Draw teacher guidance if available
  if (guidance) {
    y += 10;
    if (y + 20 > bottomThreshold) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 27, 75);
    doc.text("Teacher Guidance & Scoring Instructions", marginX, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);

    const wrappedGuidance = doc.splitTextToSize(cleanText(guidance), tableWidth);
    for (const line of wrappedGuidance) {
      if (y > bottomThreshold) { doc.addPage(); y = 20; }
      doc.text(line, marginX, y);
      y += 5;
    }
  }

  return y;
}

// Custom Quiz drawing function
function renderQuizContent(doc: jsPDF, quizJsonStr: string, startY: number): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 15;
  const contentWidth = pageWidth - marginX * 2;
  const bottomThreshold = pageHeight - 20;

  let y = startY;
  
  let quizArray: any[] = [];
  try {
    quizArray = JSON.parse(quizJsonStr);
  } catch (e) {
    // If plaintext quiz, just write it
    return renderMarkdownContent(doc, quizJsonStr, startY, {});
  }

  if (!Array.isArray(quizArray) || quizArray.length === 0) {
    return renderMarkdownContent(doc, quizJsonStr, startY, {});
  }

  // Draw Header
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(30, 27, 75);
  doc.text("Practice Quiz", marginX, y);
  y += 8;

  quizArray.forEach((q, idx) => {
    if (y > bottomThreshold) { doc.addPage(); y = 20; }

    // Print Question
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(55, 65, 81);
    
    const questText = `${idx + 1}. ${q.question}`;
    const wrappedQ = doc.splitTextToSize(cleanText(questText), contentWidth);
    for (const qLine of wrappedQ) {
      if (y > bottomThreshold) { doc.addPage(); y = 20; }
      doc.text(qLine, marginX, y);
      y += 5;
    }

    // Print Options
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(75, 85, 99);
    
    const options = q.options || [];
    const letters = ["A", "B", "C", "D"];
    
    options.forEach((opt: string, oIdx: number) => {
      if (y > bottomThreshold) { doc.addPage(); y = 20; }
      const optText = `   ${letters[oIdx]}. ${opt}`;
      const wrappedOpt = doc.splitTextToSize(cleanText(optText), contentWidth - 10);
      
      for (const oLine of wrappedOpt) {
        if (y > bottomThreshold) { doc.addPage(); y = 20; }
        doc.text(oLine, marginX, y);
        y += 5;
      }
    });

    y += 4; // Add space between questions
  });

  return y;
}

// Export single section to PDF
export function exportSectionToPDF(title: string, content: string, metadata: PDFMetadata) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  // Set Document Properties
  doc.setProperties({
    title: `${title} - ${metadata.title}`,
    subject: metadata.subject,
    creator: "TechFlow AI"
  });

  // Draw Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30, 27, 75); // indigo-950
  doc.text(cleanText(title), 15, 20);

  // Subtitle
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(cleanText(metadata.title), 15, 26);

  let currentY = 32;

  // Draw Metadata Card
  currentY = renderMetadataBlock(doc, metadata, currentY);

  // Render actual content depending on section type
  if (title.toLowerCase().includes("quiz")) {
    renderQuizContent(doc, content, currentY);
  } else if (title.toLowerCase().includes("rubric")) {
    renderRubricTable(doc, content, currentY);
  } else {
    renderMarkdownContent(doc, content, currentY, metadata);
  }

  // Draw templates (header/footer) on all pages retroactively
  const pageCount = doc.internal.pages.length - 1; // last page is empty in jsPDF internals
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawPageTemplate(doc, i, pageCount, metadata);
  }

  // Save the PDF
  const filename = `${title.replace(/\s+/g, "_")}_${metadata.title.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}

// Export Full Kit (All 6 parts) into a single unified PDF
export function exportLessonKitToPDF(lesson: {
  title: string;
  subject: string | null;
  grade: string | null;
  duration: string | null;
  language: string | null;
  topic: string | null;
  lesson_plan: string | null;
  worksheet: string | null;
  quiz: string | null;
  answer_key: string | null;
  rubric: string | null;
  homework: string | null;
}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const metadata: PDFMetadata = {
    title: lesson.title,
    subject: lesson.subject || undefined,
    grade: lesson.grade || undefined,
    duration: lesson.duration || undefined,
    language: lesson.language || undefined,
    topic: lesson.topic || undefined
  };

  doc.setProperties({
    title: `Full Lesson Kit - ${lesson.title}`,
    subject: lesson.subject || "",
    creator: "TechFlow AI"
  });

  // Page 1 Cover / Metadata
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(30, 27, 75);
  doc.text("TechFlow AI Classroom Materials", 15, 30);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(14);
  doc.setTextColor(79, 70, 229);
  doc.text("Complete Unified Lesson Kit", 15, 38);

  let currentY = 48;
  currentY = renderMetadataBlock(doc, metadata, currentY);

  // We will append sections one by one, adding a page break before each major section
  const sections = [
    { title: "Lesson Plan", content: lesson.lesson_plan },
    { title: "Student Worksheet", content: lesson.worksheet },
    { title: "Practice Quiz", content: lesson.quiz, type: "quiz" },
    { title: "Answer Key", content: lesson.answer_key },
    { title: "Grading Rubric", content: lesson.rubric, type: "rubric" },
    { title: "Homework Assignment", content: lesson.homework }
  ];

  sections.forEach((sec) => {
    if (!sec.content) return;
    
    // Always start each major kit section on a fresh page
    doc.addPage();
    
    // Section Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(30, 27, 75);
    doc.text(sec.title, 15, 20);
    
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(1);
    doc.line(15, 23, doc.internal.pageSize.getWidth() - 15, 23);
    
    const startSectionY = 30;
    
    if (sec.type === "quiz") {
      renderQuizContent(doc, sec.content, startSectionY);
    } else if (sec.type === "rubric") {
      renderRubricTable(doc, sec.content, startSectionY);
    } else {
      renderMarkdownContent(doc, sec.content, startSectionY, metadata);
    }
  });

  // Render templates retroactively
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    drawPageTemplate(doc, i, pageCount, metadata);
  }

  const filename = `Full_Lesson_Kit_${lesson.title.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}
