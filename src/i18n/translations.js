/**
 * translations.js – EN / Twi / Ga translations for Attendance App
 *
 * Usage:  t("dashboard")  →  "Dashboard" | "Dashboɔd" | "Dashboard"
 *
 * Only common UI labels are translated. Add more keys as needed.
 */

const translations = {
  // ─── General ──────────────────────────────────────────
  appName:          { en: "Attendance App",     twi: "Attendance App",      ga: "Attendance App" },
  dashboard:        { en: "Dashboard",          twi: "Dashboɔd",           ga: "Dashboard" },
  welcome:          { en: "Welcome",            twi: "Akwaaba",            ga: "Ojekoo" },
  logout:           { en: "Sign Out",           twi: "Fi mu",              ga: "Pu kɛ" },
  loading:          { en: "Loading...",         twi: "Ɛrekɔ so...",        ga: "Eloading..." },
  save:             { en: "Save",               twi: "Kora",               ga: "Tswa" },
  cancel:           { en: "Cancel",             twi: "Gyae",               ga: "Baa" },
  submit:           { en: "Submit",             twi: "De kɔ",              ga: "Ha kɛ" },
  delete:           { en: "Delete",             twi: "Pepa mu",            ga: "Fɛɛ" },
  edit:             { en: "Edit",               twi: "Sesa",               ga: "Hala" },
  close:            { en: "Close",              twi: "To mu",              ga: "Kɛ" },
  yes:              { en: "Yes",                twi: "Aane",               ga: "Hɛɛ" },
  no:               { en: "No",                 twi: "Dabi",               ga: "Mɔ" },
  search:           { en: "Search",             twi: "Hwehwɛ",             ga: "Fɛɛ" },
  refresh:          { en: "Refresh",            twi: "Freshe",             ga: "Shi fɛɛ" },
  back:             { en: "Back",               twi: "San kɔ",             ga: "Yɛ kɛ" },

  // ─── Auth ─────────────────────────────────────────────
  signIn:           { en: "Sign In",            twi: "Bra mu",             ga: "Ba mu" },
  email:            { en: "Email",              twi: "Email",              ga: "Email" },
  password:         { en: "Password",           twi: "Nkɔmhyɛ nsɛm",     ga: "Password" },
  forgotPassword:   { en: "Forgot Password?",   twi: "Wo werɛ afi password?", ga: "Password efee?" },

  // ─── Attendance ───────────────────────────────────────
  attendance:       { en: "Attendance",         twi: "Ahɔba",              ga: "Attendance" },
  checkIn:          { en: "Check In",           twi: "Bra mu",             ga: "Ba mu" },
  checkOut:         { en: "Check Out",          twi: "Fi mu",              ga: "Pu kɛ" },
  present:          { en: "Present",            twi: "Ɛwɔ hɔ",            ga: "Enɔ" },
  absent:           { en: "Absent",             twi: "Ɛnni hɔ",           ga: "Enɔ mli" },
  late:             { en: "Late",               twi: "Atwetwam",           ga: "Ebi shwee" },
  onTime:           { en: "On Time",            twi: "Ɛberɛ mu",          ga: "Lɛ time ji" },
  pending:          { en: "Pending",            twi: "Ɛretwɛn",           ga: "Etwɛn" },
  approved:         { en: "Approved",           twi: "Agyedie",           ga: "Fɛɛ nɔ" },
  rejected:         { en: "Rejected",           twi: "Apo",               ga: "Mɔ fɛɛ" },
  dailyCode:        { en: "Daily Code",         twi: "Ɛda Koodu",         ga: "Gbɛ Koodu" },
  enterCode:        { en: "Enter today's code", twi: "Hyɛ ɛnnɛ koodu",    ga: "Shi enyɔ koodu" },

  // ─── Teacher ──────────────────────────────────────────
  teacher:          { en: "Teacher",            twi: "Ɔkyerɛkyerɛfo",     ga: "Teacher" },
  teachers:         { en: "Teachers",           twi: "Akyerɛkyerɛfo",     ga: "Teachersii" },
  profile:          { en: "Profile",            twi: "Wo ho nsɛm",        ga: "Profile" },
  calendar:         { en: "Calendar",           twi: "Kalɛnda",           ga: "Calendar" },
  leave:            { en: "Leave",              twi: "Kwan",              ga: "Fashi" },
  leaveRequest:     { en: "Leave Request",      twi: "Kwan abisadeɛ",     ga: "Fashi bɔ" },
  requestLeave:     { en: "Request Leave",      twi: "Bisa kwan",         ga: "Bɔ fashi" },
  leaveType:        { en: "Leave Type",         twi: "Kwan akyedeɛ",      ga: "Fashi type" },
  startDate:        { en: "Start Date",         twi: "Mfitiaseɛ da",      ga: "Lɛ start gbɛ" },
  endDate:          { en: "End Date",           twi: "Awieeɛ da",         ga: "Lɛ end gbɛ" },
  reason:           { en: "Reason",             twi: "Nkyerɛaseɛ",        ga: "Suɔmɔ" },

  // ─── Admin ────────────────────────────────────────────
  admin:            { en: "Admin",              twi: "Admin",              ga: "Admin" },
  overview:         { en: "Overview",           twi: "Nhwɛsoɔ",           ga: "Overview" },
  classes:          { en: "Classes",            twi: "Nkrataa",            ga: "Classes" },
  students:         { en: "Students",           twi: "Asuafo",             ga: "Sukuubihi" },
  finance:          { en: "Finance",            twi: "Sika ho",            ga: "Shika" },
  reports:          { en: "Reports",            twi: "Amanneɛbɔ",         ga: "Reports" },
  payroll:          { en: "Payroll",            twi: "Akatua",             ga: "Shika boa" },
  notifications:    { en: "Notifications",      twi: "Nkra",              ga: "Amanehelɔ" },
  auditLog:         { en: "Audit Log",          twi: "Nhwehwɛmu nsɛm",    ga: "Audit Log" },
  tests:            { en: "Tests",              twi: "Nsɔhwɛ",            ga: "Tests" },

  // ─── Finance ──────────────────────────────────────────
  fees:             { en: "Fees",               twi: "Akatua",             ga: "Feesii" },
  bursary:          { en: "Bursary",            twi: "Mmoa sika",          ga: "Bursary" },
  receipt:          { en: "Receipt",            twi: "Asieda krataa",      ga: "Receipt" },
  amount:           { en: "Amount",             twi: "Sika dodow",         ga: "Shika dodow" },
  paid:             { en: "Paid",               twi: "Atua",              ga: "Etuaa" },

  // ─── Days / Time ──────────────────────────────────────
  today:            { en: "Today",              twi: "Ɛnnɛ",              ga: "Enyɔ" },
  yesterday:        { en: "Yesterday",          twi: "Ɛnnora",            ga: "Anyɛ" },
  monday:           { en: "Monday",             twi: "Dwoada",             ga: "Juu" },
  tuesday:          { en: "Tuesday",            twi: "Benada",             ga: "Dzuu" },
  wednesday:        { en: "Wednesday",          twi: "Wukuada",            ga: "Shoo" },
  thursday:         { en: "Thursday",           twi: "Yawoada",            ga: "Soo" },
  friday:           { en: "Friday",             twi: "Fiada",              ga: "Hoo" },
  saturday:         { en: "Saturday",           twi: "Memeneda",           ga: "Hɔgba" },
  sunday:           { en: "Sunday",             twi: "Kwasiada",           ga: "Hɔgbaa" },

  // ─── Misc / Feedback ─────────────────────────────────
  noData:           { en: "No data available.",  twi: "Nsɛm biara nni hɔ.", ga: "Data biara nni." },
  success:          { en: "Success!",           twi: "Eye!",              ga: "Eye!" },
  error:            { en: "Something went wrong.", twi: "Biribi akɔ basaa.", ga: "Biribi akɔ basaa." },
  confirm:          { en: "Are you sure?",       twi: "Wo ani gye ho?",     ga: "Enyɛ?" },
  blocked:          { en: "Blocked",             twi: "Wɔasiw no kwan",    ga: "Blocked" },
  unblock:          { en: "Unblock",             twi: "Yi kwan siw",       ga: "Unblock" },
};

export default translations;
