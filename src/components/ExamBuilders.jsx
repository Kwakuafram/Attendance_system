import { useState, useRef } from "react";
import {
  SECTION_TYPES,
  PRESCHOOL_ACTIVITY_TYPES,
  createBlankQuestion,
} from "../services/examService";

// ═══════════════════════════════════════════════
// MCQ Builder
// ═══════════════════════════════════════════════

export function MCQBuilder({ questions, onChange }) {
  function updateQ(idx, field, value) {
    const next = questions.map((q, i) =>
      i === idx ? { ...q, [field]: value } : q
    );
    onChange(next);
  }

  function updateOption(qIdx, optIdx, value) {
    const next = questions.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = [...q.options];
      opts[optIdx] = value;
      return { ...q, options: opts };
    });
    onChange(next);
  }

  function addQuestion() {
    onChange([...questions, createBlankQuestion(SECTION_TYPES.MCQ, questions.length + 1)]);
  }

  function removeQuestion(idx) {
    if (questions.length <= 1) return;
    onChange(questions.filter((_, i) => i !== idx).map((q, i) => ({ ...q, questionNumber: i + 1 })));
  }

  return (
    <div className="space-y-4">
      {questions.map((q, idx) => (
        <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-slate-700">Q{q.questionNumber || idx + 1}</span>
            {questions.length > 1 && (
              <button type="button" onClick={() => removeQuestion(idx)} className="text-xs text-red-500 hover:underline">Remove</button>
            )}
          </div>
          <input
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-fuchsia-400"
            placeholder="Enter question..."
            value={q.question}
            onChange={(e) => updateQ(idx, "question", e.target.value)}
          />
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(q.options || []).map((opt, optIdx) => (
              <div key={optIdx} className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 w-4">{String.fromCharCode(65 + optIdx)}.</span>
                <input
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-fuchsia-400"
                  placeholder={`Option ${String.fromCharCode(65 + optIdx)}`}
                  value={opt}
                  onChange={(e) => updateOption(idx, optIdx, e.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <label className="text-xs font-medium text-slate-600">Correct answer:</label>
            <select
              value={q.answer}
              onChange={(e) => updateQ(idx, "answer", e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-fuchsia-400"
            >
              <option value="">Select</option>
              {(q.options || []).map((opt, optIdx) => (
                <option key={optIdx} value={opt || String.fromCharCode(65 + optIdx)}>
                  {String.fromCharCode(65 + optIdx)}{opt ? ` – ${opt.substring(0, 30)}` : ""}
                </option>
              ))}
            </select>
            <label className="text-xs font-medium text-slate-600 ml-auto">Marks:</label>
            <input
              type="number" min="1" max="10"
              className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-sm text-center outline-none focus:border-fuchsia-400"
              value={q.marks}
              onChange={(e) => updateQ(idx, "marks", Number(e.target.value))}
            />
          </div>
        </div>
      ))}
      <button type="button" onClick={addQuestion} className="rounded-lg border border-dashed border-fuchsia-300 bg-fuchsia-50 px-4 py-2 text-sm font-semibold text-fuchsia-700 hover:bg-fuchsia-100">
        + Add Question
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Composition Builder
// ═══════════════════════════════════════════════

export function CompositionBuilder({ questions, onChange }) {
  const q = questions[0] || { prompt: "", instructions: "", marks: 20 };

  function update(field, value) {
    onChange([{ ...q, [field]: value }]);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div>
        <label className="text-sm font-medium text-slate-700">Essay Prompt / Topic</label>
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-fuchsia-400"
          rows={3}
          placeholder='e.g., Write a letter to your friend describing your last vacation.'
          value={q.prompt}
          onChange={(e) => update("prompt", e.target.value)}
        />
      </div>
      <div>
        <label className="text-sm font-medium text-slate-700">Instructions (optional)</label>
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-fuchsia-400"
          rows={2}
          placeholder="e.g., Your letter should be at least 150 words."
          value={q.instructions}
          onChange={(e) => update("instructions", e.target.value)}
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="text-xs font-medium text-slate-600">Total Marks:</label>
        <input
          type="number" min="1" max="100"
          className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm text-center outline-none focus:border-fuchsia-400"
          value={q.marks}
          onChange={(e) => update("marks", Number(e.target.value))}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Comprehension Builder
// ═══════════════════════════════════════════════

export function ComprehensionBuilder({ questions, onChange }) {
  const q = questions[0] || { passage: "", questions: [] };

  function updatePassage(value) {
    onChange([{ ...q, passage: value }]);
  }

  function updateSubQ(idx, field, value) {
    const subs = (q.questions || []).map((sq, i) =>
      i === idx ? { ...sq, [field]: value } : sq
    );
    onChange([{ ...q, questions: subs }]);
  }

  function addSubQ() {
    const subs = [...(q.questions || []), { questionNumber: (q.questions || []).length + 1, question: "", answer: "", marks: 2 }];
    onChange([{ ...q, questions: subs }]);
  }

  function removeSubQ(idx) {
    if ((q.questions || []).length <= 1) return;
    const subs = (q.questions || []).filter((_, i) => i !== idx).map((sq, i) => ({ ...sq, questionNumber: i + 1 }));
    onChange([{ ...q, questions: subs }]);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
      <div>
        <label className="text-sm font-medium text-slate-700">Passage / Reading Text</label>
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-fuchsia-400"
          rows={6}
          placeholder="Paste or type the comprehension passage here..."
          value={q.passage}
          onChange={(e) => updatePassage(e.target.value)}
        />
      </div>
      <div className="space-y-3">
        <label className="text-sm font-semibold text-slate-700">Questions on the passage</label>
        {(q.questions || []).map((sq, idx) => (
          <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-600">Q{sq.questionNumber || idx + 1}</span>
              {(q.questions || []).length > 1 && (
                <button type="button" onClick={() => removeSubQ(idx)} className="text-xs text-red-500 hover:underline">Remove</button>
              )}
            </div>
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-fuchsia-400"
              placeholder="Enter question..."
              value={sq.question}
              onChange={(e) => updateSubQ(idx, "question", e.target.value)}
            />
            <div className="mt-1 flex items-center gap-3">
              <input
                className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-fuchsia-400"
                placeholder="Expected answer (optional)"
                value={sq.answer}
                onChange={(e) => updateSubQ(idx, "answer", e.target.value)}
              />
              <label className="text-xs text-slate-500">Marks:</label>
              <input
                type="number" min="1" max="20"
                className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-sm text-center outline-none focus:border-fuchsia-400"
                value={sq.marks}
                onChange={(e) => updateSubQ(idx, "marks", Number(e.target.value))}
              />
            </div>
          </div>
        ))}
        <button type="button" onClick={addSubQ} className="rounded-lg border border-dashed border-fuchsia-300 bg-fuchsia-50 px-4 py-2 text-sm font-semibold text-fuchsia-700 hover:bg-fuchsia-100">
          + Add Question
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Preschool Visual Assets
// ═══════════════════════════════════════════════

// SVG outline shapes for colouring (stroke only, no fill)
const SHAPE_SVGS = {
  Circle: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <circle cx="40" cy="40" r="35" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  Square: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <rect x="8" y="8" width="64" height="64" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  Triangle: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <polygon points="40,6 74,74 6,74" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  Rectangle: (
    <svg viewBox="0 0 100 60" className="w-20 h-12">
      <rect x="4" y="4" width="92" height="52" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  Star: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <polygon points="40,6 50,30 76,30 56,46 64,72 40,56 16,72 24,46 4,30 30,30" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  Heart: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <path d="M40 70 C20 50 4 36 4 24 C4 12 14 4 24 4 C32 4 38 10 40 16 C42 10 48 4 56 4 C66 4 76 12 76 24 C76 36 60 50 40 70Z" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  Diamond: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <polygon points="40,4 76,40 40,76 4,40" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  Oval: (
    <svg viewBox="0 0 100 60" className="w-20 h-12">
      <ellipse cx="50" cy="30" rx="44" ry="26" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  Crescent: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <path d="M50 8 A32 32 0 1 0 50 72 A24 24 0 1 1 50 8" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  Cross: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <polygon points="30,4 50,4 50,30 76,30 76,50 50,50 50,76 30,76 30,50 4,50 4,30 30,30" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  Hexagon: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <polygon points="40,4 72,20 72,60 40,76 8,60 8,20" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
  Arrow: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <polygon points="40,4 76,44 56,44 56,76 24,76 24,44 4,44" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
};

// SVG outlines for animals, fruits, etc. (coloring-book style: stroke only, no fill)
const OUTLINE_SVGS = {
  // ── Animals ──
  Cat: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <path d="M16 28 L22 10 L30 24 M50 24 L58 10 L64 28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <ellipse cx="40" cy="46" rx="22" ry="20" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="32" cy="40" r="2.5" fill="currentColor"/>
      <circle cx="48" cy="40" r="2.5" fill="currentColor"/>
      <ellipse cx="40" cy="48" rx="3" ry="2" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="18" y1="44" x2="30" y2="46" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="18" y1="48" x2="30" y2="48" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="50" y1="46" x2="62" y2="44" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="50" y1="48" x2="62" y2="48" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M40 66 Q40 74 46 74" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  Dog: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <path d="M14 30 Q10 12 22 18 Q28 20 28 30" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M52 30 Q52 20 58 18 Q70 12 66 30" fill="none" stroke="currentColor" strokeWidth="2"/>
      <ellipse cx="40" cy="44" rx="24" ry="20" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="32" cy="38" r="2.5" fill="currentColor"/>
      <circle cx="48" cy="38" r="2.5" fill="currentColor"/>
      <ellipse cx="40" cy="48" rx="6" ry="4" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="40" cy="46" r="2" fill="currentColor"/>
      <path d="M36 54 Q40 58 44 54" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Fish: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <path d="M62 40 Q50 18 28 20 Q8 22 8 40 Q8 58 28 60 Q50 62 62 40Z" fill="none" stroke="currentColor" strokeWidth="2"/>
      <polygon points="62,40 76,28 76,52" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="22" cy="38" r="3" fill="currentColor"/>
      <path d="M18 46 Q24 50 32 46" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M34 30 Q38 40 34 50" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2"/>
    </svg>
  ),
  Bird: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <ellipse cx="40" cy="44" rx="18" ry="14" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="40" cy="26" r="12" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="44" cy="24" r="2" fill="currentColor"/>
      <polygon points="52,26 62,24 52,28" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M24 38 Q10 30 8 44" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <line x1="34" y1="58" x2="34" y2="70" stroke="currentColor" strokeWidth="2"/>
      <line x1="46" y1="58" x2="46" y2="70" stroke="currentColor" strokeWidth="2"/>
      <line x1="30" y1="70" x2="38" y2="70" stroke="currentColor" strokeWidth="2"/>
      <line x1="42" y1="70" x2="50" y2="70" stroke="currentColor" strokeWidth="2"/>
    </svg>
  ),
  Chicken: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <ellipse cx="40" cy="48" rx="20" ry="16" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="40" cy="24" r="12" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M36 14 Q40 4 44 14" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="44" cy="22" r="2" fill="currentColor"/>
      <polygon points="52,26 62,28 52,30" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M52,30 Q56,36 52,34" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="34" y1="64" x2="34" y2="74" stroke="currentColor" strokeWidth="2"/>
      <line x1="46" y1="64" x2="46" y2="74" stroke="currentColor" strokeWidth="2"/>
    </svg>
  ),
  Cow: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <ellipse cx="40" cy="42" rx="26" ry="18" fill="none" stroke="currentColor" strokeWidth="2"/>
      <ellipse cx="40" cy="24" rx="14" ry="10" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M26 18 L18 8 L24 16" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M54 18 L62 8 L56 16" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="34" cy="22" r="2" fill="currentColor"/>
      <circle cx="46" cy="22" r="2" fill="currentColor"/>
      <ellipse cx="40" cy="30" rx="6" ry="3" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="26" y1="60" x2="26" y2="72" stroke="currentColor" strokeWidth="2"/>
      <line x1="36" y1="60" x2="36" y2="72" stroke="currentColor" strokeWidth="2"/>
      <line x1="44" y1="60" x2="44" y2="72" stroke="currentColor" strokeWidth="2"/>
      <line x1="54" y1="60" x2="54" y2="72" stroke="currentColor" strokeWidth="2"/>
    </svg>
  ),
  Goat: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <ellipse cx="40" cy="44" rx="22" ry="16" fill="none" stroke="currentColor" strokeWidth="2"/>
      <ellipse cx="40" cy="24" rx="12" ry="10" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M32 16 L26 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M48 16 L54 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="35" cy="22" r="2" fill="currentColor"/>
      <circle cx="45" cy="22" r="2" fill="currentColor"/>
      <path d="M38 30 Q40 34 42 30" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="28" y1="60" x2="28" y2="72" stroke="currentColor" strokeWidth="2"/>
      <line x1="38" y1="60" x2="38" y2="72" stroke="currentColor" strokeWidth="2"/>
      <line x1="42" y1="60" x2="42" y2="72" stroke="currentColor" strokeWidth="2"/>
      <line x1="52" y1="60" x2="52" y2="72" stroke="currentColor" strokeWidth="2"/>
    </svg>
  ),
  Sheep: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <path d="M14 44 Q14 26 28 24 Q32 18 40 18 Q48 18 52 24 Q66 26 66 44 Q66 58 40 58 Q14 58 14 44Z" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="20" cy="36" r="4" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="30" cy="30" r="4" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="40" cy="28" r="4" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="50" cy="30" r="4" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="60" cy="36" r="4" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="34" cy="44" r="2" fill="currentColor"/>
      <circle cx="46" cy="44" r="2" fill="currentColor"/>
      <line x1="28" y1="58" x2="28" y2="70" stroke="currentColor" strokeWidth="2"/>
      <line x1="52" y1="58" x2="52" y2="70" stroke="currentColor" strokeWidth="2"/>
    </svg>
  ),
  Rabbit: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <ellipse cx="40" cy="52" rx="18" ry="16" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="40" cy="32" r="14" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M32 20 Q30 2 28 2 Q24 2 28 20" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M48 20 Q50 2 52 2 Q56 2 52 20" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="35" cy="30" r="2" fill="currentColor"/>
      <circle cx="45" cy="30" r="2" fill="currentColor"/>
      <ellipse cx="40" cy="36" rx="2.5" ry="2" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="30" y1="34" x2="20" y2="32" stroke="currentColor" strokeWidth="1"/>
      <line x1="30" y1="36" x2="20" y2="38" stroke="currentColor" strokeWidth="1"/>
      <line x1="50" y1="34" x2="60" y2="32" stroke="currentColor" strokeWidth="1"/>
      <line x1="50" y1="36" x2="60" y2="38" stroke="currentColor" strokeWidth="1"/>
    </svg>
  ),
  Lion: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <circle cx="40" cy="40" r="28" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="40" cy="42" r="16" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="34" cy="38" r="2.5" fill="currentColor"/>
      <circle cx="46" cy="38" r="2.5" fill="currentColor"/>
      <ellipse cx="40" cy="44" rx="4" ry="2.5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M36 50 Q40 54 44 50" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 40 Q16 36 14 32 M14 32 Q20 36 18 28 M18 28 Q24 34 24 24 M24 24 Q30 32 32 22" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M68 40 Q64 36 66 32 M66 32 Q60 36 62 28 M62 28 Q56 34 56 24 M56 24 Q50 32 48 22" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  ),
  Elephant: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <ellipse cx="40" cy="40" rx="26" ry="22" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M14 36 Q6 36 6 28 Q6 20 14 24" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M66 36 Q74 36 74 28 Q74 20 66 24" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="26" cy="34" r="2.5" fill="currentColor"/>
      <circle cx="54" cy="34" r="2.5" fill="currentColor"/>
      <path d="M40 42 Q38 52 34 60 Q36 62 40 60 Q42 58 40 42" fill="none" stroke="currentColor" strokeWidth="2"/>
      <line x1="24" y1="62" x2="24" y2="74" stroke="currentColor" strokeWidth="3"/>
      <line x1="36" y1="62" x2="36" y2="74" stroke="currentColor" strokeWidth="3"/>
      <line x1="44" y1="62" x2="44" y2="74" stroke="currentColor" strokeWidth="3"/>
      <line x1="56" y1="62" x2="56" y2="74" stroke="currentColor" strokeWidth="3"/>
    </svg>
  ),
  Butterfly: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <line x1="40" y1="16" x2="40" y2="68" stroke="currentColor" strokeWidth="2"/>
      <path d="M40 30 Q20 10 10 24 Q4 36 20 40 Q4 44 10 56 Q20 70 40 50" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M40 30 Q60 10 70 24 Q76 36 60 40 Q76 44 70 56 Q60 70 40 50" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="18" cy="30" r="3" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="62" cy="30" r="3" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="18" cy="50" r="3" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="62" cy="50" r="3" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M36 16 Q32 6 28 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M44 16 Q48 6 52 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  // ── Fruits ──
  Apple: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <path d="M40 18 Q22 18 16 36 Q10 54 24 66 Q34 74 40 74 Q46 74 56 66 Q70 54 64 36 Q58 18 40 18Z" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M40 18 Q40 8 46 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M44 10 Q50 14 52 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  Orange: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <circle cx="40" cy="44" r="26" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M40 18 Q40 12 44 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M42 14 Q48 16 50 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="40" cy="44" r="4" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2,2"/>
    </svg>
  ),
  Banana: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <path d="M20 16 Q16 16 18 24 Q22 50 40 64 Q58 76 68 68 Q72 64 66 62 Q52 58 38 44 Q26 30 24 16 Q24 14 20 16Z" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M20 16 Q18 12 22 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  Mango: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <path d="M40 12 Q20 16 14 40 Q10 58 28 70 Q40 76 52 70 Q70 58 66 40 Q60 16 40 12Z" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M40 12 Q40 4 44 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  Pineapple: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <ellipse cx="40" cy="50" rx="18" ry="24" fill="none" stroke="currentColor" strokeWidth="2"/>
      <line x1="22" y1="42" x2="58" y2="42" stroke="currentColor" strokeWidth="1" strokeDasharray="3,3"/>
      <line x1="22" y1="50" x2="58" y2="50" stroke="currentColor" strokeWidth="1" strokeDasharray="3,3"/>
      <line x1="22" y1="58" x2="58" y2="58" stroke="currentColor" strokeWidth="1" strokeDasharray="3,3"/>
      <path d="M34 26 Q30 12 26 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M40 26 Q40 10 40 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M46 26 Q50 12 54 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  Watermelon: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <path d="M10 50 Q10 10 50 10 Q70 10 70 50 Z" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M16 48 Q16 18 48 16 Q64 16 64 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3,3"/>
      <circle cx="30" cy="34" r="2" fill="currentColor"/>
      <circle cx="42" cy="28" r="2" fill="currentColor"/>
      <circle cx="36" cy="42" r="2" fill="currentColor"/>
      <circle cx="50" cy="38" r="2" fill="currentColor"/>
      <circle cx="26" cy="44" r="2" fill="currentColor"/>
    </svg>
  ),
  Grapes: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <circle cx="32" cy="30" r="8" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="48" cy="30" r="8" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="24" cy="44" r="8" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="40" cy="44" r="8" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="56" cy="44" r="8" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="32" cy="58" r="8" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="48" cy="58" r="8" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="40" cy="70" r="8" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M40 22 Q40 10 46 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  Lemon: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <path d="M20 40 Q20 20 40 16 Q60 12 66 32 Q72 52 52 60 Q32 68 20 40Z" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M18 40 Q14 38 12 36" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M66 32 Q70 28 72 28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  Pear: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <path d="M40 74 Q20 74 16 54 Q12 38 30 30 Q34 22 34 14 Q34 10 40 10 Q46 10 46 14 Q46 22 50 30 Q68 38 64 54 Q60 74 40 74Z" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M40 10 Q40 4 44 2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  Strawberry: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <path d="M40 20 Q22 24 18 44 Q14 64 40 74 Q66 64 62 44 Q58 24 40 20Z" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M30 18 Q34 14 40 20 Q46 14 50 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M40 20 Q40 12 42 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="34" cy="36" r="1.5" fill="currentColor"/>
      <circle cx="46" cy="36" r="1.5" fill="currentColor"/>
      <circle cx="40" cy="46" r="1.5" fill="currentColor"/>
      <circle cx="32" cy="50" r="1.5" fill="currentColor"/>
      <circle cx="48" cy="50" r="1.5" fill="currentColor"/>
      <circle cx="40" cy="60" r="1.5" fill="currentColor"/>
    </svg>
  ),
  Coconut: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <path d="M12 44 Q12 24 40 24 Q68 24 68 44 Q68 68 40 68 Q12 68 12 44Z" fill="none" stroke="currentColor" strokeWidth="2"/>
      <circle cx="30" cy="40" r="3" fill="currentColor"/>
      <circle cx="50" cy="40" r="3" fill="currentColor"/>
      <circle cx="40" cy="50" r="3" fill="currentColor"/>
      <path d="M26 24 Q20 14 24 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M40 24 Q42 12 48 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M54 24 Q60 14 56 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  Pawpaw: (
    <svg viewBox="0 0 80 80" className="w-16 h-16">
      <ellipse cx="40" cy="44" rx="20" ry="28" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M40 16 Q40 8 44 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="36" cy="40" r="2" fill="currentColor"/>
      <circle cx="44" cy="40" r="2" fill="currentColor"/>
      <circle cx="40" cy="48" r="2" fill="currentColor"/>
      <circle cx="36" cy="52" r="2" fill="currentColor"/>
      <circle cx="44" cy="52" r="2" fill="currentColor"/>
    </svg>
  ),
};

