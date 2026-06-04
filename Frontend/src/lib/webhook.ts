// Make.com webhook or client-side Gemini AI integration
import { createServerFn } from "@tanstack/react-start";

export type LessonInput = {
  subject: string;
  grade: string;
  topic: string;
  duration: string;
  language: string;
  objectives: string;
};

export type LessonOutput = {
  lesson_plan: string;
  worksheet: string;
  quiz: string;
  answer_key: string;
  rubric: string;
  homework: string;
};

function repairTruncatedJson(str: string): string {
  str = str.trim();
  if (!str) return "{}";
  
  let inString = false;
  let escape = false;
  const stack: ('{' | '[')[] = [];
  let repaired = "";
  
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    
    if (escape) {
      escape = false;
      repaired += char;
      continue;
    }
    
    if (char === '\\') {
      escape = true;
      repaired += char;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      repaired += char;
      continue;
    }
    
    if (inString) {
      if (char === '\n') {
        repaired += '\\n';
      } else if (char === '\r') {
        repaired += '\\r';
      } else {
        repaired += char;
      }
    } else {
      repaired += char;
      if (char === '{') {
        stack.push('{');
      } else if (char === '[') {
        stack.push('[');
      } else if (char === '}') {
        if (stack[stack.length - 1] === '{') {
          stack.pop();
        }
      } else if (char === ']') {
        if (stack[stack.length - 1] === '[') {
          stack.pop();
        }
      }
    }
  }
  
  // Now repair the end of the string
  if (inString) {
    if (repaired.endsWith('\\')) {
      repaired = repaired.slice(0, -1);
    }
    repaired += '"';
  }
  
  // Clean up trailing commas/colons before closing braces
  repaired = repaired.trim();
  while (repaired.endsWith(',') || repaired.endsWith(':')) {
    repaired = repaired.slice(0, -1).trim();
  }
  
  // Close any unclosed arrays/objects
  while (stack.length > 0) {
    const open = stack.pop();
    if (open === '{') {
      repaired += '}';
    } else if (open === '[') {
      repaired += ']';
    }
  }
  
  return repaired;
}

function extractFieldFromRawText(text: string, fieldName: string, nextFields: string[]): string {
  const escapedFieldName = fieldName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const fieldRegex = new RegExp(`"(?:${escapedFieldName})"` + `\\s*:\\s*"`, 'i');
  const match = text.match(fieldRegex);
  if (!match) return "";
  
  const startIdx = (match.index ?? 0) + match[0].length;
  
  // Find where any of the next fields start
  let minNextIdx = text.length;
  for (const nextField of nextFields) {
    const nextEscaped = nextField.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const nextRegex = new RegExp(`,\\s*"(?:${nextEscaped})"` + `\\s*:`, 'i');
    const nextMatch = text.slice(startIdx).match(nextRegex);
    if (nextMatch && nextMatch.index !== undefined) {
      const absIdx = startIdx + nextMatch.index;
      if (absIdx < minNextIdx) {
        minNextIdx = absIdx;
      }
    }
  }
  
  let val = text.substring(startIdx, minNextIdx).trim();
  
  // Clean up trailing quote/comma/braces
  if (val.endsWith('",')) {
    val = val.slice(0, -2);
  } else if (val.endsWith('"')) {
    val = val.slice(0, -1);
  } else if (val.endsWith('",\n')) {
    val = val.slice(0, -3);
  }
  
  val = val.trim();
  if (val.endsWith('"')) {
    val = val.slice(0, -1);
  }
  
  try {
    return JSON.parse(`"${val.replace(/\r/g, '').replace(/\n/g, '\\n')}"`);
  } catch {
    return val
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');
  }
}

function extractLessonPlanFromRawText(text: string): string {
  // Try to use the robust partition search
  const nextFields = ["worksheet", "quiz", "answer_key", "answerKey", "rubric", "homework"];
  const lp = extractFieldFromRawText(text, "lesson_plan", nextFields) || extractFieldFromRawText(text, "lessonPlan", nextFields);
  if (lp) return lp;
  
  // Fallback to regex
  const lessonPlanRegex = /"(?:lesson_plan|lessonPlan)"\s*:\s*"((?:[^"\\]|\\.)*)"/s;
  const match = text.match(lessonPlanRegex);
  if (match && match[1]) {
    try {
      return JSON.parse(`"${match[1]}"`);
    } catch {
      return match[1];
    }
  }
  return text;
}

function extractJsonFromString(str: string): any {
  const firstOpenBrace = str.indexOf('{');
  const lastCloseBrace = str.lastIndexOf('}');
  
  if (firstOpenBrace !== -1 && lastCloseBrace !== -1 && lastCloseBrace > firstOpenBrace) {
    const jsonCandidate = str.substring(firstOpenBrace, lastCloseBrace + 1);
    try {
      return JSON.parse(jsonCandidate);
    } catch (e) {
      console.warn("Found JSON braces but failed to parse candidate directly, trying repair:", e);
      try {
        const repaired = repairTruncatedJson(jsonCandidate);
        return JSON.parse(repaired);
      } catch (err) {
        console.error("Failed to parse repaired JSON:", err);
      }
    }
  }
  
  // If there's an open brace but no closing brace at all
  if (firstOpenBrace !== -1 && lastCloseBrace === -1) {
    try {
      const repaired = repairTruncatedJson(str.substring(firstOpenBrace));
      return JSON.parse(repaired);
    } catch (err) {
      console.error("Failed to parse repaired JSON with no closing brace:", err);
    }
  }
  
  return null;
}

export const callDifyWorkflowServerFn = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { apiKey: string; apiUrl: string; input: LessonInput } }) => {
    const { apiKey, apiUrl, input } = data;
    const baseApiUrl = apiUrl || "https://api.dify.ai/v1";
    const endpoint = `${baseApiUrl}/workflows/run`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: {
          ...input,
          Subject: input.subject,
          Grade: input.grade,
          Topic: input.topic,
          Duration: input.duration,
          Language: input.language,
          Objective: input.objectives,
          Objectives: input.objectives,
        },
        response_mode: "blocking",
        user: "techflow-teacher"
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Dify API responded ${res.status}: ${errorText}`);
    }

    const resData = await res.json();
    const rawOutputs = resData.data?.outputs || {};
    let outputs = { ...rawOutputs };

    // Try to find and parse a JSON block in any string output field
    for (const key of Object.keys(rawOutputs)) {
      const val = rawOutputs[key];
      if (typeof val === 'string' && val.includes('{')) {
        const extracted = extractJsonFromString(val);
        if (extracted && typeof extracted === 'object') {
          outputs = { ...outputs, ...extracted };
          break; // Merged the parsed JSON fields, we can stop
        }
      }
    }

    // NEW FALLBACK: If lesson_plan is still empty, try to extract it directly from raw string outputs!
    if (!outputs.lesson_plan || outputs.lesson_plan.includes('{') || outputs.lesson_plan.includes('"lesson_plan"')) {
      for (const key of Object.keys(rawOutputs)) {
        const val = rawOutputs[key];
        if (typeof val === 'string' && (val.includes('lesson_plan') || val.includes('lessonPlan'))) {
          const extracted = extractLessonPlanFromRawText(val);
          if (extracted && extracted !== val) {
            outputs.lesson_plan = extracted;
            break;
          }
        }
      }
    }

    return {
      lesson_plan: outputs.lesson_plan ?? outputs.lessonPlan ?? "",
      worksheet: outputs.worksheet ?? "",
      quiz: typeof outputs.quiz === 'string' ? outputs.quiz : JSON.stringify(outputs.quiz ?? ""),
      answer_key: outputs.answer_key ?? outputs.answerKey ?? "",
      rubric: typeof outputs.rubric === 'string' ? outputs.rubric : JSON.stringify(outputs.rubric ?? ""),
      homework: typeof outputs.homework === 'string' ? outputs.homework : JSON.stringify(outputs.homework ?? ""),
    };
  });

async function fetchGeminiWithRetry(
  apiKey: string,
  payload: any,
  preferredModel: string = "gemini-2.5-flash",
  fallbackModel: string = "gemini-1.5-flash"
): Promise<Response> {
  const models = [preferredModel, fallbackModel];
  let lastError: any = null;

  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          return res;
        }

        // Handle transient errors (503 Service Unavailable, 429 Too Many Requests, 500 Internal Server Error)
        if (res.status === 503 || res.status === 429 || res.status === 500) {
          attempt++;
          lastError = new Error(`Gemini API returned status ${res.status} for model ${model}`);
          console.warn(`Transient error on model ${model} (attempt ${attempt}/${maxRetries}): ${lastError.message}`);
          if (attempt < maxRetries) {
            const delay = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        } else {
          // Non-transient errors (e.g. 400 Bad Request, 403 Forbidden)
          throw new Error(`Gemini API returned non-transient status ${res.status}: ${res.statusText}`);
        }
      } catch (err: any) {
        lastError = err;
        console.error(`Fetch error on model ${model} (attempt ${attempt + 1}/${maxRetries}):`, err);
        attempt++;
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.warn(`Model ${model} failed all ${maxRetries} attempts. Trying fallback model...`);
  }

  throw lastError || new Error("Failed to call Gemini API after trying all options");
}

export async function callMakeWebhook(webhookUrl: string, input: LessonInput): Promise<LessonOutput> {
  // Check if Dify integration is configured, falling back to default Dify credentials
  const difyApiKey = localStorage.getItem("dify_api_key") || (import.meta.env.VITE_DIFY_API_KEY as string) || "";
  const difyApiUrl = localStorage.getItem("dify_api_url") || "https://api.dify.ai/v1";

  let difyLessonPlan = "";

  if (difyApiKey) {
    try {
      const difyOutput = await callDifyWorkflowServerFn({ data: { apiKey: difyApiKey, apiUrl: difyApiUrl, input } });
      
      let lp = difyOutput.lesson_plan || "";
      
      // If the lesson plan key contains JSON or looks unparsed/empty, extract it from raw outputs
      if (!lp || lp.includes('"lesson_plan"') || lp.includes('{')) {
        for (const key of Object.keys(difyOutput)) {
          const val = (difyOutput as any)[key];
          if (typeof val === 'string' && (val.includes('lesson_plan') || val.includes('lessonPlan'))) {
            const extracted = extractLessonPlanFromRawText(val);
            if (extracted && extracted !== val) {
              lp = extracted;
              break;
            }
          }
        }
      }
      
      difyLessonPlan = lp;
      console.log("Successfully extracted lesson plan from Dify workflow.");
    } catch (e: any) {
      console.error("Dify workflow failed:", e);
      throw new Error(`Dify Workflow integration failed: ${e.message || e}`);
    }
  }

  // Gemini API key for generating the remaining components
  const geminiKey = localStorage.getItem("gemini_api_key") || (import.meta.env.VITE_GEMINI_API_KEY as string);
  if (geminiKey) {
    try {
      // Pass the Dify lesson plan context if it was successfully generated
      return await callGemini(geminiKey, input, difyLessonPlan);
    } catch (e) {
      console.error("Gemini AI generation failed, falling back to mock:", e);
    }
  }

  // Fallback mock so the app demos cleanly, overriding lesson plan if Dify worked
  const mock = mockLesson(input);
  if (difyLessonPlan) {
    mock.lesson_plan = difyLessonPlan;
  }
  return mock;
}

async function callGemini(apiKey: string, input: LessonInput, difyLessonPlan?: string): Promise<LessonOutput> {
  let lessonPlanDirective = "";
  if (difyLessonPlan) {
    lessonPlanDirective = `Take the lesson plan outline/content from Dify:
---START DIFY LESSON PLAN---
${difyLessonPlan}
---END DIFY LESSON PLAN---

You MUST restructure and expand this outline into a comprehensive, highly-detailed, and beautifully structured lesson plan for the 'lesson_plan' output field. 
Use creative study emojis like 🎓 for main title, 📖 for metadata, 🎯 for learning objectives, ⏱️ for timings, 🏫 for direct instruction, 🤝 for guided practice, ✏️ for independent practice, ✅ for closure.
Ensure the lesson plan has clear timed stages (e.g. Warm-up, Direct Instruction, Guided Practice, Independent Practice, Closure).
Then, generate all the other fields (worksheet, question_panel, quiz, answer_key, rubric, homework) to align perfectly with it.`;
  }

  const prompt = `You are a professional educational assistant. Generate a complete, high-quality lesson kit in JSON format for the following topic:
Subject: ${input.subject}
Grade: ${input.grade}
Topic: ${input.topic}
Duration: ${input.duration}
Language: ${input.language}
Objectives: ${input.objectives || "General introductory understanding"}

${lessonPlanDirective}

CRITICAL: The value of the "lesson_plan" field must be a plain text string representing only the lesson plan. It MUST NOT contain any JSON formatting, braces, or other keys like "worksheet" or "quiz" inside the "lesson_plan" string. It must only contain the formatted lesson plan text.

CRITICAL LANGUAGE REQUIREMENT:
Generate ALL content (including fields like 'lesson_plan', 'worksheet', 'question_panel', questions, options, 'answer_key', titles, explanations, headings, 'rubric' criteria, and 'homework' details) directly and entirely in the specified language: ${input.language}. Write in the native script. Do not output any English unless it is an English language subject.

Return ONLY a JSON object with exactly the following structure. Do not use markdown headers like '#' or '*' in the 'lesson_plan' (unless it was already provided in the lesson plan context above), instead use creative study emojis like 🎓 for main title, 📖 for metadata, 🎯 for learning objectives, ⏱️ for timings, 🏫 for direct instruction, 🤝 for guided practice, ✏️ for independent practice, ✅ for closure.
In the worksheet, design a clean student worksheet with 5 items.
In the question_panel, generate exactly 3 questions in each of the three arrays: 'short', 'medium', and 'long' (representing conceptual/application short questions related to the topic).
In the quiz, generate exactly 5 multiple choice questions, each with a 'question' string, 'options' (array of 4 strings), and 'answer' (string: "A", "B", "C", or "D").
In the answer_key, provide clear, specific answers ONLY for: 1) all 5 questions in the worksheet, and 2) all 9 questions in the question_panel (for all three segments: short, medium, and long/short-2). Do NOT include answers or explanations for the multiple choice quiz questions in the answer_key.

