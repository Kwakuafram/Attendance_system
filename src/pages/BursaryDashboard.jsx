import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { doc, updateDoc, serverTimestamp, collection, getDocs, query, where } from "firebase/firestore";
import { getSchoolConfig } from "../services/schoolService";
import { getTodayDailyCodes } from "../services/dailyCodeService";
import { isSchoolDay, getHolidayName } from "../utils/ghanaHolidays";
import { getFinanceQuote } from "../utils/financeQuotes";
import { accraYyyyMmDd } from "../utils/accraTime";

import {
  dateKey,
  listPaymentsByDate,
  markStudentPayment,
  getStudentBillingPlan,
  listAllStudentTotals,
  listAllBursaryAccounts,
  computeDueFromStudent,
  listStudentsPage,
} from "../services/bursaryService";
import { useLanguage } from "../i18n/useLanguage";
import LanguageSwitcher from "../i18n/LanguageSwitcher";

export default function BursaryDashboard({ profile }) {
  const user = auth.currentUser;
  const { t } = useLanguage();

  const [selectedDate, setSelectedDate] = useState(dateKey());

  // Students (paginated)
  const [students, setStudents] = useState([]);
  const [studentsCursor, setStudentsCursor] = useState(null);
  const [studentsHasMore, setStudentsHasMore] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);

  const [payments, setPayments] = useState([]);
  const [totalsRows, setTotalsRows] = useState([]);
  const [accountsRows, setAccountsRows] = useState([]);

  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [school, setSchool] = useState(null);
  const [dailyCodes, setDailyCodes] = useState(null);
  const [staffList, setStaffList] = useState([]);

  // Manual payment modal state
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payStudent, setPayStudent] = useState(null);
  const [manualAmount, setManualAmount] = useState("");

  // Holiday Banner or Daily Finance Quote
  const todayStr = accraYyyyMmDd();
  const holidayName = useMemo(() => getHolidayName(todayStr), [todayStr]);
  const dailyQuote = useMemo(() => {
    if (!isSchoolDay(todayStr)) return null;
    return getFinanceQuote(todayStr);
  }, [todayStr]);

  function minutesToHHMM(mins) {
    const m = Number(mins);
    if (!Number.isFinite(m)) return "—";
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  async function loadPaymentsForDate(d) {
    const rows = await listPaymentsByDate(d);
    setPayments(rows);
  }

  async function loadTotals() {
    const rows = await listAllStudentTotals();
    setTotalsRows(rows);
  }

  async function loadAccounts() {
    const rows = await listAllBursaryAccounts();
    setAccountsRows(rows);
  }

  async function resetAndLoadStudents() {
    setStudents([]);
    setStudentsCursor(null);
    setStudentsHasMore(true);
    await loadMoreStudents(true);
  }

  async function loadMoreStudents(isFirstPage = false) {
    if (studentsLoading) return;
    if (!studentsHasMore && !isFirstPage) return;

    setStudentsLoading(true);
    try {
      const res = await listStudentsPage({
        pageSize: 25,
        cursorDoc: isFirstPage ? null : studentsCursor,
      });

      setStudents((prev) => {
        const merged = [...prev, ...res.rows];
        const seen = new Set();
        return merged.filter((s) => {
          if (seen.has(s.studentPath)) return false;
          seen.add(s.studentPath);
          return true;
        });
      });

      setStudentsCursor(res.lastDoc);
      setStudentsHasMore(res.hasMore);
    } catch (e) {
      setMsg(e?.message || "Failed to load students.");
      setStudentsHasMore(false);
    } finally {
      setStudentsLoading(false);
    }
  }

  async function refresh(d = selectedDate) {
    setMsg("");
    setBusy(true);
    try {
      const [sch, dc] = await Promise.all([
        getSchoolConfig(),
        getTodayDailyCodes(),
        loadPaymentsForDate(d),
        loadTotals(),
        loadAccounts(),
      ]);
      setSchool(sch);
      setDailyCodes(dc);

      // Load staff for daily-code display
      const tq = query(collection(db, "users"), where("role", "in", ["TEACHER", "NON_TEACHER"]));
      const tsnap = await getDocs(tq);
      setStaffList(tsnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      // Students load separately (so UI doesn’t freeze)
      await resetAndLoadStudents();
    } catch (e) {
      setMsg(e?.message || "Failed to load bursary dashboard.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    refresh(selectedDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const paidByStudentPath = useMemo(() => {
    const m = new Map();
    for (const p of payments) {
      const key = p.studentPath || p.studentId;
      if (key) m.set(key, p);
    }
    return m;
  }, [payments]);

  const totalsByStudentPath = useMemo(() => {
    const m = new Map();
    for (const t of totalsRows) {
      if (t.studentPath) m.set(t.studentPath, t);
    }
    return m;
  }, [totalsRows]);

  const accountsByStudentPath = useMemo(() => {
    const m = new Map();
    for (const a of accountsRows) {
      if (a.studentPath) m.set(a.studentPath, a);
    }
    return m;
  }, [accountsRows]);

  const filteredStudents = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return students;
    return students.filter((stu) => {
      const name = String(stu.fullName || "").toLowerCase();
      const cls = String(stu.className || "").toLowerCase();
      const plan = String(stu.billingPlan || "").toLowerCase();
      return name.includes(s) || cls.includes(s) || plan.includes(s);
    });
  }, [students, search]);

  const dailyTotals = useMemo(() => {
    return payments.reduce(
      (acc, p) => {
        const items = p.items || {};
        acc.fees += Number(items.fees || p.fees || 0);
        acc.feeding += Number(items.feeding || p.feeding || 0);
        acc.healthMaintenance += Number(items.healthMaintenance || p.healthMaintenance || 0);
        acc.classes += Number(items.classes || p.classes || 0);
        acc.pta += Number(items.pta || 0);
        acc.manual += Number(items.manual || 0);
        acc.grand += Number(p.total || 0);
        return acc;
      },
      { fees: 0, feeding: 0, healthMaintenance: 0, classes: 0, pta: 0, manual: 0, grand: 0 }
    );
  }, [payments]);

  async function updateStudentBillingPlan({ classId, studentDocId, billingPlan }) {
    if (!classId) throw new Error("Missing classId");
    if (!studentDocId) throw new Error("Missing studentDocId");

    const plan = String(billingPlan || "").toUpperCase();
    if (!["DAILY", "WEEKLY", "MONTHLY", "TERMLY"].includes(plan)) throw new Error("Invalid plan");

    const ref = doc(db, "classes", classId, "students", studentDocId);
    await updateDoc(ref, { billingPlan: plan, updatedAt: serverTimestamp() });
  }

  async function handleMarkPaid(stu) {
    setMsg("");
    try {
      if (!user?.uid) throw new Error("Not signed in.");

      const plan = getStudentBillingPlan(stu);

      // DAILY: prevent duplicate for the selected date
      if (plan === "DAILY") {
        const existingDaily = paidByStudentPath.get(stu.studentPath);
        if (existingDaily) throw new Error("This student is already marked PAID for this date.");

        setBusy(true);
        await markStudentPayment({
          date: selectedDate,
          student: stu,
          createdByUid: user.uid,
          createdByName: profile?.fullName || user.email || "",
        });

        await Promise.all([loadPaymentsForDate(selectedDate), loadTotals(), loadAccounts()]);
        setMsg("Marked as paid.");
        return;
      }

      // WEEKLY / MONTHLY / TERMLY => open modal for manual FEES payment
      setPayStudent(stu);
      setManualAmount("");
      setPayModalOpen(true);
    } catch (e) {
      setMsg(e?.message || "Failed to mark paid.");
    } finally {
      setBusy(false);
    }
  }

  async function submitManualPayment() {
    setMsg("");
    setBusy(true);
    try {
      if (!user?.uid) throw new Error("Not signed in.");
      if (!payStudent) throw new Error("No student selected.");

      await markStudentPayment({
        date: selectedDate,
        student: payStudent,
        createdByUid: user.uid,
        createdByName: profile?.fullName || user.email || "",
        manualTotal: manualAmount,
      });

      setPayModalOpen(false);
      setPayStudent(null);
      setManualAmount("");

      await Promise.all([loadPaymentsForDate(selectedDate), loadTotals(), loadAccounts()]);
      setMsg("Fees payment recorded.");
    } catch (e) {
      setMsg(e?.message || "Failed to record payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 overflow-hidden rounded-2xl bg-linear-to-r from-amber-600 via-orange-500 to-rose-500 p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Accounts Dashboard</h1>
              <p className="mt-1 text-sm text-white/80">{profile?.fullName || user?.email}</p>
            </div>
            <div className="flex items-center gap-3">
              <LanguageSwitcher />
              <button
                onClick={() => signOut(auth)}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                {t("signOut")}
              </button>
            </div>
          </div>
        </div>

        {/* Holiday Banner or Daily Finance Quote */}
        {holidayName ? (
          <div className="mb-6 rounded-2xl border border-amber-300 bg-linear-to-r from-amber-50 to-yellow-50 px-5 py-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-2xl">🎉</div>
              <div>
                <div className="text-lg font-bold text-amber-700">Today is a Public Holiday!</div>
                <div className="mt-1 text-base font-semibold text-amber-800">{holidayName}</div>
                <div className="mt-1 text-sm text-amber-700">Enjoy your day off, accounts team!</div>
              </div>
            </div>
          </div>
        ) : dailyQuote ? (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-linear-to-r from-amber-50 to-orange-50 px-5 py-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xl">💰</div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wide text-amber-700">{dailyQuote.greeting}</div>
                <p className="mt-2 text-sm font-medium italic text-slate-800">"{dailyQuote.quote}"</p>
                <p className="mt-1 text-xs text-slate-500">— {dailyQuote.author}</p>
                <p className="mt-2 text-xs text-amber-600">Keep the books balanced and the school running! 📊</p>
              </div>
            </div>
          </div>
        ) : null}

        {msg ? (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
            {msg}
          </div>
        ) : null}

        {/* Controls */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-indigo-200 bg-linear-to-br from-indigo-50 to-violet-50 p-6 shadow-sm border-l-4 border-l-indigo-400">
            <h2 className="text-base font-semibold text-indigo-900">Daily Codes (Per Staff)</h2>

            <div className="mt-3 text-sm text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-600">Code date</span>
                <span className="font-semibold">{dailyCodes?.date || "—"}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="text-slate-600">Expires</span>
                <span className="font-semibold">{minutesToHHMM(school?.codeExpiresMinutes ?? 380)}</span>
              </div>
            </div>

            {dailyCodes?.codes ? (
              <div className="mt-4 max-h-48 overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-slate-600">Staff</th>
                      <th className="px-3 py-2 text-right font-medium text-slate-600">Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staffList
                      .filter((t) => dailyCodes.codes[t.id])
                      .sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""))
                      .map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-slate-800">{t.fullName || t.id}</td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-slate-900">
                            {dailyCodes.codes[t.id]}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">No codes generated yet.</p>
            )}
          </div>

          <div className="rounded-2xl border border-teal-200 bg-linear-to-br from-teal-50 to-emerald-50 p-5 shadow-sm border-l-4 border-l-teal-400">
            <div className="text-xs font-semibold text-teal-700">Date</div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              disabled={busy}
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50"
            />
           
          </div>

          <div className="rounded-2xl border border-sky-200 bg-linear-to-br from-sky-50 to-cyan-50 p-5 shadow-sm md:col-span-2 border-l-4 border-l-sky-400">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold text-sky-700">Search students</div>
              <button
                disabled={busy}
                onClick={() => refresh(selectedDate)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
              >
                {busy ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student name, class, or plan..."
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring"
            />
          </div>
        </div>

        {/* Daily Totals */}
        <div className="mb-6 rounded-2xl border border-amber-200 bg-linear-to-br from-amber-50 to-orange-50 p-6 shadow-sm border-l-4 border-l-amber-400">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-base font-semibold text-amber-900">Daily Totals — {selectedDate}</h2>
            </div>
            <div className="text-sm text-slate-600">{payments.length} payments</div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-7">
            <Stat label="Feeding" value={`GHS ${dailyTotals.feeding}`} />
            <Stat label="Fees" value={`GHS ${dailyTotals.fees}`} />
            <Stat label="Classes" value={`GHS ${dailyTotals.classes}`} />
            <Stat label="Health & Maint." value={`GHS ${dailyTotals.healthMaintenance}`} />
            <Stat label="PTA" value={`GHS ${dailyTotals.pta}`} />
            <Stat label="Manual" value={`GHS ${dailyTotals.manual}`} />
            <Stat label="Grand Total" value={`GHS ${dailyTotals.grand}`} strong />
          </div>
        </div>

        {/* Manual Payment Modal */}
        {payModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Record Fees Payment</div>
                  <div className="mt-1 text-xs text-slate-600">
                    {payStudent?.fullName} — {getStudentBillingPlan(payStudent)}
                  </div>
                </div>
                <button
                  disabled={busy}
                  onClick={() => {
                    if (busy) return;
                    setPayModalOpen(false);
                    setPayStudent(null);
                    setManualAmount("");
                  }}
                  className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
              </div>

              <div className="mt-4">
                <label className="text-xs font-semibold text-slate-600">Fees Payment Amount (GHS)</label>
                <input
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  placeholder="e.g. 200"
                  disabled={busy}
                  inputMode="decimal"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:ring disabled:bg-slate-50"
                />
                <p className="mt-2 text-xs text-slate-500">This will reduce the student’s fees balance.</p>
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  disabled={busy}
                  onClick={submitManualPayment}
                  className="flex-1 rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
                >
                  {busy ? "Saving..." : "Save Payment"}
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    setPayModalOpen(false);
                    setPayStudent(null);
                    setManualAmount("");
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Students table */}
        <div className="rounded-2xl border border-emerald-200 bg-linear-to-br from-emerald-50/50 to-teal-50/50 p-6 shadow-sm border-l-4 border-l-emerald-400">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-emerald-900">Students</h2>
            <span className="text-sm text-slate-600">{filteredStudents.length} shown</span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="py-2">Student</th>
                  <th className="py-2">Class</th>
                  <th className="py-2">Plan</th>
                  <th className="py-2">Fees Due</th>
                  <th className="py-2">H&amp;M Due</th>
                  <th className="py-2">Total Due</th>
                  <th className="py-2">Paid (Fees+H&amp;M)</th>
                  <th className="py-2">Balance</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredStudents.length ? (
                  filteredStudents.map((stu) => {
                    const paidToday = paidByStudentPath.get(stu.studentPath);
                    const lifetime = totalsByStudentPath.get(stu.studentPath);

                    const account = accountsByStudentPath.get(stu.studentPath);
                    const due = computeDueFromStudent(stu);

                    const totalDue = Number(account?.totalDue ?? due.totalDue);
                    const paidFeesHM = Number(account?.totalPaidFeesHM ?? 0);
                    const balance = totalDue - paidFeesHM;

                    return (
                      <tr key={stu.id} className="border-t border-slate-200">
                        <td className="py-2 font-semibold text-slate-900">{stu.fullName || "—"}</td>
                        <td className="py-2 text-slate-700">{stu.className || "—"}</td>

                        <td className="py-2">
                          <select
                            value={String(stu.billingPlan || "DAILY").toUpperCase()}
                            disabled={busy}
                            onChange={async (e) => {
                              const nextPlan = e.target.value;
                              setMsg("");
                              setBusy(true);
                              try {
                                await updateStudentBillingPlan({
                                  classId: stu.classId,
                                  studentDocId: stu.studentDocId,
                                  billingPlan: nextPlan,
                                });

                                setStudents((prev) =>
                                  prev.map((x) =>
                                    x.studentPath === stu.studentPath ? { ...x, billingPlan: nextPlan } : x
                                  )
                                );
                              } catch (err) {
                                setMsg(err?.message || "Failed to update billing plan.");
                              } finally {
                                setBusy(false);
                              }
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                          >
                            <option value="DAILY">DAILY</option>
                            <option value="WEEKLY">WEEKLY</option>
                            <option value="MONTHLY">MONTHLY</option>
                            <option value="TERMLY">TERMLY</option>
                          </select>
                        </td>

                        <td className="py-2 text-slate-700">GHS {Number(account?.feesDue ?? due.feesDue)}</td>
                        <td className="py-2 text-slate-700">
                          GHS {Number(account?.healthMaintenanceDue ?? due.healthMaintenanceDue)}
                        </td>
                        <td className="py-2 font-semibold text-slate-900">GHS {totalDue}</td>

                        <td className="py-2 text-slate-700">GHS {paidFeesHM}</td>
                        <td className="py-2 font-semibold text-slate-900">GHS {balance}</td>

                        <td className="py-2 text-right">
                          {paidToday ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                              Paid Today
                            </span>
                          ) : (
                            <button
                              disabled={busy}
                              onClick={() => handleMarkPaid(stu)}
                              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
                            >
                              Mark Paid
                            </button>
                          )}

                          <div className="mt-2 text-[11px] text-slate-500">
                            Lifetime Paid: GHS {Number(lifetime?.totalPaid || 0)}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="py-6 text-slate-600" colSpan={9}>
                      {studentsLoading || busy ? "Loading..." : "No students found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-slate-500">Loaded: {students.length}</div>

            <button
              disabled={!studentsHasMore || studentsLoading || busy}
              onClick={() => loadMoreStudents(false)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
            >
              {studentsLoading ? "Loading..." : studentsHasMore ? "Load More" : "No More"}
            </button>
          </div>

          <p className="mt-3 text-xs text-slate-500">
            Due is based on ClassGroup: PRESCHOOL (340 + 60) and BASIC (300 + 60). Balance = Total Due - Paid (Fees+H&amp;M).
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, strong }) {
  return (
    <div className={[
      "rounded-xl border px-4 py-3",
      strong
        ? "border-amber-300 bg-amber-100"
        : "border-amber-200 bg-white/60",
    ].join(" ")}>
      <div className="text-xs font-semibold text-amber-700">{label}</div>
      <div className={["mt-1 font-semibold", strong ? "text-lg text-amber-900" : "text-base text-slate-900"].join(" ")}>
        {value}
      </div>
    </div>
  );
}
