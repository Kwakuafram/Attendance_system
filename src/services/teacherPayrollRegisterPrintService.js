// src/services/teacherPayrollRegisterPrintService.js

function safe(v) {
  return String(v ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function money(n) {
  const x = Number(n ?? 0);
  return Number.isFinite(x) ? x.toFixed(2) : "0.00";
}

function fmtDate(d = new Date()) {
  try {
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch (_) {
    return String(d);
  }
}

function normalizeSummary(s) {
  const base = Number(s?.baseSalary ?? 0) || 0;
  const penalty = Number(s?.totalLatePenalty ?? 0) || 0;
  const welfare = Number(s?.welfare ?? 0) || 0;
  const other = Number(s?.otherDeductionsTotal ?? 0) || 0;
  const ssnit = Number(s?.ssnit ?? 0) || 0;

  // Total deductions: if backend sends it, respect it; else compute
  const totalDeductions =
    Number.isFinite(Number(s?.totalDeductions))
      ? Number(s.totalDeductions)
      : penalty + welfare + other + ssnit;

  // Net: prefer backend computed value; else compute safely
  const net =
    Number.isFinite(Number(s?.netSalary))
      ? Number(s.netSalary)
      : Math.max(0, base - totalDeductions);

  return {
    ...s,
    baseSalary: base,
    totalLatePenalty: penalty,
    welfare,
    otherDeductionsTotal: other,
    ssnit,
    totalDeductions,
    netSalary: net,
  };
}

function registerRowHtml(s, i, cur) {
  const teacher = safe(s.teacherName || s.fullName || s.email || "—");

  // These can come from summary OR attached teacher object
  const bankName = safe(s.bankName || s.teacherBankName || s.teacher?.bankName || "—");
  const bankAcc = safe(
    s.bankAccountNumber ||
      s.teacherBankAccountNumber ||
      s.teacher?.bankAccountNumber ||
      "—"
  );
  const ssnitNo = safe(s.ssnitNumber || s.teacherSsnitNumber || s.teacher?.ssnitNumber || "—");

  // IMPORTANT: match screenshot column order:
  // Base, Penalty, SSNIT, Welfare, Other, Net Pay
  return `
    <tr>
      <td class="c">${i + 1}</td>
      <td class="name">${teacher}</td>
      <td>${bankName}</td>
      <td class="mono">${bankAcc}</td>
      <td class="mono">${ssnitNo}</td>

      <td class="r">${cur} ${money(s.baseSalary)}</td>
      <td class="r">${cur} ${money(s.totalLatePenalty)}</td>
      <td class="r">${cur} ${money(s.ssnit)}</td>
      <td class="r">${cur} ${money(s.welfare)}</td>
      <td class="r">${cur} ${money(s.otherDeductionsTotal)}</td>
      <td class="r strong">${cur} ${money(s.netSalary)}</td>
    </tr>
  `;
}

function buildRegisterHtml({
  summaries,
  schoolName,
  monthKey,
  monthName,
  currency,
  preparedBy,
  preparedAt,
}) {
  const rows = (Array.isArray(summaries) ? summaries : []).map((s) => normalizeSummary(s));
  if (!rows.length) throw new Error("No teacher payroll summaries to print.");

  const cur = safe(currency || rows?.[0]?.currency || "GHS");

  const totals = rows.reduce(
    (acc, s) => {
      acc.totalBase += Number(s.baseSalary ?? 0) || 0;
      acc.totalPenalty += Number(s.totalLatePenalty ?? 0) || 0;
      acc.totalWelfare += Number(s.welfare ?? 0) || 0;
      acc.totalOther += Number(s.otherDeductionsTotal ?? 0) || 0;
      acc.totalSsnit += Number(s.ssnit ?? 0) || 0;
      acc.totalDeductions += Number(s.totalDeductions ?? 0) || 0;
      acc.totalNet += Number(s.netSalary ?? 0) || 0;
      return acc;
    },
    {
      totalBase: 0,
      totalPenalty: 0,
      totalWelfare: 0,
      totalOther: 0,
      totalSsnit: 0,
      totalDeductions: 0,
      totalNet: 0,
    }
  );

  // matches screenshot: Total Deductions (Excl. SSNIT)
  const totalDeductExclSsnit =
    (Number(totals.totalDeductions) || 0) - (Number(totals.totalSsnit) || 0);

  const title = `Teachers_Payroll_Register_${monthKey || ""}`;

  // Screenshot-style footer: blank signature lines
  const preparedByLine = preparedBy ? safe(preparedBy) : "";
  const dateLine = preparedAt ? safe(preparedAt) : fmtDate(new Date());

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${safe(title)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    body { font-family: Arial, sans-serif; color: #111; }
    .wrap { width: 100%; }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
    }

    .h-title { margin: 0; font-size: 18px; font-weight: 800; }
    .h-sub { margin-top: 4px; font-size: 12px; color: #333; }

    .totals {
      text-align: right;
      font-size: 13px;
      line-height: 1.4;
      min-width: 260px;
    }
    .totals .label { font-weight: 700; }
    .totals .row { margin: 2px 0; }
    .totals .value { font-weight: 800; }

    .hr { border-top: 1px solid #ddd; margin: 10px 0 12px; }

    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: 7px 8px; font-size: 11px; vertical-align: top; }
    th { background: #f6f6f6; text-align: left; font-weight: 700; }
    .c { text-align: center; width: 40px; }
    .r { text-align: right; white-space: nowrap; }
    .name { min-width: 220px; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 10.5px; }
    .strong { font-weight: 800; }

    .footer {
      margin-top: 18px;
      display: flex;
      justify-content: space-between;
      gap: 24px;
      font-size: 12px;
    }
    .line {
      display: inline-block;
      min-width: 260px;
      border-bottom: 1px solid #111;
      transform: translateY(-2px);
    }

    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
</head>
<body>
  <div class="wrap">

    <div class="header">
      <div>
        <div class="h-title">${safe(schoolName || "School")} — Teachers Payroll Register</div>
        <div class="h-sub">Month: ${safe(monthKey || "")}${monthName ? ` (${safe(monthName)})` : ""}</div>
      </div>

      <div class="totals">
        <div class="label">Totals</div>
        <div class="row">Total Net Pay: <span class="value">${cur} ${money(totals.totalNet)}</span></div>
        <div class="row">Total Deductions (Excl. SSNIT): <span class="value">${cur} ${money(
          totalDeductExclSsnit
        )}</span></div>
        <div class="row">Total Penalty (Late): <span class="value">${cur} ${money(
          totals.totalPenalty
        )}</span></div>
        <div class="row">Total SSNIT: <span class="value">${cur} ${money(totals.totalSsnit)}</span></div>
      </div>
    </div>

    <div class="hr"></div>

    <table>
      <thead>
        <tr>
          <th class="c">#</th>
          <th class="name">Teacher</th>
          <th>Bank</th>
          <th>Account No.</th>
          <th>SSNIT No.</th>

          <th class="r">Base</th>
          <th class="r">Penalty</th>
          <th class="r">SSNIT</th>
          <th class="r">Welfare</th>
          <th class="r">Other</th>
          <th class="r">Net Pay</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((s, i) => registerRowHtml(s, i, cur)).join("")}
      </tbody>
    </table>

    <div class="footer">
      <div>
        Prepared by: <span class="line"></span>
        ${preparedByLine ? `&nbsp;&nbsp;(${preparedByLine})` : ""}
      </div>
      <div>
        Date: <span class="line"></span>
        ${dateLine ? `&nbsp;&nbsp;(${dateLine})` : ""}
      </div>
    </div>
  </div>

  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        try { window.focus(); } catch (e) {}
        window.print();
      }, 250);
    });
  </script>
</body>
</html>`;
}

/**
 * Main export: prints the register.
 * - preparedBy: name/email of admin (optional)
 * - preparedAt: defaults to today's date (optional)
 * - targetWindow: pass an already-opened window to avoid popup blocking
 */
export function printTeacherPayrollRegisterPdf({
  summaries,
  schoolName,
  monthKey,
  monthName,
  currency,
  preparedBy,
  preparedAt,
  targetWindow,
}) {
  const html = buildRegisterHtml({
    summaries,
    schoolName,
    monthKey,
    monthName,
    currency,
    preparedBy,
    preparedAt,
  });

  const w = targetWindow || window.open("", "_blank", "width=1200,height=800");
  if (!w) throw new Error("Popup blocked. Please allow popups for this site, then try again.");

  w.document.open();
  w.document.write(html);
  w.document.close();
  try {
    w.focus();
  } catch (_) {}
}

/**
 * Backward-compatible alias.
 * If any file imports `printTeacherPayrollRegister`, it will still work.
 */
export function printTeacherPayrollRegister(args) {
  return printTeacherPayrollRegisterPdf(args);
}