In the rubric, generate a structured grading rubric with exactly 3 grading criteria (e.g. Understanding, Content Accuracy, Organization) in JSON format.
In the homework, generate a complete homework assignment that includes an estimated completion time (e.g. "30 minutes"), a difficulty level ("Easy", "Medium", or "Hard"), a set of 3 practice tasks, and a homework answer key.

JSON Schema structure:
{
  "lesson_plan": "text",
  "worksheet": "text",
  "question_panel": {
    "short": ["string", "string", "string"],
    "medium": ["string", "string", "string"],
    "long": ["string", "string", "string"]
  },
  "quiz": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "answer": "string"
    }
  ],
  "answer_key": "text",
  "rubric": {
    "criteria": [
      {
        "name": "string",
        "levels": {
          "Excellent": "string",
          "Good": "string",
          "Developing": "string",
          "Beginning": "string"
        }
      }
    ],
    "teacher_guidance": "string"
  },
  "homework": {
    "estimated_time": "string",
    "difficulty_level": "string",
    "tasks": [
      {
        "question": "string",
        "type": "string"
      }
    ],
    "answer_key": "text"
  }
}`;

  const res = await fetchGeminiWithRetry(apiKey, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json"
    }
  });

  const result = await res.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error("No response from Gemini API");

  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.warn("Failed to parse Gemini output directly, attempting repair:", e);
    try {
      const repaired = repairTruncatedJson(cleaned);
      parsed = JSON.parse(repaired);
    } catch (err) {
      console.error("Failed to parse repaired Gemini output:", err);
      throw new Error("Failed to parse response from Gemini API");
    }
  }

  return {
    lesson_plan: parsed.lesson_plan || "",
    worksheet: `${parsed.worksheet || ""}\n\n---QUESTION_PANEL---\n${JSON.stringify(parsed.question_panel || {})}`,
    quiz: JSON.stringify(parsed.quiz || []),
    answer_key: parsed.answer_key || "",
    rubric: JSON.stringify(parsed.rubric || { criteria: [], teacher_guidance: "" }),
    homework: JSON.stringify(parsed.homework || { estimated_time: "", difficulty_level: "", tasks: [], answer_key: "" })
  };
}

// Translations helper for high-quality multilingual mock lesson generations
const LOCALIZED_MOCKS: Record<string, {
  quizQuestions: string[];
  optionsA: string[];
  optionsB: string[];
  optionsC: string[];
  optionsD: string[];
  optionsE: string[];
  panelShort: string[];
  panelMedium: string[];
  panelLong: string[];
  planTitle: string;
  subjectLabel: string;
  gradeLabel: string;
  durationLabel: string;
  languageLabel: string;
  objectivesLabel: string;
  objectivesText: string;
  warmupLabel: string;
  warmupText: string;
  instructionLabel: string;
  instructionText: string;
  practiceLabel: string;
  practiceText: string;
  independentLabel: string;
  independentText: string;
  closureLabel: string;
  closureText: string;
  worksheetTitle: string;
  worksheetItems: string[];
  answerKeyTitle: string;
  worksheetAnswersLabel: string;
  panelAnswersLabel: string;
  worksheetAnswers: string[];
  panelAnswersShort: string[];
  panelAnswersMedium: string[];
  panelAnswersLong: string[];
}> = {
  English: {
    quizQuestions: [
      'Which of the following is a primary characteristic of "{topic}"?',
      'What is the main goal of learning about "{topic}"?',
      'True or False: "{topic}" plays a significant role in modern applications.',
      'How does "{topic}" typically interact with other concepts in {subject}?',
      'In a classroom setting, what is the best way to practice "{topic}"?'
    ],
    optionsA: ["It occurs only in laboratory environments", "It is a fundamental concept in this subject area", "It was discovered by Albert Einstein in 1905", "It has no practical everyday application"],
    optionsB: ["To memorize dates and historical names", "To develop deep conceptual understanding and application skills", "To pass a single standardized multiple choice exam", "To write a 500-page dissertation immediately"],
    optionsC: ["True, it is widely utilized across industries", "False, it is entirely obsolete and theoretical", "True, but only in extremely rare circumstances", "False, because it violates laws of thermodynamics"],
    optionsD: ["It operates in complete isolation", "It forms the core foundation for advanced topics", "It is completely incompatible and causes errors", "It replaces all other concepts entirely"],
    optionsE: ["By reading a single slide repeatedly", "Through interactive worksheets, quizzes, and discussion questions", "By ignoring it until the day of the exam", "By memorizing only the first definition word-for-word"],
    panelShort: [
      'Define the term "{topic}" in one or two clear sentences.',
      'State the primary purpose of "{topic}" in this context.',
      'Identify one common misconception about "{topic}".'
    ],
    panelMedium: [
      'Explain the step-by-step process of how "{topic}" operates.',
      'Compare "{topic}" with a closely related concept in {subject}.',
      'Describe a scenario where understanding "{topic}" would be crucial.'
    ],
    panelLong: [
      'Apply your knowledge of "{topic}" to propose a solution to a real-world problem.',
      'How does the duration ({duration}) affect the learning depth of "{topic}"?',
      'Explain how you would teach "{topic}" to a student who has never heard of it.'
    ],
    planTitle: "Lesson Plan",
    subjectLabel: "Subject",
    gradeLabel: "Grade",
    durationLabel: "Duration",
    languageLabel: "Language",
    objectivesLabel: "Learning Objectives",
    objectivesText: "Students will understand the core concepts of {topic} and apply them successfully.",
    warmupLabel: "Warm-up (10 min)",
    warmupText: "• Introduce the topic with an opening question.\n• Gauge student prior knowledge about {topic}.",
    instructionLabel: "Direct Instruction (20 min)",
    instructionText: "• Present the main principles and definitions.\n• Go through key examples on the board.",
    practiceLabel: "Guided Practice (15 min)",
    practiceText: "• Work through practice exercises together as a class.\n• Clear up any early misunderstandings.",
    independentLabel: "Independent Practice (10 min)",
    independentText: "• Have students work individually on the worksheet.\n• Walk around the room to offer guidance.",
    closureLabel: "Assessment & Closure (5 min)",
    closureText: "• Review the quiz questions together.\n• Summarize the key takeaways.",
    worksheetTitle: "Worksheet",
    worksheetItems: [
      'Write a short paragraph explaining the core idea behind "{topic}".',
      'What are the key elements needed for "{topic}" to function?',
      'Give an example of "{topic}" from your everyday life or observations.',
      'Draw or describe a diagram representing the workflow/concept of "{topic}".',
      'Summarize today\'s lesson in your own words.'
    ],
    answerKeyTitle: "Answer Key",
    worksheetAnswersLabel: "WORKSHEET ANSWERS:",
    panelAnswersLabel: "QUESTION PANEL ANSWERS:",
    worksheetAnswers: [
      "Definition: {topic} is a fundamental concept in {subject} that deals with the key principles and properties of this topic.",
      "Key Elements: The main components required are active observation, core understanding, structured practice, and review.",
      "Everyday Example: An example is identifying how {topic} is applied in daily lessons, homework, or discussions.",
      "Diagram/Workflow: Students should illustrate the input, core processing/principles of {topic}, and the final outcome or application.",
      "Summary: Students should synthesize that {topic} is an essential tool in {subject} for conceptual growth."
    ],
    panelAnswersShort: [
      "Definition answer: A concise statement explaining the meaning of {topic}.",
      "Primary purpose answer: To establish a clear conceptual framework for study.",
      "Misconception answer: The false belief that {topic} is only theoretical and has no practical applications."
    ],
    panelAnswersMedium: [
      "Process explanation: The workflow begins with introduction, proceeds through active practice, and concludes with assessment.",
      "Comparison: Unlike other passive topics, {topic} requires active cognitive engagement.",
      "Crucial scenario: When designing curriculum or analyzing foundational elements."
    ],
    panelAnswersLong: [
      "Problem solution: Using the principles of {topic} to structure and simplify complex tasks.",
      "Duration effect: A duration of {duration} allows for a focused, highly interactive learning cycle.",
      "Teaching approach: Breaking down the core definition into simple analogies before introducing details."
    ]
  },
  Hindi: {
    quizQuestions: [
      'निम्नलिखित में से कौन सा "{topic}" का एक प्राथमिक लक्षण है?',
      '"{topic}" के बारे में सीखने का मुख्य उद्देश्य क्या है?',
      'सही या गलत: "{topic}" आधुनिक अनुप्रयोगों में एक महत्वपूर्ण भूमिका निभाता है।',
      '"{topic}" आमतौर पर {subject} में अन्य अवधारणाओं के साथ कैसे इंटरैक्ट करता है?',
      'कक्षा के माहौल में, "{topic}" का अभ्यास करने का सबसे अच्छा तरीका क्या है?'
    ],
    optionsA: ["यह केवल प्रयोगशाला वातावरण में होता है", "यह इस विषय क्षेत्र में एक मौलिक अवधारणा है", "इसकी खोज अल्बर्ट आइंस्टीन ने 1905 में की थी", "इसका कोई व्यावहारिक दैनिक अनुप्रयोग नहीं है"],
    optionsB: ["तिथियों और ऐतिहासिक नामों को याद रखना", "गहरी वैचारिक समझ और अनुप्रयोग कौशल विकसित करना", "एक एकल मानकीकृत बहुविकल्पीय परीक्षा पास करना", "तुरंत 500 पृष्ठों का शोध प्रबंध लिखना"],
    optionsC: ["सही, इसका उद्योगों में व्यापक रूप से उपयोग किया जाता है", "गलत, यह पूरी तरह से अप्रचलित और सैद्धांतिक है", "सही, लेकिन केवल अत्यंत दुर्लभ परिस्थितियों में", "गलत, क्योंकि यह ऊष्मागतिकी के नियमों का उल्लंघन करता है"],
    optionsD: ["यह पूर्ण अलगाव में काम करता है", "यह उन्नत विषयों के लिए मूल आधार बनाता है", "यह पूरी तरह से असंगत है और त्रुटियों का कारण बनता है", "यह अन्य सभी अवधारणाओं को पूरी तरह से बदल देता है"],
    optionsE: ["एक ही स्लाइड को बार-बार पढ़कर", "इंटरैक्टिव कार्यपत्रकों, प्रश्नोत्तरियों और चर्चा प्रश्नों के माध्यम से", "परीक्षा के दिन तक इसकी उपेक्षा करके", "केवल पहली परिभाषा को शब्द-दर-शब्द याद करके"],
    panelShort: [
      '"{topic}" शब्द को एक या दो स्पष्ट वाक्यों में परिभाषित करें।',
      'इस संदर्भ में "{topic}" का प्राथमिक उद्देश्य बताएं।',
      '"{topic}" के बारे में एक आम गलतफहमी की पहचान करें।'
    ],
    panelMedium: [
      '"{topic}" कैसे काम करता है, इसकी चरण-दर-चरण प्रक्रिया समझाएं।',
      '{subject} में एक निकट से संबंधित अवधारणा के साथ "{topic}" की तुलना करें।',
      'एक ऐसे परिदृश्य का वर्णन करें जहां "{topic}" को समझना महत्वपूर्ण होगा।'
    ],
    panelLong: [
      'वास्तविक दुनिया की समस्या का समाधान खोजने के लिए "{topic}" के अपने ज्ञान को लागू करें।',
      'अवधि ({duration}) "{topic}" के सीखने की गहराई को कैसे प्रभावित करती है?',
      'आप एक ऐसे छात्र को "{topic}" कैसे सिखाएंगे जिसने इसके बारे में कभी नहीं सुना है?'
    ],
    planTitle: "पाठ योजना",
    subjectLabel: "विषय",
    gradeLabel: "कक्षा",
    durationLabel: "अवधि",
    languageLabel: "भाषा",
    objectivesLabel: "सीखने के उद्देश्य",
    objectivesText: "छात्र {topic} की मूल अवधारणाओं को समझेंगे और उन्हें सफलतापूर्वक लागू करेंगे।",
    warmupLabel: "वार्म-अप (10 मिनट)",
    warmupText: "• एक प्रारंभिक प्रश्न के साथ विषय का परिचय दें।\n• {topic} के बारे में छात्रों के पूर्व ज्ञान का आकलन करें।",
    instructionLabel: "प्रत्यक्ष निर्देश (20 मिनट)",
    instructionText: "• मुख्य सिद्धांतों और परिभाषाओं को प्रस्तुत करें।\n• बोर्ड पर महत्वपूर्ण उदाहरणों को समझाएं।",
    practiceLabel: "निर्देशित अभ्यास (15 मिनट)",
    practiceText: "• पूरी कक्षा के रूप में मिलकर अभ्यास करें।\n• शुरुआती गलतफहमियों को दूर करें।",
    independentLabel: "स्वतंत्र अभ्यास (10 मिनट)",
    independentText: "• छात्रों को कार्यपत्रक पर व्यक्तिगत रूप से काम करने दें।\n• मार्गदर्शन प्रदान करने के लिए कक्षा में घूमें।",
    closureLabel: "मूल्यांकन एवं समापन (5 मिनट)",
    closureText: "• मिलकर प्रश्नोत्तरी के प्रश्नों की समीक्षा करें।\n• मुख्य सीखों का सारांश प्रस्तुत करें।",
    worksheetTitle: "कार्यपत्रक (Worksheet)",
    worksheetItems: [
      '"{topic}" के पीछे के मूल विचार को समझाते हुए एक संक्षिप्त पैराग्राफ लिखें।',
      '"{topic}" को काम करने के लिए आवश्यक मुख्य तत्व क्या हैं?',
      'अपने दैनिक जीवन या अनुभवों से "{topic}" का एक उदाहरण दें।',
      '"{topic}" के कार्यप्रवाह/अवधारणा का प्रतिनिधित्व करने वाला एक चित्र बनाएं या वर्णन करें।',
      'आज के पाठ का अपने शब्दों में सारांश लिखें।'
    ],
    answerKeyTitle: "उत्तर कुंजी",
    worksheetAnswersLabel: "कार्यपत्रक के उत्तर:",
    panelAnswersLabel: "प्रश्न पैनल के उत्तर:",
    worksheetAnswers: [
      "परिभाषा: {topic} {subject} में एक मौलिक अवधारणा है जो इस विषय के प्रमुख सिद्धांतों और गुणों से संबंधित है।",
      "प्रमुख तत्व: आवश्यक मुख्य घटक सक्रिय अवलोकन, मूल समझ, संरचित अभ्यास और समीक्षा हैं।",
      "दैनिक उदाहरण: एक उदाहरण यह पहचानना है कि दैनिक पाठों, गृहकार्य या चर्चाओं में {topic} को कैसे लागू किया जाता है।",
      "चित्र/कार्यप्रवाह: छात्रों को इनपुट, {topic} के मुख्य प्रसंस्करण/सिद्धांतों और अंतिम परिणाम या अनुप्रयोग को चित्रित करना चाहिए।",
      "सारांश: छात्रों को यह समझना चाहिए कि {topic} वैचारिक विकास के लिए {subject} में एक आवश्यक उपकरण है।"
    ],
    panelAnswersShort: [
      "परिभाषा का उत्तर: {topic} के अर्थ को समझाने वाला एक संक्षिप्त विवरण।",
      "प्राथमिक उद्देश्य का उत्तर: अध्ययन के लिए एक स्पष्ट वैचारिक ढांचा स्थापित करना।",
      "गलतफहमी का उत्तर: यह झूठा विश्वास कि {topic} केवल सैद्धांतिक है और इसका कोई व्यावहारिक अनुप्रयोग नहीं है।"
    ],
    panelAnswersMedium: [
      "प्रक्रिया स्पष्टीकरण: कार्यप्रवाह परिचय से शुरू होता है, सक्रिय अभ्यास के माध्यम से आगे बढ़ता है, और मूल्यांकन के साथ समाप्त होता है।",
      "तुलना: अन्य निष्क्रिय विषयों के विपरीत, {topic} के लिए सक्रिय संज्ञानात्मक जुड़ाव की आवश्यकता होती है।",
      "महत्वपूर्ण परिदृश्य: पाठ्यक्रम को डिजाइन करते समय या मूलभूत तत्वों का विश्लेषण करते समय।"
    ],
    panelAnswersLong: [
      "समस्या समाधान: जटिल कार्यों को व्यवस्थित और सरल बनाने के लिए {topic} के सिद्धांतों का उपयोग करना।",
      "अवधि का प्रभाव: {duration} की अवधि एक केंद्रित, अत्यधिक संवादात्मक शिक्षण चक्र की अनुमति देती है।",
      "शिक्षण दृष्टिकोण: विवरण पेश करने से पहले मूल परिभाषा को सरल उपमाओं में तोड़ना।"
    ]
  },
  French: {
    quizQuestions: [
      'Laquelle des affirmations suivantes est une caractéristique principale de "{topic}"?',
      'Quel est le but principal de l\'apprentissage de "{topic}"?',
      'Vrai ou Faux: "{topic}" joue un rôle important dans les applications modernes.',
      'Comment "{topic}" interagit-il généralement avec d\'autres concepts de {subject}?',
      'Dans une salle de classe, quelle est la meilleure façon de pratiquer "{topic}"?'
    ],
    optionsA: ["Cela se produit uniquement dans les environnements de laboratoire", "C'est un concept fondamental dans ce domaine d'étude", "Il a été découvert par Albert Einstein en 1905", "Il n'a aucune application pratique quotidienne"],
    optionsB: ["Mémoriser des dates et des noms historiques", "Développer une compréhension conceptuelle approfondie et des compétences d'application", "Réussir un seul examen standardisé à choix multiples", "Rédiger immédiatement une thèse de 500 pages"],
    optionsC: ["Vrai, il est largement utilisé dans toutes les industries", "Faux, il est tout à fait obsolète et théorique", "Vrai, mais seulement dans des circonstances extrêmement rares", "Faux, car il viole les lois de la thermodynamique"],
    optionsD: ["Il fonctionne de manière totalement isolée", "Il constitue le fondement des sujets avancés", "Il est complètement incompatible et provoque des erreurs", "Il remplace entièrement tous les autres concepts"],
    optionsE: ["En lisant plusieurs fois une seule diapositive", "Grâce à des fiches d'exercices interactives, des quiz et des questions de discussion", "En l'ignorant jusqu'au jour de l'examen", "En mémorisant uniquement la première définition mot à mot"],
    panelShort: [
      'Définissez le terme "{topic}" en une ou deux phrases claires.',
      'Indiquez le but principal de "{topic}" dans ce contexte.',
      'Identifiez une idée fausse courante sur "{topic}".'
    ],
    panelMedium: [
      'Expliquez le processus étape par étape du fonctionnement de "{topic}".',
      'Comparez "{topic}" avec un concept étroitement lié dans {subject}.',
      'Décrivez un scénario où la compréhension de "{topic}" serait cruciale.'
    ],
    panelLong: [
      'Appliquez vos connaissances de "{topic}" pour proposer une solution à un problème réel.',
      'Comment la durée ({duration}) affecte-t-elle la profondeur d\'apprentissage de "{topic}"?',
      'Expliquez comment vous enseigneriez "{topic}" à un élève qui n\'en a jamais entendu parler.'
    ],
    planTitle: "Plan de leçon",
    subjectLabel: "Matière",
    gradeLabel: "Niveau",
    durationLabel: "Durée",
    languageLabel: "Langue",
    objectivesLabel: "Objectifs d'apprentissage",
    objectivesText: "Les élèves comprendront les concepts de base de {topic} et les appliqueront avec succès.",
    warmupLabel: "Échauffement (10 min)",
    warmupText: "• Introduire le sujet avec une question d'ouverture.\n• Évaluer les connaissances préalables des élèves sur {topic}.",
    instructionLabel: "Instruction directe (20 min)",
    instructionText: "• Présenter les principes principaux et les définitions.\n• Expliquer des exemples clés au tableau.",
    practiceLabel: "Pratique guidée (15 min)",
    practiceText: "• Faire des exercices d'entraînement ensemble en classe.\n• Éclaircir les premiers malentendus.",
    independentLabel: "Pratique autonome (10 min)",
    independentText: "• Faire travailler les élèves individuellement sur la fiche.\n• Circuler dans la classe pour offrir des conseils.",
    closureLabel: "Évaluation et clôture (5 min)",
    closureText: "• Revoir les questions du quiz ensemble.\n• Résumer les points clés à retenir.",
    worksheetTitle: "Feuille d'exercices",
    worksheetItems: [
      'Écrivez un court paragraphe expliquant l\'idée de base de "{topic}".',
      'Quels sont les éléments clés nécessaires au fonctionnement de "{topic}"?',
      'Donnez un exemple de "{topic}" tiré de votre vie quotidienne ou de vos observations.',
      'Dessinez ou décrivez un diagramme représentant le flux de travail de "{topic}".',
      'Résumez la leçon d\'aujourd\'hui dans vos propres mots.'
    ],
    answerKeyTitle: "Corrigé",
    worksheetAnswersLabel: "RÉPONSES DE LA FEUILLE D'EXERCICES:",
    panelAnswersLabel: "RÉPONSES DU PANNEAU DE QUESTIONS:",
    worksheetAnswers: [
      "Définition: {topic} est un concept fondamental en {subject} qui traite des principes et propriétés clés de ce sujet.",
      "Éléments clés: Les composants principaux requis sont l'observation active, la compréhension de base, la pratique structurée et la révision.",
      "Exemple quotidien: Un exemple consiste à identifier comment {topic} est appliqué dans les cours quotidiens, les devoirs ou les discussions.",
      "Diagramme: Les élèves doivent illustrer l'entrée, le traitement/principes clés de {topic} et le résultat final ou l'application.",
      "Résumé: Les élèves doivent synthétiser que {topic} est un outil essentiel en {subject} pour le développement conceptuel."
    ],
    panelAnswersShort: [
      "Définition: Une explication concise de la signification de {topic}.",
      "But principal: Établir un cadre conceptuel clair pour l'étude.",
      "Idée fausse: La fausse croyance selon laquelle {topic} n'est que théorique et n'a pas d'applications pratiques."
    ],
    panelAnswersMedium: [
      "Processus: Le flux de travail commence par l'introduction, se poursuit par la pratique active et se termine par l'évaluation.",
      "Comparaison: Contrairement à d'autres sujets passifs, {topic} nécessite un engagement cognitif actif.",
      "Scénario crucial: Lors de la conception de programmes d'études ou de l'analyse d'éléments fondamentaux."
    ],
    panelAnswersLong: [
      "Solution au problème: Utiliser les principes de {topic} pour structurer et simplifier des tâches complexes.",
      "Effet de durée: Une durée de {duration} permet un cycle d'apprentissage concentré et hautement interactif.",
      "Approche pédagogique: Décomposer la définition de base en analogies simples avant d'introduire les détails."
    ]
  },
  Spanish: {
    quizQuestions: [
      '¿Cuál de las siguientes es una característica principal de "{topic}"?',
      '¿Cuál es el objetivo principal de aprender sobre "{topic}"?',
      'Verdadero o Falso: "{topic}" juega un papel importante en las aplicaciones modernas.',
      '¿Cómo interactúa típicamente "{topic}" con otros conceptos en {subject}?',
      'En un salón de clases, ¿cuál es la mejor manera de practicar "{topic}"?'
    ],
    optionsA: ["Ocurre solo en entornos de laboratorio", "Es un concepto fundamental en esta área de estudio", "Fue descubierto por Albert Einstein en 1905", "No tiene aplicación práctica en la vida cotidiana"],
    optionsB: ["Memorizar fechas y nombres históricos", "Desarrollar una comprensión conceptual profunda y habilidades de aplicación", "Aprobar un examen estandarizado de opción múltiple", "Escribir una tesis de 500 páginas de inmediato"],
    optionsC: ["Verdadero, se utiliza ampliamente en todas las industrias", "Falso, es completamente obsoleto y teórico", "Verdadero, pero solo en circunstancias extremadamente raras", "Falso, porque viola las leyes de la termodinámica"],
    optionsD: ["Funciona en completo aislamiento", "Forma la base central para temas avanzados", "Es completamente incompatible y causa errores", "Reemplaza todos los demás conceptos por completo"],
    optionsE: ["Leyendo una sola diapositiva repetidamente", "A través de hojas de trabajo interactivas, cuestionarios y preguntas de debate", "Ignorándolo hasta el día del examen", "Memorizando solo la primera definición palabra por palabra"],
    panelShort: [
      'Define el término "{topic}" en una o dos frases claras.',
      'Indica el propósito principal de "{topic}" en este contexto.',
      'Identifica un malentendido común sobre "{topic}".'
    ],
    panelMedium: [
      'Explica el proceso paso a paso de cómo funciona "{topic}".',
      'Compara "{topic}" con un concepto estrechamente relacionado en {subject}.',
      'Describe un escenario donde comprender "{topic}" sería crucial.'
    ],
    panelLong: [
      'Aplica tu conocimiento de "{topic}" para proponer una solución a un problema del mundo real.',
      '¿Cómo afecta la duración ({duration}) la profundidad de aprendizaje de "{topic}"?',
      'Explica cómo le enseñarías "{topic}" a un estudiante que nunca ha oído hablar de ello.'
    ],
    planTitle: "Plan de lección",
    subjectLabel: "Materia",
    gradeLabel: "Grado",
    durationLabel: "Duración",
    languageLabel: "Idioma",
    objectivesLabel: "Objetivos de aprendizaje",
    objectivesText: "Los estudiantes comprenderán los conceptos básicos de {topic} y los aplicarán con éxito.",
    warmupLabel: "Calentamiento (10 min)",
    warmupText: "• Introducir el tema con una pregunta de apertura.\n• Evaluar los conocimientos previos de los estudiantes sobre {topic}.",
    instructionLabel: "Instrucción directa (20 min)",
    instructionText: "• Presentar los principios principales y las definiciones.\n• Explicar ejemplos clave en la pizarra.",
    practiceLabel: "Práctica guiada (15 min)",
    practiceText: "• Trabajar en ejercicios de práctica juntos en clase.\n• Resolver los primeros malentendidos.",
    independentLabel: "Práctica independiente (10 min)",
    independentText: "• Hacer que los estudiantes trabajen individualmente en la hoja de trabajo.\n• Caminar por el aula para ofrecer orientación.",
    closureLabel: "Evaluación y cierre (5 min)",
    closureText: "• Revisar las preguntas del cuestionario juntos.\n• Resumir los puntos clave de la lección.",
    worksheetTitle: "Hoja de trabajo",
    worksheetItems: [
      'Escribe un párrafo corto que explique la idea principal de "{topic}".',
      '¿Cuáles son los elementos clave necesarios para que "{topic}" funcione?',
      'Da un ejemplo de "{topic}" de tu vida cotidiana o de tus observaciones.',
      'Dibuja o describe un diagrama que represente el flujo de trabajo de "{topic}".',
      'Resume la lección de hoy con tus propias palabras.'
    ],
    answerKeyTitle: "Clave de respuestas",
    worksheetAnswersLabel: "RESPUESTAS DE LA HOJA DE TRABAJO:",
    panelAnswersLabel: "RESPUESTAS DEL PANEL DE PREGUNTAS:",
    worksheetAnswers: [
      "Definición: {topic} es un concepto fundamental en {subject} que aborda los principios y propiedades clave de este tema.",
      "Elementos clave: Los componentes principales necesarios son la observación activa, la comprensión básica, la práctica estructurada y el repaso.",
      "Ejemplo cotidiano: Un ejemplo es identificar cómo se aplica {topic} en las clases diarias, tareas o discusiones.",
      "Diagrama: Los estudiantes deben ilustrar la entrada, el procesamiento/principios básicos de {topic} y el resultado o aplicación final.",
      "Resumen: Los estudiantes deben sintetizar que {topic} es una herramienta esencial en {subject} para el crecimiento conceptual."
    ],
    panelAnswersShort: [
      "Definición: Una declaración concisa que explica el significado de {topic}.",
      "Propósito principal: Establecer un marco conceptual claro para el estudio.",
      "Malentendido: La falsa creencia de que {topic} es solo teórico y no tiene aplicaciones prácticas."
    ],
    panelAnswersMedium: [
      "Explicación del proceso: El flujo de trabajo comienza con la introducción, continúa con la práctica activa y concluye con la evaluación.",
      "Comparación: A diferencia de otros temas pasivos, {topic} requiere un compromiso cognitivo activo.",
      "Escenario crítico: Al diseñar el plan de estudios o analizar elementos fundamentales."
    ],
    panelAnswersLong: [
      "Solución al problema: Utilizar los principios de {topic} para estructurar y simplificar tareas complejas.",
      "Efecto de la duración: Una duración de {duration} permite un ciclo de aprendizaje enfocado y altamente interactivo.",
      "Enfoque de enseñanza: Dividir la definición básica en analogías sencillas antes de introducir los detalles."
    ]
  },
  German: {
    quizQuestions: [
      'Welches der folgenden ist ein Hauptmerkmal von "{topic}"?',
      'Was ist das Hauptziel beim Lernen über "{topic}"?',
      'Richtig oder Falsch: "{topic}" spielt in modernen Anwendungen eine wichtige Rolle.',
      'Wie interagiert "{topic}" normalerweise mit anderen Konzepten in {subject}?',
      'Was ist im Klassenzimmer die beste Methode, um "{topic}" zu üben?'
    ],
    optionsA: ["Es tritt nur in Laborumgebungen auf", "Es ist ein grundlegendes Konzept in diesem Fachbereich", "Es wurde 1905 von Albert Einstein entdeckt", "Es hat keine praktische alltägliche Anwendung"],
    optionsB: ["Daten und historische Namen auswendig lernen", "Ein tiefes konzeptionelles Verständnis und Anwendungsfähigkeiten entwickeln", "Eine einzige standardisierte Multiple-Choice-Prüfung bestehen", "Sofort eine 500-seitige Dissertation schreiben"],
    optionsC: ["Richtig, es wird in allen Branchen häufig verwendet", "Falsch, es ist völlig veraltet und theoretisch", "Richtig, aber nur unter extrem seltenen Umständen", "Falsch, da es die Gesetze der Thermodynamik verletzt"],
    optionsD: ["Es arbeitet in völliger Isolation", "Es bildet das Kernfundament für fortgeschrittene Themen", "Es ist völlig inkompatibel und verursacht Fehler", "Es ersetzt alle anderen Konzepte vollständig"],
    optionsE: ["Indem man eine einzelne Folie wiederholt liest", "Durch interaktive Arbeitsblätter, Quizfragen und Diskussionsfragen", "Indem man es bis zum Tag der Prüfung ignoriert", "Indem man nur die erste Definition Wort für Wort auswendig lernt"],
    panelShort: [
      'Definieren Sie den Begriff "{topic}" in ein oder zwei klaren Sätzen.',
      'Nennen Sie den Hauptzweck von "{topic}" in diesem Kontext.',
      'Identifizieren Sie ein häufiges Missverständnis über "{topic}".'
    ],
    panelMedium: [
      'Erklären Sie den schrittweisen Prozess der Funktionsweise von "{topic}".',
      'Vergleichen Sie "{topic}" mit einem eng verwandten Konzept in {subject}.',
      'Beschreiben Sie ein Szenario, in dem das Verständnis von "{topic}" entscheidend wäre.'
    ],
    panelLong: [
      'Wenden Sie Ihr Wissen über "{topic}" an, um eine Lösung für ein reales Problem vorzuschlagen.',
      'Wie wirkt sich die Dauer ({duration}) auf die Lerntiefe von "{topic}" aus?',
      'Erklären Sie, wie Sie "{topic}" einem Schüler beibringen würden, der noch nie davon gehört hat.'
    ],
    planTitle: "Verlaufsplan",
    subjectLabel: "Fach",
    gradeLabel: "Klasse",
    durationLabel: "Dauer",
    languageLabel: "Sprache",
    objectivesLabel: "Lernziele",
    objectivesText: "Die Schüler werden die Kernkonzepte von {topic} verstehen und erfolgreich anwenden.",
    warmupLabel: "Aufwärmphase (10 Min.)",
    warmupText: "• Führen Sie das Thema mit einer Einstiegsfrage ein.\n• Ermitteln Sie das Vorwissen der Schüler über {topic}.",
    instructionLabel: "Erarbeitung (20 Min.)",
    instructionText: "• Präsentieren Sie die wichtigsten Prinzipien und Definitionen.\n• Gehen Sie wichtige Beispiele an der Tafel durch.",
    practiceLabel: "Anleitung & Übung (15 Min.)",
    practiceText: "• Bearbeiten Sie Übungsaufgaben gemeinsam in der Klasse.\n• Klären Sie erste Missverständnisse.",
    independentLabel: "Freiarbeit (10 Min.)",
    independentText: "• Lassen Sie die Schüler einzeln am Arbeitsblatt arbeiten.\n• Gehen Sie im Raum herum, um Hilfestellung zu geben.",
    closureLabel: "Sicherung & Abschluss (5 Min.)",
    closureText: "• Besprechen Sie die Quizfragen gemeinsam.\n• Fassen Sie die wichtigsten Erkenntnisse zusammen.",
    worksheetTitle: "Arbeitsblatt",
    worksheetItems: [
      'Schreiben Sie einen kurzen Absatz, der die Kernidee hinter "{topic}" erklärt.',
      'Was sind die wichtigsten Elemente, die für das Funktionieren von "{topic}" erforderlich sind?',
      'Nennen Sie ein Beispiel für "{topic}" aus Ihrem Alltag oder Ihren Beobachtungen.',
      'Zeichnen oder beschreiben Sie ein Diagramm, das den Ablauf/das Konzept von "{topic}" darstellt.',
      'Fassen Sie die heutige Lektion in eigenen Worten zusammen.'
    ],
    answerKeyTitle: "Lösungsschlüssel",
    worksheetAnswersLabel: "LÖSUNGEN ZUM ARBEITSBLATT:",
    panelAnswersLabel: "LÖSUNGEN ZUM FRAGENPANEL:",
    worksheetAnswers: [
      "Definition: {topic} ist ein grundlegendes Konzept in {subject}, das sich mit den wichtigsten Prinzipien und Eigenschaften dieses Themas befasst.",
      "Hauptkomponenten: Die erforderlichen Kernkomponenten sind aktive Beobachtung, grundlegendes Verständnis, strukturiertes Üben und Wiederholung.",
      "Alltagsbeispiel: Ein Beispiel ist die Erkennung, wie {topic} im täglichen Unterricht, bei Hausaufgaben oder in Diskussionen angewendet wird.",
      "Diagramm/Ablauf: Die Schüler sollten den Input, die Kernverarbeitung/Prinzipien von {topic} und das Endergebnis oder die Anwendung veranschaulichen.",
      "Zusammenfassung: Die Schüler sollten erkennen, dass {topic} ein wichtiges Werkzeug in {subject} für das konzeptionelle Wachstum ist."
    ],
    panelAnswersShort: [
      "Definition: Eine prägnante Aussage, die die Bedeutung von {topic} erklärt.",
      "Hauptzweck: Einen klaren konzeptionellen Rahmen für das Studium zu schaffen.",
      "Missverständnis: Der irrige Glaube, dass {topic} nur theoretisch ist und keine praktischen Anwendungen hat."
    ],
    panelAnswersMedium: [
      "Prozesserklärung: Der Ablauf beginnt mit der Einführung, setzt sich mit dem aktiven Üben fort und schließt mit der Bewertung ab.",
      "Vergleich: Im Gegensatz zu anderen passiven Themen erfordert {topic} aktives kognitives Engagement.",
      "Kritisches Szenario: Bei der Gestaltung des Lehrplans oder der Analyse grundlegender Elemente."
    ],
    panelAnswersLong: [
      "Problemlösung: Nutzung der Prinzipien von {topic}, um komplexe Aufgaben zu strukturieren und zu vereinfachen.",
      "Einfluss der Dauer: Eine Dauer von {duration} ermöglicht einen fokussierten, hochgradig interaktiven Lernzyklus.",
      "Lehransatz: Zerlegung der Kerndefinition in einfache Analogien, bevor Details eingeführt werden."
    ]
  },
 Japanese: {
    quizQuestions: [
      '次のうち、「{topic}」の主な特徴はどれですか？',
      '「{topic}」について学ぶ主な目的は何ですか？',
      '正しいか誤りか：「{topic}」は現代の応用において重要な役割を果たしています。',
      '「{topic}」は通常、{subject}の他の概念とどのように相互作用しますか？',
      'クラスの設定で、「{topic}」を練習する最良の方法は何ですか？'
    ],
    optionsA: ["実験室環境でのみ発生します", "この分野における基本的な概念です", "1905年にアルベルト・アインシュタインによって発見されました", "日常的な実用的応用はありません"],
    optionsB: ["日付や歴史的な名前を暗記すること", "深い概念の理解と応用力を開発すること", "1つの標準化された選択式試験に合格すること", "すぐに500ページの論文を書くこと"],
    optionsC: ["正しい、産業全体で広く活用されています", "誤り、完全に廃れており理論的なものにすぎません", "正しい、ただし極めて稀な状況に限られます", "誤り、熱力学の法則に違反するためです"],
    optionsD: ["完全に孤立して機能します", "高度なトピックの核となる基盤を形成します", "完全に互換性がなく、エラーの原因になります", "他のすべての概念を完全に置き換えます"],
    optionsE: ["1枚のスライドを繰り返し読むこと", "対話型のワークシート、クイズ、ディスカッション質問を通じて", "試験の日まで無視すること", "最初の定義だけを一言一句暗記すること"],
    panelShort: [
      '「{topic}」という用語を1つまたは2つの明確な文章で定義してください。',
      'この文脈における「{topic}」の主な目的を述べてください。',
      '「{topic}」に関する一般的な誤解を1つ特定してください。'
    ],
    panelMedium: [
      '「{topic}」がどのように機能するか、段階的なプロセスを説明してください。',
      '{subject}における密接に関連する概念と「{topic}」を比較してください。',
      '「{topic}」を理解することが重要となるシナリオを説明してください。'
    ],
    panelLong: [
      '実世界の課題に対する解決策を提案するために、「{topic}」の知識を応用してください。',
      '学習時間（{duration}）は「{topic}」の学習の深さにどのように影響しますか？',
      '「{topic}」を一度も聞いたことがない生徒にどのように教えるか説明してください。'
    ],
    planTitle: "指導案",
    subjectLabel: "教科",
    gradeLabel: "学年",
    durationLabel: "時間",
    languageLabel: "言語",
    objectivesLabel: "学習目標",
    objectivesText: "生徒は {topic} の核となる概念を理解し、それらを正しく応用できるようになります。",
    warmupLabel: "導入（10分）",
    warmupText: "• 質問を提示してトピックを紹介します。\n• {topic} に関する生徒の事前知識を確認します。",
    instructionLabel: "展開：直接指導（20分）",
    instructionText: "• 主な原則と定義を提示します。\n• 黒板で重要な例題を説明します。",
    practiceLabel: "展開：練習（15分）",
    practiceText: "• クラス全体で一緒に練習問題に取り組みます。\n• 初期段階の誤解を解消します。",
    independentLabel: "展開：個別学習（10分）",
    independentText: "• 生徒がワークシートに個別に取り組みます。\n• 教室を回りながら指導を行います。",
    closureLabel: "まとめ＆評価（5分）",
    closureText: "• 一緒にクイズ問題を確認します。\n• 今日の重要な学びを要約します。",
    worksheetTitle: "ワークシート",
    worksheetItems: [
      '「{topic}」の背後にある核となるアイデアを説明する短い段落を書いてください。',
      '「{topic}」が機能するために必要な主な要素は何ですか？',
      '日常生活や観察から「{topic}」の例を挙げてください。',
      '「{topic}」のワークフロー/概念を表す図を描くか、説明してください。',
      '今日のレッスンを自分の言葉で要約してください。'
    ],
    answerKeyTitle: "解答集",
    worksheetAnswersLabel: "ワークシートの解答：",
    panelAnswersLabel: "質問パネルの解答：",
    worksheetAnswers: [
      "定義：{topic} は {subject} における基本的な概念であり、このトピックの重要な原則と性質を扱います。",
      "主な要素：必要な主な要素は、能動的な観察、本質的な理解、体系的な練習、および復習です。",
      "日常生活の例：毎日の授業、宿題、または話し合いにおいて {topic} がどのように応用されているかを特定することです。",
      "図/ワークフロー：生徒はインプット、{topic} の主要な処理/原則、および最終的な成果や応用を図示する必要があります。",
      "要約：生徒は {topic} が概念の成長のために {subject} で不可欠なツールであることを統合して理解する必要があります。"
    ],
    panelAnswersShort: [
      "定義解答：{topic} の意味を説明する簡潔な記述。",
      "主な目的解答：学習のための明確な概念的枠組みを確立すること。",
      "誤解解答：{topic} は理論的なものにすぎず、実用的な応用はないという誤った信念。"
    ],
    panelAnswersMedium: [
      "プロセスの説明：ワークフローは導入から始まり、能動的な練習を経て、評価で終わります。",
      "比較：他の受動的なトピックとは異なり、{topic} は能動的な認知的関与を必要とします。",
      "重要なシナリオ：カリキュラムを設計するとき、または基礎的な要素を分析するとき。"
    ],
    panelAnswersLong: [
      "課題解決：複雑なタスクを構造化し、簡素化するために {topic} の原則を使用します。",
      "時間の影響：{duration} という時間は、集中した高度に対話的な学習サイクルを可能にします。",
      "指導方法：詳細を紹介する前に、核となる定義をシンプルな比喩に分解します。"
    ]
  },
  Chinese: {
    quizQuestions: [
      '以下哪项是“{topic}”的主要特征？',
      '学习“{topic}”的主要目标是什么？',
      '对或错：“{topic}”在现代应用中发挥着重要作用。',
      '“{topic}”通常如何与 {subject} 中的其他概念互动？',
      '在课堂环境中，练习“{topic}”的最佳方式是什么？'
    ],
    optionsA: ["它仅在实验室环境中发生", "它是该学科领域的一个基本概念", "它是阿尔伯特·爱因斯坦于1905年发现的", "它没有实际的日常应用"],
    optionsB: ["记忆日期和历史人物的名字", "培养深层的概念理解和应用能力", "通过单次标准化的多项选择考试", "立即撰写一篇500页的论文"],
    optionsC: ["对，它在各行各业中被广泛利用", "错，它已完全过时且仅具理论性", "对，但仅在极少数特殊情况下", "错，因为它违反了热力学定律"],
    optionsD: ["它在完全隔离的状态下运作", "它构成了高级主题的核心基础", "它完全不兼容并会导致错误", "它完全取代了所有其他概念"],
    optionsE: ["通过反复阅读单张幻灯片", "通过互动式练习卷、测验和讨论题", "忽略它直到考试当天", "仅逐字记忆第一个定义"],
    panelShort: [
      '用一两个清晰的句子定义“{topic}”这一术语。',
      '陈述在这种背景下“{topic}”的主要目的。',
      '指出关于“{topic}”的一个常见误区。'
    ],
    panelMedium: [
      '逐步解释“{topic}”是如何运作的。',
      '将“{topic}”与 {subject} 中密切相关的概念进行比较。',
      '描述一个理解“{topic}”至关重要的场景。'
    ],
    panelLong: [
      '应用您对“{topic}”的知识，为现实世界的问题提出解决方案。',
      '学习时长（{duration}）如何影响对“{topic}”的学习深度？',
      '解释您将如何向从未听说过“{topic}”的学生讲授这一概念。'
    ],
    planTitle: "课时计划",
    subjectLabel: "科目",
    gradeLabel: "年级",
    durationLabel: "时长",
    languageLabel: "语言",
    objectivesLabel: "教学目标",
    objectivesText: "学生将理解 {topic} 的核心概念并成功应用它们。",
    warmupLabel: "导入（10分钟）",
    warmupText: "• 通过一个开放性问题引入主题。\n• 评估学生对 {topic} 的背景知识。",
    instructionLabel: "精讲（20分钟）",
    instructionText: "• 讲解主要原理和定义。\n• 在黑板上梳理关键例题。",
    practiceLabel: "导练（15分钟）",
    practiceText: "• 全班一起进行互动式练习。\n• 及时纠正初步的误解。",
    independentLabel: "自练（10分钟）",
    independentText: "• 让学生独立完成练习卷。\n• 巡视课堂以提供个别指导。",
    closureLabel: "测评与小结（5分钟）",
    closureText: "• 共同讲评测验小题。\n• 总结本课的核心要点。",
    worksheetTitle: "随堂练习卷",
    worksheetItems: [
      '写一段话，解释“{topic}”背后的核心思想。',
      '“{topic}”运作所需的核心要素有哪些？',
      '举一个日常生活中或观察到的“{topic}”的例子。',
      '画出或描述一个代表“{topic}”工作流/概念的图表。',
      '用自己的话总结今天的课程。'
    ],
    answerKeyTitle: "参考答案",
    worksheetAnswersLabel: "随堂练习卷答案：",
    panelAnswersLabel: "问题面板答案：",
    worksheetAnswers: [
      "定义：{topic} 是 {subject} 中的一个基本概念，涉及本主题的关键原理和属性。",
      "核心要素：所需的主要部分是主动观察、核心理解、系统练习和复习。",
      "日常生活例子：例如识别 {topic} 如何应用在日常课程、家庭作业或讨论中。",
      "图表/工作流：学生应描绘出输入、{topic} 的核心处理/原理以及最终结果或应用。",
      "总结：学生应当体会到 {topic} 是 {subject} 中概念成长的必不可少的工具。"
    ],
    panelAnswersShort: [
      "定义答案：解释 {topic} 含义的简洁陈述。",
      "主要目的答案：为研究建立清晰的概念框架。",
      "误区答案：认为 {topic} 只是理论性的、没有实际应用价值的错误信念。"
    ],
    panelAnswersMedium: [
      "过程解释：工作流从导入开始，通过积极练习展开，以测评结束。",
      "比较：与其他被动学习的主题不同，{topic} 需要主动的认知参与。",
      "关键场景：在设计课程体系或分析核心基础元素时。"
    ],
    panelAnswersLong: [
      "问题解决方案：利用 {topic} 的原理来结构化和简化复杂的任务。",
      "时长影响：{duration} 的学习时长能够确保一个专注且高度互动的教学循环。",
      "教学方法：在引入具体细节之前，将核心定义分解为简单的类比。"
    ]
  }
};

function mockLesson(i: LessonInput): LessonOutput {
  const lang = i.language || "English";
  const mock = LOCALIZED_MOCKS[lang] || LOCALIZED_MOCKS.English;

  const replaceKeys = (str: string) => {
    return str
      .replace(/\{topic\}/g, i.topic)
      .replace(/\{subject\}/g, i.subject)
      .replace(/\{duration\}/g, i.duration);
  };

  const mockQuiz = mock.quizQuestions.map((q, idx) => {
    let options = mock.optionsA;
    if (idx === 1) options = mock.optionsB;
    if (idx === 2) options = mock.optionsC;
    if (idx === 3) options = mock.optionsD;
    if (idx === 4) options = mock.optionsE;

    return {
      question: replaceKeys(q),
      options: options.map(replaceKeys),
      answer: idx === 2 ? "A" : "B"
    };
  });

  const mockQuestionPanel = {
    short: mock.panelShort.map(replaceKeys),
    medium: mock.panelMedium.map(replaceKeys),
    long: mock.panelLong.map(replaceKeys)
  };

  const formattedPlan = `🎓 ${replaceKeys(i.topic)} — ${mock.planTitle}

