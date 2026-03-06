function safe(v) {
  return String(v ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function money(n) {
  const x = Number(n ?? 0);
  return Number.isFinite(x) ? x.toFixed(2) : "0.00";
}

function teacherSlip(summary, opts = {}) {
  const schoolName = opts.schoolName || "School";
  const cur = safe(summary.currency || "GHS");

  return `
    <section class="page">
      <h2 style="margin-bottom:8px">${safe(schoolName)} – Payroll Slip</h2>

      <p><b>Teacher:</b> ${safe(summary.teacherName)}</p>
      <p><b>Month:</b> ${safe(summary.monthName)} (${safe(summary.monthKey)})</p>

      <hr />

      <table style="width:100%; font-size:14px; margin-top:10px">
        <tr><td>Base Salary</td><td style="text-align:right">${cur} ${money(summary.baseSalary)}</td></tr>
        <tr><td>Late Penalty</td><td style="text-align:right">${cur} ${money(summary.totalLatePenalty)}</td></tr>
        <tr><td>SSNIT (5.5%)</td><td style="text-align:right">${cur} ${money(summary.ssnit)}</td></tr>
        <tr><td>Welfare</td><td style="text-align:right">${cur} ${money(summary.welfare)}</td></tr>
      </table>

      <h4 style="margin-top:14px">Other Deductions</h4>
      ${
        Array.isArray(summary.otherDeductions) && summary.otherDeductions.length
          ? `<ul>${summary.otherDeductions
              .map((d) => `<li>${safe(d.label)}: ${cur} ${money(d.amount)}</li>`)
              .join("")}</ul>`
          : `<p>None</p>`
      }

      <hr />

      <h3 style="text-align:right">
        Net Salary: ${cur} ${money(summary.netSalary)}
      </h3>
    </section>
  `;
}

export function printPayrollPdf({ summaries, schoolName, targetWindow }) {
  const list = Array.isArray(summaries) ? summaries : [];
  if (!list.length) throw new Error("No payroll summaries to print.");

  const title = `Payroll_${list[0]?.monthKey || ""}`;
  const pages = list.map((s) => teacherSlip(s, { schoolName })).join("");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${safe(title)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { font-family: Arial, sans-serif; color: #111; }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  </style>
</head>
<body>
  ${pages}
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        window.focus();
        window.print();
      }, 250);
    });
  </script>
</body>
</html>`;

  // ✅ Use existing window if passed
  const w = targetWindow || window.open("", "_blank", "width=1000,height=800");
  if (!w) throw new Error("Popup blocked. Please allow popups for this site, then try again.");

  w.document.open();
  w.document.write(html);
  w.document.close();
  try { w.focus(); } catch (_) {}
}