// Combined lookup: shapes + animals/fruits outlines (React JSX)
const ALL_OUTLINE_SVGS = { ...SHAPE_SVGS, ...OUTLINE_SVGS };

// String SVGs for print window (shapes already existed, adding animals/fruits)
const PRINT_OUTLINE_SVGS = {
  // Shapes
  Circle: '<svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="35" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  Square: '<svg viewBox="0 0 80 80"><rect x="8" y="8" width="64" height="64" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  Triangle: '<svg viewBox="0 0 80 80"><polygon points="40,6 74,74 6,74" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  Rectangle: '<svg viewBox="0 0 100 60"><rect x="4" y="4" width="92" height="52" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  Star: '<svg viewBox="0 0 80 80"><polygon points="40,6 50,30 76,30 56,46 64,72 40,56 16,72 24,46 4,30 30,30" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  Heart: '<svg viewBox="0 0 80 80"><path d="M40 70 C20 50 4 36 4 24 C4 12 14 4 24 4 C32 4 38 10 40 16 C42 10 48 4 56 4 C66 4 76 12 76 24 C76 36 60 50 40 70Z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  Diamond: '<svg viewBox="0 0 80 80"><polygon points="40,4 76,40 40,76 4,40" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  Oval: '<svg viewBox="0 0 100 60"><ellipse cx="50" cy="30" rx="44" ry="26" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  Crescent: '<svg viewBox="0 0 80 80"><path d="M50 8 A32 32 0 1 0 50 72 A24 24 0 1 1 50 8" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  Cross: '<svg viewBox="0 0 80 80"><polygon points="30,4 50,4 50,30 76,30 76,50 50,50 50,76 30,76 30,50 4,50 4,30 30,30" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  Hexagon: '<svg viewBox="0 0 80 80"><polygon points="40,4 72,20 72,60 40,76 8,60 8,20" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  Arrow: '<svg viewBox="0 0 80 80"><polygon points="40,4 76,44 56,44 56,76 24,76 24,44 4,44" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  // Animals
  Cat: '<svg viewBox="0 0 80 80"><path d="M16 28 L22 10 L30 24 M50 24 L58 10 L64 28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><ellipse cx="40" cy="46" rx="22" ry="20" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="32" cy="40" r="2.5" fill="currentColor"/><circle cx="48" cy="40" r="2.5" fill="currentColor"/><ellipse cx="40" cy="48" rx="3" ry="2" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="18" y1="44" x2="30" y2="46" stroke="currentColor" stroke-width="1.2"/><line x1="18" y1="48" x2="30" y2="48" stroke="currentColor" stroke-width="1.2"/><line x1="50" y1="46" x2="62" y2="44" stroke="currentColor" stroke-width="1.2"/><line x1="50" y1="48" x2="62" y2="48" stroke="currentColor" stroke-width="1.2"/><path d="M40 66 Q40 74 46 74" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  Dog: '<svg viewBox="0 0 80 80"><path d="M14 30 Q10 12 22 18 Q28 20 28 30" fill="none" stroke="currentColor" stroke-width="2"/><path d="M52 30 Q52 20 58 18 Q70 12 66 30" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="40" cy="44" rx="24" ry="20" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="32" cy="38" r="2.5" fill="currentColor"/><circle cx="48" cy="38" r="2.5" fill="currentColor"/><ellipse cx="40" cy="48" rx="6" ry="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="40" cy="46" r="2" fill="currentColor"/><path d="M36 54 Q40 58 44 54" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  Fish: '<svg viewBox="0 0 80 80"><path d="M62 40 Q50 18 28 20 Q8 22 8 40 Q8 58 28 60 Q50 62 62 40Z" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="62,40 76,28 76,52" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="22" cy="38" r="3" fill="currentColor"/><path d="M18 46 Q24 50 32 46" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  Bird: '<svg viewBox="0 0 80 80"><ellipse cx="40" cy="44" rx="18" ry="14" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="40" cy="26" r="12" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="44" cy="24" r="2" fill="currentColor"/><polygon points="52,26 62,24 52,28" fill="none" stroke="currentColor" stroke-width="2"/><path d="M24 38 Q10 30 8 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="34" y1="58" x2="34" y2="70" stroke="currentColor" stroke-width="2"/><line x1="46" y1="58" x2="46" y2="70" stroke="currentColor" stroke-width="2"/><line x1="30" y1="70" x2="38" y2="70" stroke="currentColor" stroke-width="2"/><line x1="42" y1="70" x2="50" y2="70" stroke="currentColor" stroke-width="2"/></svg>',
  Chicken: '<svg viewBox="0 0 80 80"><ellipse cx="40" cy="48" rx="20" ry="16" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="40" cy="24" r="12" fill="none" stroke="currentColor" stroke-width="2"/><path d="M36 14 Q40 4 44 14" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="44" cy="22" r="2" fill="currentColor"/><polygon points="52,26 62,28 52,30" fill="none" stroke="currentColor" stroke-width="2"/><line x1="34" y1="64" x2="34" y2="74" stroke="currentColor" stroke-width="2"/><line x1="46" y1="64" x2="46" y2="74" stroke="currentColor" stroke-width="2"/></svg>',
  Cow: '<svg viewBox="0 0 80 80"><ellipse cx="40" cy="42" rx="26" ry="18" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="40" cy="24" rx="14" ry="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M26 18 L18 8 L24 16" fill="none" stroke="currentColor" stroke-width="2"/><path d="M54 18 L62 8 L56 16" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="34" cy="22" r="2" fill="currentColor"/><circle cx="46" cy="22" r="2" fill="currentColor"/><ellipse cx="40" cy="30" rx="6" ry="3" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="26" y1="60" x2="26" y2="72" stroke="currentColor" stroke-width="2"/><line x1="36" y1="60" x2="36" y2="72" stroke="currentColor" stroke-width="2"/><line x1="44" y1="60" x2="44" y2="72" stroke="currentColor" stroke-width="2"/><line x1="54" y1="60" x2="54" y2="72" stroke="currentColor" stroke-width="2"/></svg>',
  Goat: '<svg viewBox="0 0 80 80"><ellipse cx="40" cy="44" rx="22" ry="16" fill="none" stroke="currentColor" stroke-width="2"/><ellipse cx="40" cy="24" rx="12" ry="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M32 16 L26 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M48 16 L54 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="35" cy="22" r="2" fill="currentColor"/><circle cx="45" cy="22" r="2" fill="currentColor"/><line x1="28" y1="60" x2="28" y2="72" stroke="currentColor" stroke-width="2"/><line x1="52" y1="60" x2="52" y2="72" stroke="currentColor" stroke-width="2"/></svg>',
  Sheep: '<svg viewBox="0 0 80 80"><path d="M14 44 Q14 26 28 24 Q32 18 40 18 Q48 18 52 24 Q66 26 66 44 Q66 58 40 58 Q14 58 14 44Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="20" cy="36" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="30" cy="30" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="40" cy="28" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="50" cy="30" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="60" cy="36" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="34" cy="44" r="2" fill="currentColor"/><circle cx="46" cy="44" r="2" fill="currentColor"/><line x1="28" y1="58" x2="28" y2="70" stroke="currentColor" stroke-width="2"/><line x1="52" y1="58" x2="52" y2="70" stroke="currentColor" stroke-width="2"/></svg>',
  Rabbit: '<svg viewBox="0 0 80 80"><ellipse cx="40" cy="52" rx="18" ry="16" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="40" cy="32" r="14" fill="none" stroke="currentColor" stroke-width="2"/><path d="M32 20 Q30 2 28 2 Q24 2 28 20" fill="none" stroke="currentColor" stroke-width="2"/><path d="M48 20 Q50 2 52 2 Q56 2 52 20" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="35" cy="30" r="2" fill="currentColor"/><circle cx="45" cy="30" r="2" fill="currentColor"/><ellipse cx="40" cy="36" rx="2.5" ry="2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  Lion: '<svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="28" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="40" cy="42" r="16" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="34" cy="38" r="2.5" fill="currentColor"/><circle cx="46" cy="38" r="2.5" fill="currentColor"/><ellipse cx="40" cy="44" rx="4" ry="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M36 50 Q40 54 44 50" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  Elephant: '<svg viewBox="0 0 80 80"><ellipse cx="40" cy="40" rx="26" ry="22" fill="none" stroke="currentColor" stroke-width="2"/><path d="M14 36 Q6 36 6 28 Q6 20 14 24" fill="none" stroke="currentColor" stroke-width="2"/><path d="M66 36 Q74 36 74 28 Q74 20 66 24" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="26" cy="34" r="2.5" fill="currentColor"/><circle cx="54" cy="34" r="2.5" fill="currentColor"/><path d="M40 42 Q38 52 34 60 Q36 62 40 60 Q42 58 40 42" fill="none" stroke="currentColor" stroke-width="2"/><line x1="24" y1="62" x2="24" y2="74" stroke="currentColor" stroke-width="3"/><line x1="36" y1="62" x2="36" y2="74" stroke="currentColor" stroke-width="3"/><line x1="44" y1="62" x2="44" y2="74" stroke="currentColor" stroke-width="3"/><line x1="56" y1="62" x2="56" y2="74" stroke="currentColor" stroke-width="3"/></svg>',
  Butterfly: '<svg viewBox="0 0 80 80"><line x1="40" y1="16" x2="40" y2="68" stroke="currentColor" stroke-width="2"/><path d="M40 30 Q20 10 10 24 Q4 36 20 40 Q4 44 10 56 Q20 70 40 50" fill="none" stroke="currentColor" stroke-width="2"/><path d="M40 30 Q60 10 70 24 Q76 36 60 40 Q76 44 70 56 Q60 70 40 50" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="18" cy="30" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="62" cy="30" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  // Fruits
  Apple: '<svg viewBox="0 0 80 80"><path d="M40 18 Q22 18 16 36 Q10 54 24 66 Q34 74 40 74 Q46 74 56 66 Q70 54 64 36 Q58 18 40 18Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M40 18 Q40 8 46 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M44 10 Q50 14 52 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  Orange: '<svg viewBox="0 0 80 80"><circle cx="40" cy="44" r="26" fill="none" stroke="currentColor" stroke-width="2"/><path d="M40 18 Q40 12 44 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M42 14 Q48 16 50 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  Banana: '<svg viewBox="0 0 80 80"><path d="M20 16 Q16 16 18 24 Q22 50 40 64 Q58 76 68 68 Q72 64 66 62 Q52 58 38 44 Q26 30 24 16 Q24 14 20 16Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 16 Q18 12 22 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  Mango: '<svg viewBox="0 0 80 80"><path d="M40 12 Q20 16 14 40 Q10 58 28 70 Q40 76 52 70 Q70 58 66 40 Q60 16 40 12Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M40 12 Q40 4 44 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  Pineapple: '<svg viewBox="0 0 80 80"><ellipse cx="40" cy="50" rx="18" ry="24" fill="none" stroke="currentColor" stroke-width="2"/><line x1="22" y1="42" x2="58" y2="42" stroke="currentColor" stroke-width="1" stroke-dasharray="3,3"/><line x1="22" y1="50" x2="58" y2="50" stroke="currentColor" stroke-width="1" stroke-dasharray="3,3"/><line x1="22" y1="58" x2="58" y2="58" stroke="currentColor" stroke-width="1" stroke-dasharray="3,3"/><path d="M34 26 Q30 12 26 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M40 26 Q40 10 40 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M46 26 Q50 12 54 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  Watermelon: '<svg viewBox="0 0 80 80"><path d="M10 50 Q10 10 50 10 Q70 10 70 50 Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="30" cy="34" r="2" fill="currentColor"/><circle cx="42" cy="28" r="2" fill="currentColor"/><circle cx="36" cy="42" r="2" fill="currentColor"/><circle cx="50" cy="38" r="2" fill="currentColor"/></svg>',
  Grapes: '<svg viewBox="0 0 80 80"><circle cx="32" cy="30" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="48" cy="30" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="24" cy="44" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="40" cy="44" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="56" cy="44" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="32" cy="58" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="48" cy="58" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="40" cy="70" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M40 22 Q40 10 46 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  Lemon: '<svg viewBox="0 0 80 80"><path d="M20 40 Q20 20 40 16 Q60 12 66 32 Q72 52 52 60 Q32 68 20 40Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M18 40 Q14 38 12 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  Pear: '<svg viewBox="0 0 80 80"><path d="M40 74 Q20 74 16 54 Q12 38 30 30 Q34 22 34 14 Q34 10 40 10 Q46 10 46 14 Q46 22 50 30 Q68 38 64 54 Q60 74 40 74Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M40 10 Q40 4 44 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  Strawberry: '<svg viewBox="0 0 80 80"><path d="M40 20 Q22 24 18 44 Q14 64 40 74 Q66 64 62 44 Q58 24 40 20Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M30 18 Q34 14 40 20 Q46 14 50 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="34" cy="36" r="1.5" fill="currentColor"/><circle cx="46" cy="36" r="1.5" fill="currentColor"/><circle cx="40" cy="46" r="1.5" fill="currentColor"/><circle cx="32" cy="50" r="1.5" fill="currentColor"/><circle cx="48" cy="50" r="1.5" fill="currentColor"/><circle cx="40" cy="60" r="1.5" fill="currentColor"/></svg>',
  Coconut: '<svg viewBox="0 0 80 80"><path d="M12 44 Q12 24 40 24 Q68 24 68 44 Q68 68 40 68 Q12 68 12 44Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="30" cy="40" r="3" fill="currentColor"/><circle cx="50" cy="40" r="3" fill="currentColor"/><circle cx="40" cy="50" r="3" fill="currentColor"/><path d="M26 24 Q20 14 24 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M40 24 Q42 12 48 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  Pawpaw: '<svg viewBox="0 0 80 80"><ellipse cx="40" cy="44" rx="20" ry="28" fill="none" stroke="currentColor" stroke-width="2"/><path d="M40 16 Q40 8 44 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="36" cy="40" r="2" fill="currentColor"/><circle cx="44" cy="40" r="2" fill="currentColor"/><circle cx="40" cy="48" r="2" fill="currentColor"/></svg>',
};