📖 ${mock.subjectLabel}: ${i.subject}
📖 ${mock.gradeLabel}: ${i.grade}
📖 ${mock.durationLabel}: ${i.duration}
📖 ${mock.languageLabel}: ${i.language}

🎯 ${mock.objectivesLabel}
${replaceKeys(mock.objectivesText)}

⏱️ ${mock.warmupLabel}
${replaceKeys(mock.warmupText)}

🏫 ${mock.instructionLabel}
${replaceKeys(mock.instructionText)}

🤝 ${mock.practiceLabel}
${replaceKeys(mock.practiceText)}

✏️ ${mock.independentLabel}
${replaceKeys(mock.independentText)}

✅ ${mock.closureLabel}
${replaceKeys(mock.closureText)}`;

  const formattedWorksheet = `📝 ${replaceKeys(i.topic)} — ${mock.worksheetTitle}

${mock.worksheetItems.map((item, idx) => `${idx + 1}. ${replaceKeys(item)}`).join("\n")}

---QUESTION_PANEL---
${JSON.stringify(mockQuestionPanel)}`;

  const worksheetAnsText = mock.worksheetAnswers.map((a, idx) => `${idx + 1}. ${replaceKeys(a)}`).join("\n");
  const panelAnsShortText = mock.panelAnswersShort.map((a, idx) => `${idx + 1}. ${replaceKeys(a)}`).join("\n");
  const panelAnsMediumText = mock.panelAnswersMedium.map((a, idx) => `${idx + 1}. ${replaceKeys(a)}`).join("\n");
  const panelAnsLongText = mock.panelAnswersLong.map((a, idx) => `${idx + 1}. ${replaceKeys(a)}`).join("\n");

  const formattedAnswerKey = `🔑 ${replaceKeys(i.topic)} — ${mock.answerKeyTitle}

