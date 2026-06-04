<p align="center">
  <img src="https://img.shields.io/badge/TechFlow_AI-Educational_SaaS-7C3AED?style=for-the-badge&logo=graduationcap&logoColor=white" alt="TechFlow AI" />
</p>

<h1 align="center">🎓 TechFlow AI</h1>

<p align="center">
  <strong>AI-Powered Lesson Kit Generator & Intelligent Study Platform</strong>
</p>

<p align="center">
  <em>Generate complete lesson plans, worksheets, quizzes, rubrics, homework & study guides — in seconds, in 7 languages.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/TanStack_Start-FF4154?style=flat-square&logo=reactrouter&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/Gemini_AI-4285F4?style=flat-square&logo=google&logoColor=white" />
  <img src="https://img.shields.io/badge/Dify_Workflows-7C3AED?style=flat-square&logo=workflow&logoColor=white" />
  <img src="https://img.shields.io/badge/Tailwind_CSS_4-38BDF8?style=flat-square&logo=tailwindcss&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite_7-646CFF?style=flat-square&logo=vite&logoColor=white" />
</p>

<p align="center">
  <a href="#-live-demo">Live Demo</a> •
  <a href="#-features">Features</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-screenshots">Screenshots</a> •
  <a href="#-roadmap">Roadmap</a>
</p>

---

## 📋 Table of Contents