const PRESCHOOL_VISUALS = {
  Shapes: [
    { label: "Circle", icon: "○" },
    { label: "Square", icon: "□" },
    { label: "Triangle", icon: "△" },
    { label: "Rectangle", icon: "▭" },
    { label: "Star", icon: "☆" },
    { label: "Heart", icon: "♡" },
    { label: "Diamond", icon: "◇" },
    { label: "Oval", icon: "⬮" },
    { label: "Crescent", icon: "☽" },
    { label: "Arrow", icon: "⇧" },
    { label: "Cross", icon: "✚" },
    { label: "Hexagon", icon: "⬡" },
  ],
  Letters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((ch) => ({
    label: ch,
    icon: ch,
  })),
  "Small Letters": "abcdefghijklmnopqrstuvwxyz".split("").map((ch) => ({
    label: ch,
    icon: ch,
  })),
  Numbers: Array.from({ length: 21 }, (_, i) => ({
    label: String(i),
    icon: String(i),
  })),
  Fruits: [
    { label: "Apple", icon: "🍎" },
    { label: "Orange", icon: "🍊" },
    { label: "Banana", icon: "🍌" },
    { label: "Mango", icon: "🥭" },
    { label: "Pineapple", icon: "🍍" },
    { label: "Watermelon", icon: "🍉" },
    { label: "Grapes", icon: "🍇" },
    { label: "Lemon", icon: "🍋" },
    { label: "Pear", icon: "🍐" },
    { label: "Strawberry", icon: "🍓" },
    { label: "Coconut", icon: "🥥" },
    { label: "Pawpaw", icon: "🫒" },
  ],
  Animals: [
    { label: "Cat", icon: "🐱" },
    { label: "Dog", icon: "🐶" },
    { label: "Fish", icon: "🐟" },
    { label: "Bird", icon: "🐦" },
    { label: "Chicken", icon: "🐔" },
    { label: "Cow", icon: "🐄" },
    { label: "Goat", icon: "🐐" },
    { label: "Sheep", icon: "🐑" },
    { label: "Rabbit", icon: "🐰" },
    { label: "Lion", icon: "🦁" },
    { label: "Elephant", icon: "🐘" },
    { label: "Butterfly", icon: "🦋" },
  ],
  Colours: [
    { label: "Red", icon: "🔴" },
    { label: "Blue", icon: "🔵" },
    { label: "Green", icon: "🟢" },
    { label: "Yellow", icon: "🟡" },
    { label: "Orange", icon: "🟠" },
    { label: "Purple", icon: "🟣" },
    { label: "Black", icon: "⚫" },
    { label: "White", icon: "⚪" },
    { label: "Brown", icon: "🟤" },
    { label: "Pink", icon: "💗" },
  ],
};