📝 ${mock.worksheetAnswersLabel}
${worksheetAnsText}

🧠 ${mock.panelAnswersLabel}

[Short Length Segment]
${panelAnsShortText}

[Medium Length Segment]
${panelAnsMediumText}

[Short Length Set 2 / Long Segment]
${panelAnsLongText}`;

  const mockRubric = {
    criteria: [
      {
        name: "Understanding of Concepts",
        levels: {
          Excellent: "Demonstrates comprehensive and advanced understanding of the topic.",
          Good: "Demonstrates clear and accurate understanding of the main concepts.",
          Developing: "Shows partial understanding but with minor conceptual gaps or errors.",
          Beginning: "Demonstrates limited understanding and has major gaps in concept comprehension."
        }
      },
      {
        name: "Application & Accuracy",
        levels: {
          Excellent: "Applies concepts flawlessly to new situations and solves all problems correctly.",
          Good: "Applies concepts to solve most problems correctly with minor errors.",
          Developing: "Applies concepts with limited success; makes frequent or significant errors.",
          Beginning: "Unable to apply concepts to solve practical problems."
        }
      },
      {
        name: "Clarity & Presentation",
        levels: {
          Excellent: "Work is exceptionally organized, clear, and easy to follow.",
          Good: "Work is generally organized and clear with minor structure improvements possible.",
          Developing: "Work is disorganized, making it difficult to follow in several parts.",
          Beginning: "Work lacks any visible organization or clear presentation."
        }
      }
    ],
    teacher_guidance: "When grading this assignment, award up to 4 points per criteria for a total of 12 points. Provide constructive feedback on any criteria scoring developing or below."
  };

  const mockHomework = {
    estimated_time: "30 minutes",
    difficulty_level: "Medium",
    tasks: [
      {
        question: `Explain how the core principles of ${i.topic} apply to a real-world scenario of your choice.`,
        type: "short_answer"
      },
      {
        question: `Summarize the three most critical components of ${i.topic} discussed during today's lesson.`,
        type: "short_answer"
      },
      {
        question: `Create a brief flow chart or timeline demonstrating the typical lifecycle or process of ${i.topic}.`,
        type: "project"
      }
    ],
    answer_key: `Task 1 Sample Answer: Students should describe a valid scenario (e.g. everyday occurrence) and connect it to ${i.topic}.\nTask 2 Sample Answer: The three components are conceptual understanding, active application, and assessment feedback.\nTask 3 Sample Answer: The chart should show an input, core principles processing, and final output.`
  };

  return {
    lesson_plan: formattedPlan,
    worksheet: formattedWorksheet,
    quiz: JSON.stringify(mockQuiz),
    answer_key: formattedAnswerKey,
    rubric: JSON.stringify(mockRubric),
    homework: JSON.stringify(mockHomework)
  };
}

