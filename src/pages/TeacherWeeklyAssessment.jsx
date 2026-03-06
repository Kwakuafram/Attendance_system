/**
 * TeacherWeeklyAssessment.jsx
 *
 * Admin / Head Teacher review panel for teacher self-assessments.
 * Teachers submit their own GES/NaCCA weekly self-assessment from their dashboard.
 * The admin views submitted assessments, adds feedback, and marks as REVIEWED.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import toast from "react-hot-toast";
import {
  ASSESSMENT_DOMAINS,
  RATING_SCALE,
  computeAssessmentScores,
  reviewAssessment,
  getPendingAssessments,
  getAllAssessments,
} from "../services/teacherAssessmentService";

const RATING_COLORS = {
  4: "bg-emerald-500",
  3: "bg-sky-500",
  2: "bg-amber-500",
  1: "bg-rose-500",
  0: "bg-slate-200",
};

const GRADE_COLORS = {
  Excellent: "text-emerald-700 bg-emerald-50 border-emerald-200",
  Good: "text-sky-700 bg-sky-50 border-sky-200",
  Satisfactory: "text-amber-700 bg-amber-50 border-amber-200",
  Unsatisfactory: "text-rose-700 bg-rose-50 border-rose-200",
};

export default function TeacherWeeklyAssessment({ profile, user }) {
  const [tab, setTab] = useState("pending"); // pending | all | detail
  const [pending, setPending] = useState([]);
  const [allList, setAllList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null); // full assessment doc
  const [busy, setBusy] = useState(false);

  // Admin review fields
  const [adminComment, setAdminComment] = useState("");
  const [adminStrengths, setAdminStrengths] = useState("");
  const [adminAreas, setAdminAreas] = useState("");
  const [adminActionPlan, setAdminActionPlan] = useState("");

  // Expanded domain tracking in detail view
  const [expandedDomains, setExpandedDomains] = useState(
    () => new Set(ASSESSMENT_DOMAINS.map((d) => d.id))
  );

  const teacherScores = useMemo(
    () => (selected?.ratings ? computeAssessmentScores(selected.ratings) : null),
    [selected]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, a] = await Promise.all([getPendingAssessments(50), getAllAssessments(50)]);
      setPending(p);
      setAllList(a);
    } catch (e) {
      console.error("Load assessments:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function openDetail(doc) {
    setSelected(doc);
    setAdminComment(doc.adminComment || "");
    setAdminStrengths(doc.adminStrengths || "");
    setAdminAreas(doc.adminAreasForImprovement || "");
    setAdminActionPlan(doc.adminActionPlan || "");
    setExpandedDomains(new Set(ASSESSMENT_DOMAINS.map((d) => d.id)));
    setTab("detail");
  }

  async function handleReview() {
    if (!selected) return;
    toast.dismiss();
    setBusy(true);
    try {
      await reviewAssessment(selected.id, {
        adminComment,
        adminStrengths,
        adminAreasForImprovement: adminAreas,
        adminActionPlan,
        reviewedById: user?.uid || "",
        reviewedByName: profile?.fullName || user?.email || "",
      });
      toast.success("Assessment reviewed ✅");
      setSelected(null);
      setTab("pending");
      await loadData();
    } catch (e) {
      toast.error(e?.message || "Failed to submit review.");
    } finally {
      setBusy(false);
    }
  }

  function handlePrint() {
    if (!selected || !teacherScores) return;
    const safe = (v) => String(v ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    let domainsHtml = "";
    for (const domain of ASSESSMENT_DOMAINS) {
      const ds = teacherScores.domainScores[domain.id];
      let criteriaRows = "";
      for (const c of domain.criteria) {
        const r = selected.ratings?.[c.id] || {};
        const ratingLabel = RATING_SCALE.find((x) => x.value === r.score);
        criteriaRows += `<tr><td style="font-weight:600;">${safe(c.label)}</td><td class="c">${r.score || "—"}</td><td class="c">${safe(ratingLabel?.label || "—")}</td><td>${safe(r.comment || "—")}</td></tr>`;
      }
      domainsHtml += `<div class="domain"><div class="domain-hd"><span>${safe(domain.label)}</span><span>${ds.earned}/${ds.possible} (${ds.pct}%)</span></div><table><thead><tr><th>Criterion</th><th class="c" style="width:60px">Score</th><th class="c" style="width:110px">Rating</th><th>Comment</th></tr></thead><tbody>${criteriaRows}</tbody></table></div>`;
    }

    const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Assessment Review – ${safe(selected.teacherName)} – ${safe(selected.weekKey)}</title>
<style>
  body{font-family:Arial,sans-serif;margin:20px;font-size:12px;}
  .sheet{max-width:960px;margin:0 auto;}
  h1{font-size:16px;margin:0;} h2{font-size:13px;margin:0 0 4px;}
  .meta{color:#555;line-height:1.6;}
  .domain{border:1px solid #ddd;border-radius:8px;padding:10px;margin-top:12px;}
  .domain-hd{display:flex;justify-content:space-between;font-weight:700;font-size:13px;margin-bottom:6px;color:#1e3a5f;}
  table{width:100%;border-collapse:collapse;}
  th,td{border:1px solid #ddd;padding:5px 7px;text-align:left;}
  th{background:#f5f5f5;} .c{text-align:center;}
  .summary{margin-top:12px;padding:10px;border:1px solid #ddd;border-radius:8px;}
  .grade{font-size:18px;font-weight:800;margin:4px 0;}
  .box{border:1px solid #ddd;padding:8px;border-radius:6px;margin-top:8px;}
  .box-label{font-weight:600;color:#555;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;}
</style></head><body><div class="sheet">
  <h1>WEEKLY TEACHER SELF-ASSESSMENT REVIEW</h1>
  <h2>GES National Teachers' Standards / NaCCA Standards-Based Curriculum</h2>
  <div class="meta">
    <div><b>Teacher:</b> ${safe(selected.teacherName || "—")} &nbsp;|&nbsp; <b>Week:</b> ${safe(selected.weekKey)}</div>
    <div><b>Reviewed by:</b> ${safe(profile?.fullName || user?.email || "—")}</div>
  </div>
  <div class="summary">
    <h3>Teacher's Self-Assessment Score</h3>
    <div class="grade">${teacherScores.overall.pct}% – ${teacherScores.overall.grade}</div>
    <div>${teacherScores.overall.earned} / ${teacherScores.overall.possible} points</div>
  </div>
  ${domainsHtml}
  <div class="box"><div class="box-label">Teacher's Strengths</div><div>${safe(selected.strengthsObserved || "—")}</div></div>
  <div class="box"><div class="box-label">Teacher's Areas for Improvement</div><div>${safe(selected.areasForImprovement || "—")}</div></div>
  <div class="box"><div class="box-label">Teacher's Action Plan</div><div>${safe(selected.agreedActionPlan || "—")}</div></div>
  <hr style="margin:16px 0;border:none;border-top:2px solid #333;"/>
  <h2>HEAD TEACHER / ADMIN REVIEW</h2>
  <div class="box"><div class="box-label">Admin Comment</div><div>${safe(adminComment || selected.adminComment || "—")}</div></div>
  <div class="box"><div class="box-label">Admin – Strengths Noted</div><div>${safe(adminStrengths || selected.adminStrengths || "—")}</div></div>
  <div class="box"><div class="box-label">Admin – Areas to Improve</div><div>${safe(adminAreas || selected.adminAreasForImprovement || "—")}</div></div>
  <div class="box"><div class="box-label">Admin – Action Plan</div><div>${safe(adminActionPlan || selected.adminActionPlan || "—")}</div></div>
  <div style="margin-top:30px;display:flex;justify-content:space-between;">
    <div style="border-top:1px solid #000;width:200px;text-align:center;padding-top:4px;">Teacher's Signature</div>
    <div style="border-top:1px solid #000;width:200px;text-align:center;padding-top:4px;">Head Teacher's Signature</div>
  </div>
</div><script>window.print();</script></body></html>`;

    const w = window.open("", "_blank", "width=1100,height=900");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  // ────────── List Card ──────────
  function AssessmentCard({ item }) {
    const isReviewed = item.status === "REVIEWED";
    return (
      <div
        onClick={() => openDetail(item)}
        className={[
          "flex cursor-pointer items-center justify-between rounded-2xl border p-5 transition hover:shadow-md",
          isReviewed
            ? "border-emerald-200 bg-emerald-50/60"
            : "border-amber-200 bg-amber-50/60 hover:border-amber-300",
        ].join(" ")}
      >
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-900 truncate">
            {item.teacherName || "Unknown Teacher"}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-bold text-slate-600">
              📅 {item.weekKey}
            </span>
            <span
              className={[
                "rounded-full border px-2.5 py-0.5 text-[10px] font-bold",
                isReviewed
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                  : "bg-amber-100 text-amber-700 border-amber-200",
              ].join(" ")}
            >
              {isReviewed ? "✅ Reviewed" : "⏳ Pending Review"}
            </span>
            <span className="text-[10px] text-slate-400">
              {item.createdAt?.toDate
                ? item.createdAt.toDate().toLocaleDateString()
                : ""}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0 ml-4">
          <div className="text-xl font-extrabold text-slate-900">
            {item.pct ?? 0}%
          </div>
          <span
            className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
              GRADE_COLORS[item.grade] ||
              "text-slate-600 bg-slate-50 border-slate-200"
            }`}
          >
            {item.grade || "—"}
          </span>
        </div>
      </div>
    );
  }

  // ────────── Detail View ──────────
  if (tab === "detail" && selected) {
    const isReviewed = selected.status === "REVIEWED";

    return (
      <div className="space-y-6">
        {/* Back + Header */}
        <div className="rounded-2xl border border-indigo-200 bg-linear-to-br from-indigo-50 to-violet-50 p-6 shadow-sm">
          <button
            onClick={() => {
              setSelected(null);
              setTab("pending");
            }}
            className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            ← Back to list
          </button>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-indigo-900">
                📋 Assessment Review: {selected.teacherName || "—"}
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Week: {selected.weekKey}
              </p>
              <span
                className={[
                  "mt-2 inline-block rounded-full border px-3 py-1 text-xs font-bold",
                  isReviewed
                    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                    : "bg-amber-100 text-amber-700 border-amber-200",
                ].join(" ")}
              >
                {isReviewed ? "✅ Reviewed" : "⏳ Pending Review"}
              </span>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={handlePrint}
                className="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
              >
                🖨 Print
              </button>
              {!isReviewed && (
                <button
                  onClick={handleReview}
                  disabled={busy}
                  className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {busy ? "Submitting..." : "✅ Mark as Reviewed"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Teacher Score Summary */}
        {teacherScores && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900">
              Teacher&apos;s Self-Assessment Score
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-6">
              <div>
                <span className="text-3xl font-extrabold text-slate-900">
                  {teacherScores.overall.pct}%
                </span>
                <span
                  className={`ml-3 rounded-full border px-3 py-1 text-xs font-bold ${
                    GRADE_COLORS[teacherScores.overall.grade] || ""
                  }`}
                >
                  {teacherScores.overall.grade}
                </span>
                <p className="mt-1 text-xs text-slate-500">
                  {teacherScores.overall.earned} / {teacherScores.overall.possible}{" "}
                  points
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {ASSESSMENT_DOMAINS.map((domain) => {
                  const ds = teacherScores.domainScores[domain.id];
                  return (
                    <div
                      key={domain.id}
                      className="min-w-35 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        {domain.label.replace("Domain ", "D")}
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-slate-200">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              ds.pct >= 75
                                ? "bg-emerald-500"
                                : ds.pct >= 50
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                            }`}
                            style={{ width: `${ds.pct}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-700">
                          {ds.pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Teacher Ratings by Domain (Read-Only) */}
        {ASSESSMENT_DOMAINS.map((domain) => {
          const expanded = expandedDomains.has(domain.id);
          const ds = teacherScores?.domainScores?.[domain.id] || {
            pct: 0,
            earned: 0,
            possible: 0,
          };

          return (
            <div
              key={domain.id}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
            >
              <button
                onClick={() => {
                  setExpandedDomains((prev) => {
                    const next = new Set(prev);
                    next.has(domain.id)
                      ? next.delete(domain.id)
                      : next.add(domain.id);
                    return next;
                  });
                }}
                className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left hover:bg-slate-50 transition"
              >
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {domain.label}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {domain.description}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-lg font-extrabold text-slate-900">
                      {ds.pct}%
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {ds.earned}/{ds.possible}
                    </div>
                  </div>
                  <span className="text-lg text-slate-400">
                    {expanded ? "▼" : "▶"}
                  </span>
                </div>
              </button>

              {expanded && (
                <div className="border-t border-slate-100 divide-y divide-slate-100">
                  {domain.criteria.map((criterion) => {
                    const r = selected.ratings?.[criterion.id] || {
                      score: 0,
                      comment: "",
                    };
                    const rLabel = RATING_SCALE.find(
                      (x) => x.value === r.score
                    );

                    return (
                      <div key={criterion.id} className="px-6 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-slate-900">
                              {criterion.label}
                            </h4>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {criterion.description}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {r.score > 0 && (
                              <>
                                <span
                                  className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white ${RATING_COLORS[r.score]}`}
                                >
                                  {r.score}
                                </span>
                                <span className="text-xs font-semibold text-slate-600">
                                  {rLabel?.label || ""}
                                </span>
                              </>
                            )}
                            {r.score === 0 && (
                              <span className="text-xs text-slate-400 italic">
                                Not rated
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Teacher's comment */}
                        {r.comment && (
                          <div className="mt-2 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-xs text-slate-600 italic">
                            💬 &quot;{r.comment}&quot;
                          </div>
                        )}

                        {/* Indicators */}
                        <div className="mt-2 rounded-xl bg-slate-50 border border-slate-100 px-4 py-2.5">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                            Indicators
                          </div>
                          <ul className="space-y-0.5">
                            {criterion.indicators.map((ind, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-2 text-xs text-slate-500"
                              >
                                <span className="mt-0.5 text-indigo-400">•</span>
                                {ind}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Teacher's Reflection */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-slate-900">
            Teacher&apos;s Reflection
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                ✅ Strengths
              </div>
              <p className="mt-1 text-sm text-slate-800">
                {selected.strengthsObserved || "—"}
              </p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
                ⚠️ Areas to Improve
              </div>
              <p className="mt-1 text-sm text-slate-800">
                {selected.areasForImprovement || "—"}
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-violet-50 border border-violet-200 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wide text-violet-700">
              📋 Action Plan
            </div>
            <p className="mt-1 text-sm text-slate-800">
              {selected.agreedActionPlan || "—"}
            </p>
          </div>
          {selected.overallComment && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-700">
                💬 Additional Comments
              </div>
              <p className="mt-1 text-sm text-slate-800">
                {selected.overallComment}
              </p>
            </div>
          )}
        </div>

        {/* Admin Review Section */}
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-indigo-900">
            🏫 Head Teacher / Admin Review
          </h3>
          {isReviewed && (
            <div className="rounded-lg bg-emerald-100 border border-emerald-300 px-4 py-3 text-xs text-emerald-800">
              ✅ Reviewed by{" "}
              <strong>{selected.reviewedByName || "Admin"}</strong>
              {selected.reviewedAt?.toDate
                ? ` on ${selected.reviewedAt.toDate().toLocaleDateString()}`
                : ""}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-emerald-700">
                ✅ Strengths Noted by Admin
              </label>
              <textarea
                rows={3}
                value={adminStrengths}
                disabled={isReviewed}
                onChange={(e) => setAdminStrengths(e.target.value)}
                placeholder="Strengths you observed or agree with..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-100"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-amber-700">
                ⚠️ Areas Admin Wants Improved
              </label>
              <textarea
                rows={3}
                value={adminAreas}
                disabled={isReviewed}
                onChange={(e) => setAdminAreas(e.target.value)}
                placeholder="Additional areas for improvement..."
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-indigo-700">
              📋 Admin&apos;s Recommended Action Plan
            </label>
            <textarea
              rows={3}
              value={adminActionPlan}
              disabled={isReviewed}
              onChange={(e) => setAdminActionPlan(e.target.value)}
              placeholder="Steps you recommend for the teacher..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-100"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">
              💬 Overall Admin Comment
            </label>
            <textarea
              rows={3}
              value={adminComment}
              disabled={isReviewed}
              onChange={(e) => setAdminComment(e.target.value)}
              placeholder="Your overall remarks..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-100"
            />
          </div>

          {!isReviewed && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleReview}
                disabled={busy}
                className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {busy ? "Submitting..." : "✅ Mark as Reviewed"}
              </button>
              <button
                onClick={handlePrint}
                className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                🖨 Print
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ────────── Main List View ──────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-indigo-200 bg-linear-to-br from-indigo-50 to-violet-50 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-indigo-900">
              📋 Teacher Assessment Review Panel
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Teachers submit weekly self-assessments based on GES / NaCCA
              standards. Review and provide feedback here.
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
          >
            {loading ? "Loading..." : "🔄 Refresh"}
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setTab("pending")}
            className={[
              "rounded-xl px-5 py-2 text-sm font-semibold transition",
              tab === "pending"
                ? "bg-amber-500 text-white shadow-md"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50",
            ].join(" ")}
          >
            ⏳ Pending ({pending.length})
          </button>
          <button
            onClick={() => setTab("all")}
            className={[
              "rounded-xl px-5 py-2 text-sm font-semibold transition",
              tab === "all"
                ? "bg-indigo-500 text-white shadow-md"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50",
            ].join(" ")}
          >
            📊 All Assessments ({allList.length})
          </button>
        </div>
      </div>

      {/* List */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-sm text-slate-400">
          Loading...
        </div>
      )}

      {!loading && tab === "pending" && (
        <>
          {pending.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
              No pending assessments to review 🎉
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((item) => (
                <AssessmentCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}

      {!loading && tab === "all" && (
        <>
          {allList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
              No assessments found yet.
            </div>
          ) : (
            <div className="space-y-3">
              {allList.map((item) => (
                <AssessmentCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