const VISUAL_CATEGORIES = Object.keys(PRESCHOOL_VISUALS);

// Label → emoji lookup for all visual categories
const EMOJI_MAP = {};
for (const cat of Object.values(PRESCHOOL_VISUALS)) {
  for (const item of cat) {
    EMOJI_MAP[item.label] = item.icon;
  }
}

const ACTIVITY_TYPE_OPTIONS = [
  { value: PRESCHOOL_ACTIVITY_TYPES.COLOUR, label: "🎨 Colour", desc: "Pupils colour a shape or picture" },
  { value: PRESCHOOL_ACTIVITY_TYPES.TRACE, label: "✏️ Trace", desc: "Pupils trace dotted letters, numbers or words" },
  { value: PRESCHOOL_ACTIVITY_TYPES.BLANK_SPACE, label: "📝 Write / Scribble", desc: "Blank space for writing or drawing" },
  { value: PRESCHOOL_ACTIVITY_TYPES.IDENTIFY, label: "👁️ Identify", desc: "Pupils identify an object or image" },
  { value: PRESCHOOL_ACTIVITY_TYPES.MATCH, label: "🔗 Match", desc: "Pupils match items" },
];

// ═══════════════════════════════════════════════
// Match Pair Editor (used inside PreschoolActivityBuilder)
// ═══════════════════════════════════════════════