export async function generateRubric(input: {
  subject: string;
  grade: string;
  topic: string;
  objectives: string;
  assessmentType: string;
  language: string;
}): Promise<string> {
  const geminiKey = localStorage.getItem("gemini_api_key") || (import.meta.env.VITE_GEMINI_API_KEY as string);
  
  if (!geminiKey) {
    // Return mock rubric
    const mockRubric = {
      criteria: [
        {
          name: `${input.assessmentType || "Assessment"} Criteria 1`,
          levels: {
            Excellent: "Shows mastery and complete precision in the topic.",
            Good: "Shows correct understanding and minor areas for growth.",
            Developing: "Shows basic understanding with multiple errors.",
            Beginning: "Fails to meet the basic standards of the criteria."
          }
        },
        {
          name: "Presentation & Communication",
          levels: {
            Excellent: "Clear, fluent, and highly professional layout/speech.",
            Good: "Understandable and mostly clean structure.",
            Developing: "Lacks flow and contains some confusing elements.",
            Beginning: "Incoherent or extremely disorganized."
          }
        }
      ],
      teacher_guidance: `This rubic is specifically tailored for ${input.assessmentType || "General"} assessment on ${input.topic}.`
    };
    return JSON.stringify(mockRubric);
  }

  const prompt = `You are a professional educational assistant. Generate an analytical grading rubric in JSON format for the following details:
Subject: ${input.subject}
Grade: ${input.grade}
Topic: ${input.topic}
Objectives: ${input.objectives}
Assessment Type: ${input.assessmentType || "General Classroom Assessment"}
Language: ${input.language}

CRITICAL LANGUAGE REQUIREMENT:
Generate ALL content directly and entirely in the specified language: ${input.language}.

Return ONLY a JSON object with exactly this structure:
{
  "criteria": [
    {
      "name": "string",
      "levels": {
        "Excellent": "string",
        "Good": "string",
        "Developing": "string",
        "Beginning": "string"
      }
    }
  ],
  "teacher_guidance": "string"
}`;

  const res = await fetchGeminiWithRetry(geminiKey, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" }
  });
  const result = await res.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error("No response from Gemini API");

  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  }
  return cleaned;
}