- [Product Overview](#-product-overview)
  - [Project Explainer Diagrams](#-project-explainer-diagrams)
- [Problem Solved](#-problem-solved)
- [Solution Architecture](#-solution-architecture)
- [Features](#-features)
- [Workflow Explanation](#-workflow-explanation)
- [Tech Stack](#-tech-stack)
- [Installation Steps](#-installation-steps)
- [Environment Variables](#-environment-variables)
- [Screenshots](#-screenshots)
- [Future Roadmap](#-future-roadmap)
- [Creator Information](#-creator-information)
- [License](#-license)

---

## 🌟 Product Overview

**TechFlow AI** is a full-stack AI-powered educational SaaS platform that empowers **teachers** and **students** with intelligent content generation and personalized learning experiences.

Teachers input a subject, grade, topic, and learning objectives — and TechFlow AI generates a **complete lesson kit** including structured lesson plans, student worksheets, practice quizzes (with MCQ auto-grading), answer keys, grading rubrics, and homework assignments. Students access a public study library, take quizzes, earn XP & badges, chat with an AI tutor, generate flashcards, and receive personalized study plans.

The platform supports **7 languages** (English, Hindi, French, Spanish, German, Japanese, Chinese) with full UI localization and AI output translation, making it accessible to a global audience.

> **🎯 Target Users:** K-12 Teachers, Educators, Students, Tutoring Centers, and EdTech Organizations.

### 🎨 Project Explainer Diagrams

<p align="center">
  <img src="./Project%20Explainer%20Image%201.png" alt="Project Explainer Image 1" width="100%" />
</p>

<p align="center">
  <img src="./Project%20Explainer%20Image%202.png" alt="Project Explainer Image 2" width="100%" />
</p>

---

## 🔍 Problem Solved

| Problem | Impact |
|---------|--------|
| 🕐 **Teachers spend 5–10 hours/week** creating lesson plans, worksheets, and quizzes manually | Lost teaching time, burnout |
| 📝 **No unified tool** to generate lesson plan + worksheet + quiz + rubric + homework together | Fragmented workflow across multiple tools |
| 🌐 **Language barriers** for non-English-speaking educators | Excludes millions of teachers globally |
| 📊 **No student progress tracking** in traditional lesson-prep tools | Teachers can't measure learning outcomes |
| 🤖 **Students lack AI tutoring** tied to specific lesson content | Generic AI assistants don't understand the curriculum context |
| 🎯 **No gamification** in traditional study platforms | Low student engagement and motivation |

**TechFlow AI solves all of these** by combining AI-powered content generation with a full classroom management system, multilingual support, and gamified student engagement — all in a single platform.

---

## 🏗 Solution Architecture

### High-Level Architecture Diagram

```mermaid
graph TB
    subgraph "🖥️ Frontend - TanStack Start + React 19"
        LP["🏠 Landing Page"]
        AUTH["🔐 Auth (Login/Register)"]
        DASH["📊 Teacher Dashboard"]
        GEN["⚡ Lesson Generator"]
        LIB["📚 Lesson Library"]
        LESSON["📖 Lesson Detail View"]
        EXPLORE["🔍 Public Explore"]
        STUDY["📝 Student Study View"]
        TUTOR["🤖 AI Tutor Chat"]
        PROGRESS["📈 Student Progress"]
        ANALYTICS["📊 Teacher Analytics"]
        CLASS["🎓 Class Progress"]
        PROFILE["👤 Profile Settings"]
    end

    subgraph "🧠 AI Layer"
        DIFY["Dify Workflow Engine<br/>(LLaMA 3 via OpenRouter)"]
        GEMINI["Google Gemini 2.5 Flash<br/>(Direct API)"]
    end

    subgraph "☁️ Backend - Supabase"
        SUPA_AUTH["Auth (Email + Google OAuth)"]
        SUPA_DB["PostgreSQL Database"]
        SUPA_RLS["Row Level Security"]
        SUPA_RT["Realtime Subscriptions"]
    end

    LP --> AUTH
    AUTH --> SUPA_AUTH
    DASH --> SUPA_DB
    GEN --> DIFY
    GEN --> GEMINI
    LESSON --> GEMINI
    TUTOR --> GEMINI
    STUDY --> GEMINI
    PROGRESS --> GEMINI
    EXPLORE --> SUPA_DB
    ANALYTICS --> SUPA_DB
    CLASS --> SUPA_DB
    PROFILE --> SUPA_DB

    DIFY -->|"lesson_plan JSON"| SUPA_DB
    GEMINI -->|"worksheet, quiz,<br/>rubric, homework"| SUPA_DB

    style DIFY fill:#7C3AED,color:#fff
    style GEMINI fill:#4285F4,color:#fff
    style SUPA_AUTH fill:#3FCF8E,color:#fff
    style SUPA_DB fill:#3FCF8E,color:#fff
```

### Data Flow Diagram

```mermaid
sequenceDiagram
    participant T as 👩‍🏫 Teacher
    participant UI as 🖥️ Frontend
    participant DIFY as 🧠 Dify Workflow
    participant GEMINI as 🤖 Gemini AI
    participant DB as ☁️ Supabase DB

    T->>UI: Input (Subject, Grade, Topic, Duration, Objectives)
    UI->>DIFY: POST /workflows/run (lesson plan generation)
    DIFY-->>UI: Structured Lesson Plan (Markdown)
    UI->>GEMINI: Generate Worksheet + Quiz + Answer Key
    GEMINI-->>UI: JSON (MCQ Quiz) + Markdown (Worksheet, Answer Key)
    UI->>DB: INSERT lesson record
    DB-->>UI: Lesson saved ✅

    Note over T,UI: Teacher can then:
    T->>UI: Generate Rubric / Homework / Summaries
    UI->>GEMINI: On-demand AI generation
    GEMINI-->>UI: Rubric Matrix / Homework / Study Guides
    UI->>DB: UPDATE lesson fields

    Note over T,UI: Student Flow:
    participant S as 🧑‍🎓 Student
    S->>UI: Browse Explore → Open Study View
    UI->>DB: Fetch published lesson
    S->>UI: Take Quiz → Submit Answers
    UI->>DB: INSERT student_progress (score, completion)
    S->>UI: Open AI Tutor
    UI->>GEMINI: askTutorQuestion(lessonContext, history, question)
    GEMINI-->>UI: Contextual AI answer
    UI->>DB: INSERT tutor_chats
```

---

## ✨ Features

### 👩‍🏫 For Teachers

| Feature | Description |
|---------|-------------|
| ⚡ **One-Click Lesson Kit Generation** | Generate a complete lesson plan, worksheet, practice quiz, and answer key in one click |
| 📋 **AI Grading Rubric** | Generate structured assessment rubrics with 4-level criteria matrices |
| 📝 **AI Homework Generator** | Create take-home assignments aligned with lesson objectives |
| 🔄 **Smart Regeneration** | Regenerate individual sections with custom instructions (e.g., "make the quiz easier") |
| 📖 **Version History** | Every edit creates a snapshot; restore any previous version instantly |
| 📑 **Duplicate & Adapt** | Clone any lesson and adapt it for a different grade, subject, or language |
| 📊 **Teacher Analytics Dashboard** | Track lessons created, published, student views, shares, and usage trends with interactive charts |
| 🎓 **Class Progress Portal** | Create shareable assignment links, track student submissions, and provide feedback/grades |
| 📤 **Export to PDF** | Download individual sections or the complete lesson kit as a beautifully formatted PDF |
| ✉️ **Email Sharing** | Share lesson content directly via email |
| 🌐 **Publish to Library** | Toggle lessons between private and public; published lessons appear in the global Explore library |

### 🧑‍🎓 For Students

| Feature | Description |
|---------|-------------|
| 📚 **Public Study Library** | Browse all published lessons — no account required |
| 📝 **Interactive Quiz Taking** | Take MCQ quizzes with instant auto-grading and score tracking |
| 🤖 **AI Tutor (Doubt Solver)** | Chat with an AI tutor that has full context of the lesson plan and worksheet |
| 🃏 **AI Flashcard Generator** | Generate study flashcards on any topic with adjustable difficulty |
| 🔊 **Read Aloud (TTS)** | Listen to lesson content, flashcards, and AI responses via browser text-to-speech |
| 📈 **Progress Dashboard** | Track streaks, XP points, quiz averages, and completed lessons |
| 🏆 **Gamification & Badges** | Earn badges (First Steps, Quiz Master, Perfect Score, Weekly Learner, Consistent Learner) |
| 🥇 **Leaderboard** | Compete with classmates on a points-based leaderboard |
| 🧠 **AI Study Recommendations** | Get personalized revision topics and learning suggestions based on quiz performance |
| 📅 **AI Study Plan Generator** | Generate a weekly study schedule tailored to weaker subjects |
| 📖 **Study Guides & Summaries** | AI-generated short summaries, revision notes, exam notes, and 1-minute reviews |
| 💡 **Bloom's Taxonomy Questions** | AI-generated questions across all 6 cognitive levels |
| ✍️ **Assignment Submission** | Submit quiz answers via shareable assignment links |

### 🌐 Platform-Wide

| Feature | Description |
|---------|-------------|
| 🌍 **7-Language Support** | Full UI + AI output in English, Hindi, French, Spanish, German, Japanese, Chinese |
| 🌙 **Dark / Light Theme** | System-aware theme toggle with smooth transitions |
| 🔐 **Role-Based Access** | Teacher and Student roles with different dashboards and capabilities |
| 🔑 **Google OAuth + Email Auth** | Secure authentication via Supabase Auth |
| 💬 **Floating Study Assistant** | Global AI chat widget available on every page, context-aware of the active lesson |
| 📱 **Responsive Design** | Fully responsive UI optimized for desktop, tablet, and mobile |

---

## 🔄 Workflow Explanation

### Teacher Lesson Generation Flow

```
1️⃣  Teacher logs in → Navigates to "Generate Lesson"
2️⃣  Fills in: Subject, Grade, Topic, Duration, Language, Learning Objectives
3️⃣  System checks for:
    ├── Dify Workflow URL (from profile) → Calls Dify API (LLaMA 3 via OpenRouter)
    ├── Gemini API Key (from profile/env) → Falls back to Gemini 2.5 Flash
    └── No API configured → Uses built-in demo generator
4️⃣  AI generates: Lesson Plan (structured Markdown)
5️⃣  System then calls Gemini to generate:
    ├── Student Worksheet (Markdown)
    ├── Practice Quiz (JSON array of MCQ objects)
    └── Answer Key (Markdown)
6️⃣  All outputs saved to Supabase → Lesson appears in Library
7️⃣  Teacher can optionally generate:
    ├── Grading Rubric (JSON matrix)
    ├── Homework Assignment (Markdown)
    ├── Study Summaries, Question Banks, Bloom's Taxonomy, Teaching Suggestions
8️⃣  Teacher publishes lesson → Available in public Explore library
9️⃣  Teacher creates assignment link → Shares with students
```

### Student Study Flow

```
1️⃣  Student browses Explore library (no account needed to read)
2️⃣  Opens a lesson → Reads plan, worksheet, and study materials
3️⃣  Takes the interactive quiz → Answers auto-graded instantly
4️⃣  Score saved to student_progress → XP calculated, badges checked
5️⃣  Opens AI Tutor → Asks questions with full lesson context
6️⃣  Generates flashcards → Studies with flip cards, shuffle, and TTS
7️⃣  Views Progress Dashboard → Streaks, leaderboard, subject mastery chart
8️⃣  Generates AI Recommendations → Personalized revision topics
9️⃣  Generates Study Plan → Weekly schedule targeting weak subjects
```

---

## 🛠 Tech Stack

### Frontend

| Technology | Purpose |
|-----------|---------|
| [React 19](https://react.dev) | UI library with latest concurrent features |
| [TypeScript](https://typescriptlang.org) | Type-safe development |
| [TanStack Start](https://tanstack.com/start) | Full-stack React framework (SSR + Server Functions) |
| [TanStack Router](https://tanstack.com/router) | File-based type-safe routing |
| [TanStack Query](https://tanstack.com/query) | Async state management and caching |
| [Tailwind CSS 4](https://tailwindcss.com) | Utility-first CSS framework |
| [Radix UI](https://radix-ui.com) | Accessible, unstyled component primitives |
| [shadcn/ui](https://ui.shadcn.com) | Beautiful component library built on Radix |
| [Recharts](https://recharts.org) | Declarative charts for analytics dashboards |
| [Lucide React](https://lucide.dev) | Beautiful, consistent icon library |
| [jsPDF](https://github.com/parallax/jsPDF) | Client-side PDF generation and export |
| [Sonner](https://sonner.emilkowal.dev) | Elegant toast notifications |
| [Vite 7](https://vitejs.dev) | Lightning-fast build tool and dev server |
| [Zod](https://zod.dev) | Runtime schema validation |

### Backend & AI

| Technology | Purpose |
|-----------|---------|
| [Supabase](https://supabase.com) | Auth, PostgreSQL DB, Row Level Security, Realtime |
| [Google Gemini 2.5 Flash](https://ai.google.dev) | Primary AI engine for content generation, tutoring, and recommendations |
| [Dify](https://dify.ai) | Workflow orchestration engine for structured lesson plan generation |
| [OpenRouter](https://openrouter.ai) | Multi-model API gateway (LLaMA 3 via Dify) |

### Database Schema (Supabase PostgreSQL)

```mermaid
erDiagram
    profiles {
        uuid id PK
        text full_name
        text email
        text role
        text school
        text subject_specialty
        text webhook_url
    }

    lessons {
        uuid id PK
        uuid user_id FK
        text title
        text subject
        text grade
        text topic
        text duration
        text language
        text objectives
        text lesson_plan
        text worksheet
        text quiz
        text answer_key
        text rubric
        text homework
        text short_summary
        text revision_notes
        text exam_notes
        text one_minute_review
        text generated_questions
        text blooms_taxonomy
        text teaching_suggestions
        boolean is_published
        integer views_count
        integer shares_count
        timestamp created_at
    }

    lesson_versions {
        uuid id PK
        uuid lesson_id FK
        integer version_number
        jsonb snapshot
        uuid created_by FK
        timestamp created_at
    }

    student_progress {
        uuid id PK
        uuid student_id FK
        uuid lesson_id FK
        integer quiz_score
        integer quiz_total
        timestamp completed_at
    }

    badges {
        uuid id PK
        uuid student_id FK
        text badge_type
        timestamp awarded_at
    }

    assignments {
        uuid id PK
        uuid lesson_id FK
        uuid teacher_id FK
        text title
        timestamp due_date
        timestamp created_at
    }

    submissions {
        uuid id PK
        uuid assignment_id FK
        uuid student_id FK
        text answers
        integer score
        text status
        text feedback
        timestamp submitted_at
    }

    tutor_chats {
        uuid id PK
        uuid student_id FK
        uuid lesson_id FK
        text message
        text response
        timestamp created_at
    }

    learning_recommendations {
        uuid id PK
        uuid student_id FK
        text recommendations
        timestamp updated_at
    }

    study_plans {
        uuid id PK
        uuid student_id FK
        text schedule
        timestamp updated_at
    }

    profiles ||--o{ lessons : "creates"
    profiles ||--o{ student_progress : "tracks"
    profiles ||--o{ badges : "earns"
    profiles ||--o{ assignments : "creates"
    profiles ||--o{ submissions : "submits"
    profiles ||--o{ tutor_chats : "chats"
    lessons ||--o{ lesson_versions : "has versions"
    lessons ||--o{ student_progress : "studied"
    lessons ||--o{ assignments : "assigned"
    lessons ||--o{ tutor_chats : "discussed"
    assignments ||--o{ submissions : "receives"
```

---

## 🚀 Installation Steps

### Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- A **Supabase** project (free tier works)
- A **Google Gemini API Key** (free tier available at [ai.google.dev](https://ai.google.dev))
- *(Optional)* A **Dify** account with the workflow imported

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/techflow-ai.git
cd techflow-ai
```

### 2. Install Dependencies

```bash
cd Frontend
npm install
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your actual values (see [Environment Variables](#-environment-variables) below).

### 4. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the database migrations (SQL files) to create the required tables:
   - `profiles`, `lessons`, `lesson_versions`, `student_progress`, `badges`, `assignments`, `submissions`, `tutor_chats`, `learning_recommendations`, `study_plans`
3. Enable **Google OAuth** in Supabase Auth settings
4. Configure Row Level Security (RLS) policies for each table

### 5. Import the Dify Workflow *(Optional)*

1. Sign up at [dify.ai](https://dify.ai)
2. Import the workflow file: `Backend/TechFlow AI.yml`
3. Configure the OpenRouter API key in Dify
4. Copy the workflow API URL to your profile settings in the app

### 6. Start the Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### 7. Build for Production

```bash
npm run build
npm run preview
```

---

## 🔐 Environment Variables

Create a `.env` file in the `Frontend/` directory based on the `.env.example` template:

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | ✅ | Your Supabase anon/public key |
| `SUPABASE_URL` | ✅ | Supabase URL for server-side operations |
| `SUPABASE_PUBLISHABLE_KEY` | ✅ | Supabase key for server-side operations |
| `SUPABASE_SERVICE_ROLE_KEY` | ⚠️ | Service role key (for admin operations) |
| `VITE_GEMINI_API_KEY` | ⚠️ | Google Gemini API key (fallback; users can also set via Profile) |
| `VITE_DIFY_API_KEY` | ❌ | Dify workflow API key (optional) |
| `VITE_DIFY_API_URL` | ❌ | Dify API base URL (default: `https://api.dify.ai/v1`) |

> **Note:** Users can configure their own Gemini API key and Dify Webhook URL from their Profile page. The environment variables serve as defaults/fallbacks.

---

## 📸 Screenshots

### Landing Page
![Landing Page](Screenshort/Frontend%20-%20Webpage.PNG)

### Login (Google OAuth + Email)
![Login](Screenshort/Frontent-Login.PNG)

### Teacher Dashboard
![Dashboard](Screenshort/Frontend%20-%20Dashboard.PNG)

### AI-Generated Lesson Kit
![Lesson Kit](Screenshort/Frontend%20-%20Autogenerated%20Lesson%20Kit.PNG)

### AI-Generated Lesson Plan
![Lesson Plan](Screenshort/Frontend%20-%20Autogenerated%20Lesson%20Plan.PNG)

### Dify AI Workflow
![Workflow](Screenshort/Workflow%20-%20TechFlow%20AI.PNG)

### Database Schema Visualizer
![Database Schema](Screenshort/Database%20-%20Schema%20Visualizer.PNG)

### Database Tables
![Database Tables](Screenshort/Database%20-%20Table.PNG)

### Google OAuth Configuration
![OAuth](Screenshort/OAuth%20-%20Google%20Cloud.PNG)

---

## 🗺 Future Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| 🔜 **v2.1** | Real-time collaborative lesson editing (multiplayer) | 🔲 Planned |
| 🔜 **v2.1** | AI-powered differentiated instruction (IEP/504 accommodations) | 🔲 Planned |
| 🔜 **v2.2** | Voice-to-lesson: speak your lesson idea, AI builds the kit | 🔲 Planned |
| 🔜 **v2.2** | Student notebook / annotation system | 🔲 Planned |
| 🔜 **v2.3** | Parent portal with progress reports | 🔲 Planned |
| 🔜 **v2.3** | LMS integrations (Google Classroom, Canvas, Moodle) | 🔲 Planned |
| 🔜 **v3.0** | AI-generated video explanations per lesson | 🔲 Planned |
| 🔜 **v3.0** | Mobile apps (iOS + Android via React Native) | 🔲 Planned |
| 🔜 **v3.1** | Multi-tenant school/organization management | 🔲 Planned |
| 🔜 **v3.1** | Advanced analytics with predictive student performance | 🔲 Planned |
| 🔜 **v3.2** | Marketplace for teachers to sell premium lesson kits | 🔲 Planned |
| ✅ **v1.0** | Full lesson kit generation (Plan + Worksheet + Quiz + Answer Key) | ✅ Done |
| ✅ **v1.0** | 7-language support with full UI localization | ✅ Done |
| ✅ **v1.0** | Student progress tracking, badges, and leaderboard | ✅ Done |
| ✅ **v1.0** | AI Tutor with lesson-context awareness | ✅ Done |
| ✅ **v1.0** | AI Flashcard generator | ✅ Done |
| ✅ **v1.0** | Teacher analytics dashboard | ✅ Done |
| ✅ **v1.0** | Class progress & assignment management | ✅ Done |
| ✅ **v1.0** | Version history with snapshot & restore | ✅ Done |
| ✅ **v1.0** | PDF export (single section + full kit) | ✅ Done |
| ✅ **v1.0** | AI Rubric & Homework generator | ✅ Done |
| ✅ **v1.0** | AI Study Recommendations & Study Plan | ✅ Done |
| ✅ **v1.0** | Bloom's Taxonomy question generator | ✅ Done |

---

## 🚀 Live Demo

> 🔗 **Live URL:** *Coming soon — deployment in progress*
>
> The app can be self-hosted on any platform that supports Node.js (Vercel, Cloudflare Pages, Railway, etc.)

---

## 👨‍💻 Creator Information

<table>
  <tr>
    <td align="center">
      <strong>Built with ❤️ as a portfolio project</strong>
      <br />
      <em>Full-stack AI SaaS showcasing modern web development,<br />AI integration, and educational technology.</em>
    </td>
  </tr>
</table>

**Key Skills Demonstrated:**
- 🧠 AI/LLM Integration (Gemini, Dify, OpenRouter)
- ⚛️ Modern React 19 with TanStack ecosystem
- 🗄️ Full-stack Supabase (Auth, DB, RLS, Realtime)
- 🎨 Production-quality UI/UX with Tailwind CSS + shadcn/ui
- 🌍 Internationalization (7 languages, full UI + AI output)
- 📊 Data visualization with Recharts
- 🎮 Gamification systems (XP, streaks, badges, leaderboards)
- 📄 Client-side PDF generation with jsPDF

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2025 TechFlow AI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

<p align="center">
  <strong>⭐ If you found this project helpful, please consider giving it a star!</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Made_with-TanStack_Start-FF4154?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Powered_by-Gemini_AI-4285F4?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Built_on-Supabase-3FCF8E?style=for-the-badge" />
</p>