function MatchPairEditor({ pairs, onChange, pickerOpen, pickerKey, setPickerOpen, pickerCategory, setPickerCategory }) {
  function updatePair(idx, side, value) {
    const next = pairs.map((p, i) => (i === idx ? { ...p, [side]: value } : p));
    onChange(next);
  }

  function addPair() {
    onChange([...pairs, { left: "", right: "" }]);
  }

  function removePair(idx) {
    if (pairs.length <= 1) return;
    onChange(pairs.filter((_, i) => i !== idx));
  }

  function appendToPair(idx, side, label) {
    const current = pairs[idx]?.[side] || "";
    const sep = current.trim() ? ", " : "";
    updatePair(idx, side, current + sep + label);
  }

  const isOpen = pickerOpen?.startsWith(pickerKey);
  const openSide = isOpen ? pickerOpen.split(":")[1] : null;
  const openIdx = isOpen ? Number(pickerOpen.split(":")[2]) : -1;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="flex-1 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Left (items)</div>
        <div className="w-8" />
        <div className="flex-1 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Right (matches)</div>
        <div className="w-6" />
      </div>
      {pairs.map((pair, idx) => (
        <div key={idx} className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-fuchsia-400"
                placeholder="e.g., 🍎 Apple"
                value={pair.left}
                onChange={(e) => updatePair(idx, "left", e.target.value)}
              />
            </div>
            <span className="text-slate-400 text-lg">⟷</span>
            <div className="flex-1">
              <input
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-fuchsia-400"
                placeholder="e.g., Red"
                value={pair.right}
                onChange={(e) => updatePair(idx, "right", e.target.value)}
              />
            </div>
            {pairs.length > 1 && (
              <button type="button" onClick={() => removePair(idx)} className="text-xs text-red-500 hover:underline w-6">✕</button>
            )}
          </div>
          <div className="flex gap-2 justify-center">
            <button
              type="button"
              onClick={() => setPickerOpen(pickerOpen === `${pickerKey}:left:${idx}` ? null : `${pickerKey}:left:${idx}`)}
              className="text-[10px] font-semibold text-fuchsia-500 hover:text-fuchsia-700"
            >
              {pickerOpen === `${pickerKey}:left:${idx}` ? "Close ✕" : "⊕ Left"}
            </button>
            <button
              type="button"
              onClick={() => setPickerOpen(pickerOpen === `${pickerKey}:right:${idx}` ? null : `${pickerKey}:right:${idx}`)}
              className="text-[10px] font-semibold text-fuchsia-500 hover:text-fuchsia-700"
            >
              {pickerOpen === `${pickerKey}:right:${idx}` ? "Close ✕" : "⊕ Right"}
            </button>
          </div>
          {isOpen && openIdx === idx && (
            <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/50 p-2 space-y-2">
              <div className="flex flex-wrap gap-1">
                {VISUAL_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setPickerCategory(cat)}
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition ${
                      pickerCategory === cat
                        ? "bg-fuchsia-600 text-white"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-fuchsia-100"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                {(PRESCHOOL_VISUALS[pickerCategory] || []).map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => appendToPair(idx, openSide, item.label)}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-fuchsia-100 hover:border-fuchsia-300 transition"
                  >
                    <span>{item.icon}</span>
                    <span className="text-slate-700">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addPair}
        className="rounded-lg border border-dashed border-fuchsia-300 bg-fuchsia-50 px-4 py-1.5 text-xs font-semibold text-fuchsia-700 hover:bg-fuchsia-100"
      >
        + Add Pair
      </button>

      {/* Match preview */}
      {pairs.length > 0 && pairs.some((p) => p.left || p.right) && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4">
          <p className="text-xs text-slate-400 mb-2">Preview (shuffled on print):</p>
          <div className="flex gap-8">
            <div className="space-y-2">
              {pairs.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px] text-slate-500">{i + 1}</span>
                  <span className="text-sm text-slate-700">{p.left || "—"}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {[...pairs].reverse().map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full border-2 border-slate-300 flex items-center justify-center text-[10px] text-slate-500">{String.fromCharCode(65 + i)}</span>
                  <span className="text-sm text-slate-700">{p.right || "—"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Preschool Activity Builder
// ═══════════════════════════════════════════════

export function PreschoolActivityBuilder({ questions, onChange }) {
  const [pickerOpen, setPickerOpen] = useState(null);
  const [pickerCategory, setPickerCategory] = useState(VISUAL_CATEGORIES[0]);

  function updateQ(idx, field, value) {
    const next = questions.map((q, i) =>
      i === idx ? { ...q, [field]: value } : q
    );
    onChange(next);
  }

  function appendVisual(idx, label) {
    const current = questions[idx]?.imageDescription || "";
    const sep = current.trim() ? ", " : "";
    updateQ(idx, "imageDescription", current + sep + label);
  }

  function appendTrace(idx, label) {
    const current = questions[idx]?.traceContent || "";
    const sep = current.trim() ? " " : "";
    updateQ(idx, "traceContent", current + sep + label);
  }

  function addQuestion() {
    onChange([
      ...questions,
      createBlankQuestion(SECTION_TYPES.PRESCHOOL_ACTIVITY, questions.length + 1),
    ]);
  }

  function removeQuestion(idx) {
    if (questions.length <= 1) return;
    onChange(
      questions
        .filter((_, i) => i !== idx)
        .map((q, i) => ({ ...q, questionNumber: i + 1 }))
    );
  }

  return (
    <div className="space-y-4">
      {questions.map((q, idx) => {
        const aType = q.activityType || PRESCHOOL_ACTIVITY_TYPES.COLOUR;
        return (
          <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700">
                Question {q.questionNumber || idx + 1}
              </span>
              {questions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeQuestion(idx)}
                  className="text-xs text-red-500 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>

            {/* Activity Type Selector */}
            <div>
              <label className="text-xs font-medium text-slate-600">Activity Type</label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {ACTIVITY_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => updateQ(idx, "activityType", opt.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      aType === opt.value
                        ? "bg-fuchsia-600 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-fuchsia-100"
                    }`}
                    title={opt.desc}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Instruction */}
            <div>
              <label className="text-xs font-medium text-slate-600">Instruction</label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-fuchsia-400"
                placeholder={
                  aType === PRESCHOOL_ACTIVITY_TYPES.TRACE
                    ? 'e.g., "Trace the letter A"'
                    : aType === PRESCHOOL_ACTIVITY_TYPES.COLOUR
                    ? 'e.g., "Colour the heart shape"'
                    : aType === PRESCHOOL_ACTIVITY_TYPES.BLANK_SPACE
                    ? 'e.g., "Write your name below"'
                    : 'e.g., "Identify the fruit"'
                }
                value={q.instruction}
                onChange={(e) => updateQ(idx, "instruction", e.target.value)}
              />
            </div>

            {/* === TRACE fields === */}
            {aType === PRESCHOOL_ACTIVITY_TYPES.TRACE && (
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-600">
                      Content to trace
                    </label>
                    <button
                      type="button"
                      onClick={() => setPickerOpen(pickerOpen === `trace-${idx}` ? null : `trace-${idx}`)}
                      className="text-xs font-semibold text-fuchsia-600 hover:text-fuchsia-800"
                    >
                      {pickerOpen === `trace-${idx}` ? "Close ✕" : "Pick letters / numbers ✦"}
                    </button>
                  </div>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-fuchsia-400"
                    placeholder='e.g., "A B C" or "1 2 3" or "cat"'
                    value={q.traceContent || ""}
                    onChange={(e) => updateQ(idx, "traceContent", e.target.value)}
                  />
                </div>
                {pickerOpen === `trace-${idx}` && (
                  <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/50 p-3 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {["Letters", "Small Letters", "Numbers"].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setPickerCategory(cat)}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                            pickerCategory === cat
                              ? "bg-fuchsia-600 text-white"
                              : "bg-white text-slate-600 border border-slate-200 hover:bg-fuchsia-100"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                      {(PRESCHOOL_VISUALS[pickerCategory] || []).map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => appendTrace(idx, item.label)}
                          className="flex items-center justify-center rounded-lg border border-slate-200 bg-white w-10 h-10 text-base font-bold hover:bg-fuchsia-100 hover:border-fuchsia-300 transition"
                          title={`Add "${item.label}"`}
                        >
                          {item.icon}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Trace preview */}
                {(q.traceContent || "").trim() && (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4">
                    <p className="text-xs text-slate-400 mb-1">Preview (dotted tracing):</p>
                    <p
                      className="text-4xl tracking-[0.3em] leading-relaxed"
                      style={{
                        color: "#94a3b8",
                        fontFamily: "'KG Primary Dots', 'Comic Sans MS', cursive",
                        letterSpacing: "0.3em",
                      }}
                    >
                      {q.traceContent}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* === COLOUR fields === */}
            {aType === PRESCHOOL_ACTIVITY_TYPES.COLOUR && (
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-600">Shape / Image to colour</label>
                    <button
                      type="button"
                      onClick={() => setPickerOpen(pickerOpen === `colour-${idx}` ? null : `colour-${idx}`)}
                      className="text-xs font-semibold text-fuchsia-600 hover:text-fuchsia-800"
                    >
                      {pickerOpen === `colour-${idx}` ? "Close ✕" : "Pick visuals ✦"}
                    </button>
                  </div>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-fuchsia-400"
                    placeholder='e.g., "Heart", "Circle, Triangle"'
                    value={q.imageDescription}
                    onChange={(e) => updateQ(idx, "imageDescription", e.target.value)}
                  />
                </div>
                {pickerOpen === `colour-${idx}` && (
                  <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/50 p-3 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {VISUAL_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setPickerCategory(cat)}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                            pickerCategory === cat
                              ? "bg-fuchsia-600 text-white"
                              : "bg-white text-slate-600 border border-slate-200 hover:bg-fuchsia-100"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                      {(PRESCHOOL_VISUALS[pickerCategory] || []).map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => appendVisual(idx, item.label)}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs hover:bg-fuchsia-100 hover:border-fuchsia-300 transition"
                          title={`Add "${item.label}"`}
                        >
                          <span>{item.icon}</span>
                          <span className="text-slate-700">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Shape outline preview */}
                {(q.imageDescription || "").trim() && (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4">
                    <p className="text-xs text-slate-400 mb-2">Preview (outline for colouring):</p>
                    <div className="flex flex-wrap gap-4 items-end text-slate-400">
                      {q.imageDescription.split(",").map((name, si) => {
                        const trimmed = name.trim();
                        return (
                          <div key={si} className="flex flex-col items-center gap-1">
                            {SHAPE_SVGS[trimmed] || (
                              <div className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center">
                                <span className="text-xs text-slate-400">{trimmed}</span>
                              </div>
                            )}
                            <span className="text-[10px] text-slate-500">{trimmed}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* === BLANK SPACE fields === */}
            {aType === PRESCHOOL_ACTIVITY_TYPES.BLANK_SPACE && (
              <div className="space-y-2">
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-4">
                  <p className="text-xs text-slate-400 mb-2">Blank writing / scribbling area:</p>
                  {/* Lined writing area preview */}
                  <div className="space-y-0">
                    {[1, 2, 3, 4].map((line) => (
                      <div key={line} className="h-10 border-b border-slate-200" />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* === IDENTIFY fields === */}
            {aType === PRESCHOOL_ACTIVITY_TYPES.IDENTIFY && (
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-600">Image / Visual description</label>
                    <button
                      type="button"
                      onClick={() => setPickerOpen(pickerOpen === `id-${idx}` ? null : `id-${idx}`)}
                      className="text-xs font-semibold text-fuchsia-600 hover:text-fuchsia-800"
                    >
                      {pickerOpen === `id-${idx}` ? "Close ✕" : "Pick visuals ✦"}
                    </button>
                  </div>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-fuchsia-400"
                    placeholder='e.g., "Apple, Carrot, Orange, Mango"'
                    value={q.imageDescription}
                    onChange={(e) => updateQ(idx, "imageDescription", e.target.value)}
                  />
                </div>
                {pickerOpen === `id-${idx}` && (
                  <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/50 p-3 space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {VISUAL_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setPickerCategory(cat)}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                            pickerCategory === cat
                              ? "bg-fuchsia-600 text-white"
                              : "bg-white text-slate-600 border border-slate-200 hover:bg-fuchsia-100"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                      {(PRESCHOOL_VISUALS[pickerCategory] || []).map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => appendVisual(idx, item.label)}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs hover:bg-fuchsia-100 hover:border-fuchsia-300 transition"
                          title={`Add "${item.label}"`}
                        >
                          <span>{item.icon}</span>
                          <span className="text-slate-700">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* === MATCH fields === */}
            {aType === PRESCHOOL_ACTIVITY_TYPES.MATCH && (
              <MatchPairEditor
                pairs={q.matchPairs || []}
                onChange={(pairs) => updateQ(idx, "matchPairs", pairs)}
                pickerOpen={pickerOpen}
                pickerKey={`match-${idx}`}
                setPickerOpen={setPickerOpen}
                pickerCategory={pickerCategory}
                setPickerCategory={setPickerCategory}
              />
            )}

            {/* Answer label */}
            <div>
              <label className="text-xs font-medium text-slate-600">
                Answer label (optional)
              </label>
              <input
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-fuchsia-400"
                placeholder='e.g., "Heart"'
                value={q.answerLabel || ""}
                onChange={(e) => updateQ(idx, "answerLabel", e.target.value)}
              />
            </div>

            {/* Marks */}
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-slate-600">Marks:</label>
              <input
                type="number"
                min="1"
                max="20"
                className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-sm text-center outline-none focus:border-fuchsia-400"
                value={q.marks}
                onChange={(e) => updateQ(idx, "marks", Number(e.target.value))}
              />
            </div>
          </div>
        );
      })}
      <button
        type="button"
        onClick={addQuestion}
        className="rounded-lg border border-dashed border-fuchsia-300 bg-fuchsia-50 px-4 py-2 text-sm font-semibold text-fuchsia-700 hover:bg-fuchsia-100"
      >
        + Add Question
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Section Builder (wraps the above)
// ═══════════════════════════════════════════════

export function SectionBuilder({ section, onChange }) {
  const [expanded, setExpanded] = useState(true);

  function handleQuestionsChange(questions) {
    onChange({ ...section, questions });
  }

  function renderBuilder() {
    switch (section.type) {
      case SECTION_TYPES.MCQ:
        return <MCQBuilder questions={section.questions} onChange={handleQuestionsChange} />;
      case SECTION_TYPES.SHORT_ANSWER:
        return <MCQBuilder questions={section.questions} onChange={handleQuestionsChange} />;
      case SECTION_TYPES.COMPOSITION:
        return <CompositionBuilder questions={section.questions} onChange={handleQuestionsChange} />;
      case SECTION_TYPES.COMPREHENSION:
        return <ComprehensionBuilder questions={section.questions} onChange={handleQuestionsChange} />;
      case SECTION_TYPES.PRESCHOOL_ACTIVITY:
        return <PreschoolActivityBuilder questions={section.questions} onChange={handleQuestionsChange} />;
      default:
        return <PreschoolActivityBuilder questions={section.questions} onChange={handleQuestionsChange} />;
    }
  }

  const totalMarks = (section.questions || []).reduce((sum, q) => {
    if (q.questions) {
      return sum + q.questions.reduce((s, sq) => s + (sq.marks || 0), 0);
    }
    return sum + (q.marks || 0);
  }, 0);

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-slate-100 transition"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{expanded ? "▼" : "▶"}</span>
          <span className="text-sm font-bold text-slate-900">{section.label}</span>
        </div>
        <span className="text-xs font-semibold text-slate-500">{totalMarks} marks · {(section.questions || []).length} item(s)</span>
      </button>
      {expanded && (
        <div className="px-5 pb-5">
          {renderBuilder()}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// Exam Preview (read-only)
// ═══════════════════════════════════════════════

export function ExamPreview({ exam }) {
  const printRef = useRef(null);

  if (!exam) return null;

  function handlePrint() {
    const el = printRef.current;
    if (!el) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html><head><title>${exam.subject} - ${exam.className}</title>
<style>
  @font-face { font-family: 'KG Primary Dots'; src: url('/fonts/KGPrimaryDots.ttf') format('truetype'); font-display: swap; }
  @page { size: A4; margin: 15mm 18mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #000; line-height: 1.5; }
  .exam-header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 16px; }
  .exam-header h1 { font-size: 16pt; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; }
  .exam-header p { font-size: 11pt; margin-top: 2px; }
  .exam-header .subject-line { font-size: 13pt; font-weight: 700; margin-top: 4px; }
  .name-line { display: flex; justify-content: space-between; margin: 8px 0 16px; font-size: 11pt; }
  .name-line span { border-bottom: 1px dotted #000; flex: 1; margin-left: 4px; margin-right: 20px; }
  .section-block { margin-bottom: 18px; page-break-inside: avoid; }
  .section-title { font-size: 12pt; font-weight: 700; margin-bottom: 8px; text-decoration: underline; }
  /* MCQ two-column */
  .mcq-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; }
  .mcq-item { font-size: 11pt; }
  .mcq-item .q-text { font-weight: 600; }
  .mcq-item .options { margin-left: 16px; }
  .mcq-item .options p { margin: 1px 0; }
  /* Composition */
  .comp-prompt { font-weight: 600; margin-bottom: 4px; }
  .comp-instructions { font-style: italic; color: #444; margin-bottom: 4px; }
  .comp-lines { margin-top: 8px; }
  .comp-lines .write-line { height: 28px; border-bottom: 1px solid #ccc; }
  /* Comprehension */
  .passage-box { border: 1px solid #999; padding: 10px; margin-bottom: 10px; font-size: 11pt; white-space: pre-wrap; }
  .comp-q { margin-bottom: 4px; }
  .comp-q .q-text { font-weight: 600; }
  .comp-q .marks { font-size: 9pt; color: #666; margin-left: 6px; }
  /* Preschool */
  .preschool-q { margin-bottom: 16px; page-break-inside: avoid; }
  .preschool-q .q-instruction { font-size: 12pt; font-weight: 600; margin-bottom: 6px; }
  .trace-box { border: 1px dashed #aaa; padding: 16px; text-align: center; margin: 6px 0 6px 16px; }
  .trace-text { font-size: 42pt; letter-spacing: 0.4em; color: #999; font-family: 'KG Primary Dots', 'Comic Sans MS', cursive; }
  .colour-box { border: 1px dashed #aaa; padding: 16px; margin: 6px 0 6px 16px; display: flex; flex-wrap: wrap; gap: 20px; justify-content: center; align-items: flex-end; }
  .colour-box svg { width: 80px; height: 80px; color: #999; }
  .colour-box .shape-label { font-size: 9pt; text-align: center; color: #666; }
  .colour-box .placeholder { width: 80px; height: 80px; border: 2px dashed #ccc; display: flex; align-items: center; justify-content: center; font-size: 9pt; color: #999; }
  .blank-box { border: 1px dashed #aaa; padding: 8px 16px; margin: 6px 0 6px 16px; }
  .blank-box .write-line { height: 32px; border-bottom: 1px solid #ddd; }
  .identify-box { border: 1px dashed #aaa; padding: 16px; margin: 6px 0 6px 16px; display: flex; flex-wrap: wrap; gap: 24px; justify-content: center; align-items: flex-end; }
  .identify-box .id-item { text-align: center; }
  .identify-box .id-emoji { font-size: 36pt; }
  .identify-box .id-label { font-size: 9pt; color: #666; }
  .identify-box svg { width: 80px; height: 80px; color: #999; }
  .identify-box .id-placeholder { width: 80px; height: 80px; border: 2px dashed #ccc; display: flex; align-items: center; justify-content: center; font-size: 9pt; color: #999; }
  .match-box { display: flex; gap: 40px; margin: 8px 0 8px 16px; padding: 12px 16px; border: 1px dashed #aaa; }
  .match-col { flex: 1; }
  .match-item { font-size: 11pt; padding: 4px 0; display: flex; align-items: center; gap: 8px; min-height: 50px; }
  .match-svg { width: 50px; height: 50px; color: #666; }
  .match-svg svg { width: 100%; height: 100%; }
  .match-num { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; border: 2px solid #666; font-size: 9pt; font-weight: 700; }
  .marks-label { font-size: 9pt; color: #666; margin-left: 16px; }
  .answer-label { font-size: 11pt; font-weight: 500; margin-left: 16px; margin-top: 2px; }
  .no-print { display: none !important; }
</style>
</head><body>`);

    // Header
    printWindow.document.write(`
      <div class="exam-header">
        <h1>Greenidge International School</h1>
        <p>${exam.examType} Examination &ndash; ${exam.term} (${exam.academicYear})</p>
        <p class="subject-line">${exam.subject}</p>
        <p>${exam.className}</p>
      </div>
      <div class="name-line">
        <div>Name: <span></span></div>
        <div>Date: <span></span></div>
      </div>
    `);

    // Sections
    for (const sec of exam.sections || []) {
      printWindow.document.write(`<div class="section-block"><div class="section-title">${sec.label}</div>`);

      if (sec.type === "mcq") {
        printWindow.document.write(`<div class="mcq-grid">`);
        for (const q of sec.questions || []) {
          printWindow.document.write(`<div class="mcq-item"><p class="q-text">${q.questionNumber}. ${q.question}</p><div class="options">`);
          for (let oi = 0; oi < (q.options || []).length; oi++) {
            printWindow.document.write(`<p>${String.fromCharCode(65 + oi)}. ${q.options[oi]}</p>`);
          }
          printWindow.document.write(`</div></div>`);
        }
        printWindow.document.write(`</div>`);
      }

      if (sec.type === "composition") {
        for (const q of sec.questions || []) {
          printWindow.document.write(`<p class="comp-prompt">${q.prompt}</p>`);
          if (q.instructions) printWindow.document.write(`<p class="comp-instructions">${q.instructions}</p>`);
          printWindow.document.write(`<p class="marks-label">[${q.marks} marks]</p>`);
          printWindow.document.write(`<div class="comp-lines">`);
          for (let i = 0; i < 15; i++) printWindow.document.write(`<div class="write-line"></div>`);
          printWindow.document.write(`</div>`);
        }
      }

      if (sec.type === "comprehension") {
        for (const q of sec.questions || []) {
          printWindow.document.write(`<div class="passage-box">${q.passage}</div>`);
          for (const sq of q.questions || []) {
            printWindow.document.write(`<div class="comp-q"><span class="q-text">${sq.questionNumber}. ${sq.question}</span><span class="marks">[${sq.marks} marks]</span></div>`);
            // answer lines
            printWindow.document.write(`<div style="margin-left:16px;margin-bottom:6px;">`);
            for (let i = 0; i < 2; i++) printWindow.document.write(`<div class="write-line" style="height:24px;border-bottom:1px solid #ddd;"></div>`);
            printWindow.document.write(`</div>`);
          }
        }
      }

      if (sec.type === "preschool_activity") {
        for (const q of sec.questions || []) {
          const aType = q.activityType || "colour";
          printWindow.document.write(`<div class="preschool-q"><p class="q-instruction">${q.questionNumber || ""}. ${q.instruction}</p>`);

          if (aType === "trace" && (q.traceContent || "").trim()) {
            printWindow.document.write(`<div class="trace-box"><span class="trace-text">${q.traceContent}</span></div>`);
          }

          if (aType === "colour" && (q.imageDescription || "").trim()) {
            printWindow.document.write(`<div class="colour-box">`);
            for (const name of q.imageDescription.split(",")) {
              const t = name.trim();
              if (PRINT_OUTLINE_SVGS[t]) {
                printWindow.document.write(`<div style="text-align:center">${PRINT_OUTLINE_SVGS[t]}<div class="shape-label">${t}</div></div>`);
              } else {
                printWindow.document.write(`<div style="text-align:center"><div class="placeholder">${t}</div><div class="shape-label">${t}</div></div>`);
              }
            }
            printWindow.document.write(`</div>`);
          }

          if (aType === "blank_space") {
            printWindow.document.write(`<div class="blank-box">`);
            for (let i = 0; i < 5; i++) printWindow.document.write(`<div class="write-line"></div>`);
            printWindow.document.write(`</div>`);
          }

          if (aType === "identify" && (q.imageDescription || "").trim()) {
            printWindow.document.write(`<div class="identify-box">`);
            for (const name of q.imageDescription.split(",")) {
              const t = name.trim();
              if (PRINT_OUTLINE_SVGS[t]) {
                printWindow.document.write(`<div class="id-item">${PRINT_OUTLINE_SVGS[t]}<div class="id-label">${t}</div></div>`);
              } else {
                printWindow.document.write(`<div class="id-item"><div class="id-placeholder">${t}</div><div class="id-label">${t}</div></div>`);
              }
            }
            printWindow.document.write(`</div>`);
          }

          if (aType === "match" && (q.matchPairs || []).length > 0) {
            const shuffled = [...(q.matchPairs || [])].sort(() => 0.5 - Math.random());
            printWindow.document.write(`<div class="match-box"><div class="match-col">`);
            for (let pi = 0; pi < q.matchPairs.length; pi++) {
              printWindow.document.write(`<div class="match-item"><span class="match-num">${pi + 1}</span> ${q.matchPairs[pi].left}</div>`);
            }
            printWindow.document.write(`</div><div class="match-col">`);
            for (let pi = 0; pi < shuffled.length; pi++) {
              const rVal = shuffled[pi].right;
              if (PRINT_OUTLINE_SVGS[rVal]) {
                printWindow.document.write(`<div class="match-item"><span class="match-num">${String.fromCharCode(65 + pi)}</span><div class="match-svg">${PRINT_OUTLINE_SVGS[rVal]}</div></div>`);
              } else {
                printWindow.document.write(`<div class="match-item"><span class="match-num">${String.fromCharCode(65 + pi)}</span> ${rVal}</div>`);
              }
            }
            printWindow.document.write(`</div></div>`);
          }

          if (q.answerLabel) printWindow.document.write(`<p class="answer-label">${q.answerLabel}</p>`);
          printWindow.document.write(`<p class="marks-label">[${q.marks} marks]</p>`);
          printWindow.document.write(`</div>`);
        }
      }

      printWindow.document.write(`</div>`);
    }

    printWindow.document.write(`</body></html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 300);
  }

  return (
    <div>
      {/* Print button */}
      <div className="flex justify-end mb-3 print:hidden">
        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition shadow-sm"
        >
          <span>🖨️</span> Print Exam Paper
        </button>
      </div>

      <div ref={printRef} className="space-y-6">
      {/* Header */}
      <div className="text-center border-b border-slate-200 pb-4">
        <h2 className="text-lg font-extrabold text-slate-900 uppercase">Greenidge International School</h2>
        <p className="text-sm text-slate-600 mt-1">{exam.examType} Examination – {exam.term} ({exam.academicYear})</p>
        <p className="text-sm font-semibold text-slate-800 mt-1">{exam.subject} – {exam.className}</p>
      </div>

      {/* Uploaded file */}
      {exam.inputMode === "upload" && exam.fileUrl && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-700">📎 Uploaded file: <span className="font-semibold">{exam.fileName}</span></p>
          <a href={exam.fileUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-fuchsia-700 hover:underline">
            View / Download File →
          </a>
        </div>
      )}

      {/* Typed sections */}
      {(exam.sections || []).map((sec, idx) => (
        <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-3">{sec.label}</h3>

          {sec.type === "mcq" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(sec.questions || []).map((q, qi) => (
                <div key={qi} className="text-sm text-slate-700">
                  <p className="font-semibold">{q.questionNumber}. {q.question}</p>
                  <div className="ml-4 mt-1 space-y-0.5">
                    {(q.options || []).map((opt, oi) => (
                      <p key={oi} className={opt === q.answer ? "font-bold text-emerald-700" : ""}>
                        {String.fromCharCode(65 + oi)}. {opt}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {sec.type === "composition" && (sec.questions || []).map((q, qi) => (
            <div key={qi} className="text-sm text-slate-700">
              <p className="font-semibold">{q.prompt}</p>
              {q.instructions && <p className="text-slate-500 mt-1">{q.instructions}</p>}
              <p className="text-xs text-slate-400 mt-1">[{q.marks} marks]</p>
            </div>
          ))}

          {sec.type === "comprehension" && (sec.questions || []).map((q, qi) => (
            <div key={qi} className="text-sm text-slate-700 space-y-2">
              <div className="bg-slate-50 rounded-lg p-3 text-sm whitespace-pre-wrap">{q.passage}</div>
              {(q.questions || []).map((sq, si) => (
                <p key={si}>
                  <span className="font-semibold">{sq.questionNumber}. {sq.question}</span>
                  <span className="text-xs text-slate-400 ml-2">[{sq.marks} marks]</span>
                </p>
              ))}
            </div>
          ))}

          {sec.type === "preschool_activity" && (sec.questions || []).map((q, qi) => {
            const aType = q.activityType || "colour";
            return (
              <div key={qi} className="rounded-lg border border-slate-100 bg-slate-50 p-3 space-y-2">
                <p className="text-sm font-semibold text-slate-800">
                  {q.questionNumber || qi + 1}. {q.instruction}
                </p>

                {/* Trace preview */}
                {aType === "trace" && (q.traceContent || "").trim() && (
                  <div className="ml-4 rounded-lg border border-dashed border-slate-300 bg-white p-4">
                    <p
                      className="text-4xl tracking-[0.3em] leading-relaxed"
                      style={{
                        color: "#cbd5e1",
                        fontFamily: "'KG Primary Dots', 'Comic Sans MS', cursive",
                      }}
                    >
                      {q.traceContent}
                    </p>
                  </div>
                )}

                {/* Colour outline preview */}
                {aType === "colour" && (q.imageDescription || "").trim() && (
                  <div className="ml-4 rounded-lg border border-dashed border-slate-300 bg-white p-4">
                    <div className="flex flex-wrap gap-4 items-end text-slate-400">
                      {q.imageDescription.split(",").map((name, si) => {
                        const trimmed = name.trim();
                        return (
                          <div key={si} className="flex flex-col items-center gap-1">
                            {ALL_OUTLINE_SVGS[trimmed] ? (
                              ALL_OUTLINE_SVGS[trimmed]
                            ) : (
                              <div className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center">
                                <span className="text-xs text-slate-400">{trimmed}</span>
                              </div>
                            )}
                            <span className="text-[10px] text-slate-500">{trimmed}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Blank writing space */}
                {aType === "blank_space" && (
                  <div className="ml-4 rounded-lg border border-dashed border-slate-300 bg-white p-4">
                    {[1, 2, 3, 4].map((line) => (
                      <div key={line} className="h-10 border-b border-slate-200" />
                    ))}
                  </div>
                )}

                {/* Identify */}
                {aType === "identify" && (q.imageDescription || "").trim() && (
                  <div className="ml-4 rounded-lg border border-dashed border-slate-300 bg-white p-4">
                    <div className="flex flex-wrap gap-6 items-end justify-center">
                      {q.imageDescription.split(",").map((name, si) => {
                        const trimmed = name.trim();
                        return (
                          <div key={si} className="flex flex-col items-center gap-1">
                            {ALL_OUTLINE_SVGS[trimmed] ? (
                              <div className="text-slate-400">{ALL_OUTLINE_SVGS[trimmed]}</div>
                            ) : (
                              <div className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center">
                                <span className="text-xs text-slate-400">{trimmed}</span>
                              </div>
                            )}
                            <span className="text-[10px] text-slate-500">{trimmed}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Match */}
                {aType === "match" && (q.matchPairs || []).length > 0 && (
                  <div className="ml-4 rounded-lg border border-dashed border-slate-300 bg-white p-4">
                    <div className="flex gap-8">
                      <div className="space-y-2">
                        {(q.matchPairs || []).map((p, pi) => (
                          <div key={pi} className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full border-2 border-slate-400 flex items-center justify-center text-[10px] font-bold text-slate-600">{pi + 1}</span>
                            <span className="text-sm text-slate-700">{p.left}</span>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {[...(q.matchPairs || [])].reverse().map((p, pi) => (
                          <div key={pi} className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full border-2 border-slate-400 flex items-center justify-center text-[10px] font-bold text-slate-600">{String.fromCharCode(65 + pi)}</span>
                            {ALL_OUTLINE_SVGS[p.right] ? (
                              <div className="w-14 h-14 text-slate-500">{ALL_OUTLINE_SVGS[p.right]}</div>
                            ) : (
                              <span className="text-sm text-slate-700">{p.right}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {q.answerLabel && <p className="ml-4 text-sm font-medium text-slate-700">{q.answerLabel}</p>}
                <p className="text-xs text-slate-400 ml-4">[{q.marks} marks]</p>
              </div>
            );
          })}
        </div>
      ))}
      </div>
    </div>
  );
}