export async function generateHomework(input: {
  subject: string;
  grade: string;
  topic: string;
  objectives: string;
  lessonContent: string;
  language: string;
}): Promise<string> {
  const geminiKey = localStorage.getItem("gemini_api_key") || (import.meta.env.VITE_GEMINI_API_KEY as string);
  
  if (!geminiKey) {
    const mockHomework = {
      estimated_time: "20-30 minutes",
      difficulty_level: "Medium",
      tasks: [
        { question: `Define the primary goals of ${input.topic} based on today's lesson.`, type: "short_answer" },
        { question: `Give two concrete examples of ${input.topic} in real life.`, type: "short_answer" }
      ],
      answer_key: "Task 1 Answer: Accurate goals definitions. Task 2 Answer: Logical real life examples."
    };
    return JSON.stringify(mockHomework);
  }

  const prompt = `You are a professional educational assistant. Generate a homework assignment in JSON format based on the following lesson details and content:
Subject: ${input.subject}
Grade: ${input.grade}
Topic: ${input.topic}
Objectives: ${input.objectives}
Lesson Content Summary: ${input.lessonContent.substring(0, 1500)}
Language: ${input.language}

CRITICAL LANGUAGE REQUIREMENT:
Generate ALL content directly and entirely in the specified language: ${input.language}.

Return ONLY a JSON object with exactly this structure:
{
  "estimated_time": "string",
  "difficulty_level": "string",
  "tasks": [
    {
      "question": "string",
      "type": "string"
    }
  ],
  "answer_key": "text"
}`;

  const res = await fetchGeminiWithRetry(geminiKey, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" }
  });
  const result = await res.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error("No response from Gemini API");

  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  }
  return cleaned;
}

export async function duplicateAndAdaptLesson(original: any, changedFields: any): Promise<LessonOutput> {
  const geminiKey = localStorage.getItem("gemini_api_key") || (import.meta.env.VITE_GEMINI_API_KEY as string);
  
  if (!geminiKey) {
    // If mock, just replace topic, grade, duration in the original string contents
    const replaceVals = (str: string | null) => {
      if (!str) return "";
      let s = str;
      if (changedFields.topic) s = s.replace(new RegExp(original.topic || "", "gi"), changedFields.topic);
      if (changedFields.grade) s = s.replace(new RegExp("Grade " + (original.grade || ""), "gi"), "Grade " + changedFields.grade);
      if (changedFields.duration) s = s.replace(new RegExp(original.duration || "", "gi"), changedFields.duration);
      return s;
    };

    return {
      lesson_plan: replaceVals(original.lesson_plan),
      worksheet: replaceVals(original.worksheet),
      quiz: replaceVals(original.quiz),
      answer_key: replaceVals(original.answer_key),
      rubric: replaceVals(original.rubric),
      homework: replaceVals(original.homework)
    };
  }

  const prompt = `You are a professional educational assistant. You are cloning/duplicating an existing lesson kit and adapting it to new parameters.
Original Settings:
Subject: ${original.subject}
Grade: ${original.grade}
Topic: ${original.topic}
Duration: ${original.duration}
Language: ${original.language}
Objectives: ${original.objectives}

New Target Settings:
Subject: ${changedFields.subject || original.subject}
Grade: ${changedFields.grade || original.grade}
Topic: ${changedFields.topic || original.topic}
Duration: ${changedFields.duration || original.duration}
Language: ${changedFields.language || original.language}
Objectives: ${changedFields.objectives || original.objectives}

Original Lesson Kit Content:
- Lesson Plan: ${original.lesson_plan}
- Worksheet: ${original.worksheet}
- Quiz: ${original.quiz}
- Answer Key: ${original.answer_key}
- Rubric: ${original.rubric || ""}
- Homework: ${original.homework || ""}

INSTRUCTION:
Review what has changed in the settings. If a setting has changed (e.g. topic, grade, objectives, or duration), modify only the parts of the lesson plan, worksheet, quiz, answer key, rubric, or homework that are affected. If a section is NOT affected, keep it as close to the original content as possible.
Return the complete adapted lesson kit.

Return ONLY a JSON object with this structure:
{
  "lesson_plan": "text",
  "worksheet": "text",
  "question_panel": {
    "short": ["string", "string", "string"],
    "medium": ["string", "string", "string"],
    "long": ["string", "string", "string"]
  },
  "quiz": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "answer": "string"
    }
  ],
  "answer_key": "text",
  "rubric": {
    "criteria": [
      {
        "name": "string",
        "levels": {
          "Excellent": "string",
          "Good": "string",
          "Developing": "string",
          "Beginning": "string"
        }
      }
    ],
    "teacher_guidance": "string"
  },
  "homework": {
    "estimated_time": "string",
    "difficulty_level": "string",
    "tasks": [
      {
        "question": "string",
        "type": "string"
      }
    ],
    "answer_key": "text"
  }
}`;

  const res = await fetchGeminiWithRetry(geminiKey, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" }
  });
  const result = await res.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error("No response from Gemini API");

  let cleaned = rawText.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  }

  const parsed = JSON.parse(cleaned);
  return {
    lesson_plan: parsed.lesson_plan || "",
    worksheet: `${parsed.worksheet || ""}\n\n---QUESTION_PANEL---\n${JSON.stringify(parsed.question_panel || {})}`,
    quiz: JSON.stringify(parsed.quiz || []),
    answer_key: parsed.answer_key || "",
    rubric: JSON.stringify(parsed.rubric || { criteria: [], teacher_guidance: "" }),
    homework: JSON.stringify(parsed.homework || { estimated_time: "", difficulty_level: "", tasks: [], answer_key: "" })
  };
}

export async function generateAIRecommendations(performanceLog: string): Promise<string> {
  const apiKey = localStorage.getItem("gemini_api_key") || (import.meta.env.VITE_GEMINI_API_KEY as string);
  if (!apiKey) {
    return "Please set your Gemini API key in the settings to get personalized AI learning recommendations.";
  }

  const prompt = `You are an AI-powered educational coach. Analyze the following student performance log (including completed lessons, quiz scores, and subject areas) and generate a brief, professional, and encouraging set of learning recommendations. Highlight specific strengths, identify areas that need revision, and recommend actionable topics. Format your output nicely using markdown. Do not include any HTML.

Student Performance Log:
${performanceLog}`;

  try {
    const res = await fetchGeminiWithRetry(apiKey, {
      contents: [{ parts: [{ text: prompt }] }]
    });
    const result = await res.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Empty response from Gemini API");
    return rawText.trim();
  } catch (err) {
    console.error("Error in generateAIRecommendations:", err);
    return `### AI Revision Recommendations
* **Focus on Key Areas**: Dedicate time to reviewing the core definitions and concepts of your recent lessons.
* **Practice Quizzes**: Take quizzes again for lessons where your score was below 80%.
* **Consistency**: Try to learn for 10-15 minutes every day to build a solid habit.
*(Note: Automated recommendation failed to generate via Gemini; displaying general guidelines instead)*`;
  }
}

export async function generatePersonalizedStudyPlan(performanceLog: string): Promise<string> {
  const apiKey = localStorage.getItem("gemini_api_key") || (import.meta.env.VITE_GEMINI_API_KEY as string);
  if (!apiKey) {
    return "Please set your Gemini API key in the settings to get a personalized study plan.";
  }

  const prompt = `You are an AI study planning assistant. Based on the student's performance log, create a personalized weekly study schedule. Group by subject areas, focusing more time on subjects with lower quiz scores or less completion. Format your output as a professional markdown study plan with bullet points or tables. Do not include HTML.

Student Performance Log:
${performanceLog}`;

  try {
    const res = await fetchGeminiWithRetry(apiKey, {
      contents: [{ parts: [{ text: prompt }] }]
    });
    const result = await res.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error("Empty response from Gemini API");
    return rawText.trim();
  } catch (err) {
    console.error("Error in generatePersonalizedStudyPlan:", err);
    return `### Weekly Study Schedule
* **Monday (Conceptual Review)**: 20 minutes review of recent lesson notes.
* **Wednesday (Quiz Mastery)**: 15 minutes practice on weak areas.
* **Friday (Active Recall)**: 20 minutes summarizing key takeaways.
*(Note: Automated schedule failed to generate via Gemini; displaying general guidelines instead)*`;
  }
}

async function queryGemini(prompt: string, jsonResponse: boolean = false): Promise<string> {
  const apiKey = localStorage.getItem("gemini_api_key") || (import.meta.env.VITE_GEMINI_API_KEY as string);
  if (!apiKey) {
    throw new Error("Missing Gemini API Key. Configure it in your profile settings.");
  }

  const payload: any = {
    contents: [{ parts: [{ text: prompt }] }]
  };
  if (jsonResponse) {
    payload.generationConfig = { responseMimeType: "application/json" };
  }

  const res = await fetchGeminiWithRetry(apiKey, payload);

  const result = await res.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error("No response content from Gemini API");

  let cleaned = rawText.trim();
  if (jsonResponse && cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  }
  return cleaned;
}

export async function generateLessonSummaries(lessonContent: string, language: string): Promise<{
  short_summary: string;
  revision_notes: string;
  exam_notes: string;
  one_minute_review: string;
}> {
  const prompt = `You are a curriculum design specialist. Based on the lesson contents below, generate study summaries in the following formats:
1. **Short Summary**: A concise 2-3 paragraph overview of the lesson's main themes and takeaways.
2. **Revision Notes**: A structured set of revision study notes containing the core definitions and key facts.
3. **Exam Notes**: Targeted exam preparation notes focusing on concepts likely to be tested, common student pitfalls, and quick formulas or mnemonics.
4. **One Minute Review**: A quick bulleted review summary that a student can read in 60 seconds.

Return ONLY a JSON object matching this structure:
{
  "short_summary": "text",
  "revision_notes": "text",
  "exam_notes": "text",
  "one_minute_review": "text"
}

CRITICAL LANGUAGE REQUIREMENT: Write the entire contents directly in the requested language: ${language}. Do not output English.

Lesson Contents:
${lessonContent}`;

  const jsonStr = await queryGemini(prompt, true);
  const parsed = JSON.parse(jsonStr);
  return {
    short_summary: parsed.short_summary || "",
    revision_notes: parsed.revision_notes || "",
    exam_notes: parsed.exam_notes || "",
    one_minute_review: parsed.one_minute_review || "",
  };
}

export async function generateLessonQuestions(lessonContent: string, language: string): Promise<string> {
  const prompt = `You are an educational assessment expert. Generate a comprehensive question bank based on the lesson contents below. 
Include questions under the following categories:
1. **Multiple Choice Questions (MCQs)**: exactly 3 questions with 4 options and correct answer keys.
2. **True / False**: exactly 3 statements with answers.
3. **Fill in the Blanks**: exactly 3 statements with answer keys.
4. **Short Answer Questions**: exactly 2 questions with model answers.
5. **Long Answer Questions**: exactly 1 question with model answer/evaluation criteria.

Format the output as a beautiful, clean markdown document. Do not include HTML.
CRITICAL LANGUAGE REQUIREMENT: Write everything directly in the requested language: ${language}. Do not output English.

Lesson Contents:
${lessonContent}`;

  return await queryGemini(prompt, false);
}

export async function generateBloomsQuestions(lessonContent: string, language: string): Promise<string> {
  const prompt = `You are a teacher trainer specialized in cognitive development. Based on the lesson contents below, generate assessment questions matching the 6 levels of Bloom's Taxonomy:
1. **Remember**: Recalling facts, terms, or definitions.
2. **Understand**: Explaining ideas or concepts.
3. **Apply**: Using information in new situations or solving problems.
4. **Analyze**: Drawing connections among ideas or breaking down concepts.
5. **Evaluate**: Justifying a stand or decision.
6. **Create**: Producing new or original work related to the topic.

Provide exactly 1-2 questions for each level, including brief answer keys or evaluation guidance.
Format the output as a clean, beautifully structured markdown document. Do not include HTML.
CRITICAL LANGUAGE REQUIREMENT: Write everything directly in the requested language: ${language}. Do not output English.

Lesson Contents:
${lessonContent}`;

  return await queryGemini(prompt, false);
}

export async function generateTeachingSuggestions(lessonContent: string, language: string): Promise<string> {
  const prompt = `You are a senior pedagogical advisor. Based on the lesson contents below, generate teaching suggestions to help the teacher deliver the class effectively. 
Include:
1. **Classroom Activities**: Interactive tasks, group discussions, or games to run during the lesson.
2. **Teaching Strategies**: Methods for introducing the topic and explaining complex concepts.
3. **Student Engagement Tips**: Hooks or prompts to capture student attention.
4. **Differentiation Methods**: Actionable recommendations for catering to both struggling students and advanced/gifted learners.

Format the output as a clean, professional markdown document. Do not include HTML.
CRITICAL LANGUAGE REQUIREMENT: Write everything directly in the requested language: ${language}. Do not output English.

Lesson Contents:
${lessonContent}`;

  return await queryGemini(prompt, false);
}

export async function regenerateLessonSection(
  lessonData: {
    title: string;
    subject: string | null;
    grade: string | null;
    topic: string | null;
    duration: string | null;
    objectives: string | null;
    lesson_plan: string | null;
    worksheet: string | null;
    quiz: string | null;
    homework: string | null;
    answer_key: string | null;
  },
  sectionToRegenerate: 'lesson_plan' | 'worksheet' | 'quiz' | 'homework' | 'answer_key',
  promptInstruction: string,
  language: string
): Promise<string> {
  const prompt = `You are a curriculum developer. You are asked to regenerate ONLY the '${sectionToRegenerate}' section of the following lesson kit. 
The other parts of the lesson kit MUST remain unchanged, and your newly generated section MUST align with them.

Here is the current lesson context:
Title: ${lessonData.title}
Subject: ${lessonData.subject || "General"}
Grade: ${lessonData.grade || "General"}
Topic: ${lessonData.topic || "General"}
Duration: ${lessonData.duration || "General"}
Objectives: ${lessonData.objectives || "General"}

Other Lesson Elements:
${sectionToRegenerate !== 'lesson_plan' ? `Lesson Plan:\n${lessonData.lesson_plan}\n\n` : ''}
${sectionToRegenerate !== 'worksheet' ? `Worksheet:\n${lessonData.worksheet}\n\n` : ''}
${sectionToRegenerate !== 'quiz' ? `Quiz:\n${lessonData.quiz}\n\n` : ''}
${sectionToRegenerate !== 'homework' ? `Homework:\n${lessonData.homework}\n\n` : ''}
${sectionToRegenerate !== 'answer_key' ? `Answer Key:\n${lessonData.answer_key}\n\n` : ''}

Teacher Instruction for Regeneration:
"${promptInstruction}"

CRITICAL INSTRUCTION:
Generate ONLY the new content for the '${sectionToRegenerate}' section. 
Do not include other sections in your output. Return only the plain content (using markdown headings if appropriate for that section).
CRITICAL LANGUAGE REQUIREMENT: Write everything directly in the requested language: ${language}. Do not output English.`;

  return await queryGemini(prompt, false);
}

export async function askTutorQuestion(
  lessonContent: string,
  chatHistory: { role: 'user' | 'model'; content: string }[],
  question: string,
  language: string
): Promise<string> {
  const prompt = `You are an encouraging, professional, and knowledgeable AI Tutor. You are helping a student understand the following lesson.
Ground your answers inside the lesson context provided. If the student asks something outside of the lesson, gently guide them back while answering briefly.

Lesson Context:
${lessonContent}

Chat History:
${chatHistory.map(h => `${h.role === 'user' ? 'Student' : 'Tutor'}: ${h.content}`).join('\n')}

New Student Question:
"${question}"

CRITICAL INSTRUCTIONS:
- Keep your answer clear, easy to understand, and brief (1-2 paragraphs max).
- Use formatting (bullet points, bold text) where appropriate to make it readable.
- CRITICAL LANGUAGE REQUIREMENT: Write your entire answer directly in the requested language: ${language}. Do not respond in English unless the student's question is specifically about learning English.`;

  return await queryGemini(prompt, false);
}


