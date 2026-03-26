const ROLE_META = {
  ADMIN:       { label: "Admin",       icon: "🛡️" },
  TEACHER:     { label: "Teacher",     icon: "📚" },
  ACCOUNTS:    { label: "Accounts",    icon: "💰" },
  NON_TEACHER: { label: "Staff",       icon: "👤" },
};

export default function RoleSwitcher({ roles, activeRole, onSwitch }) {
  // Don't render if user has only one role
  if (!roles || roles.length < 2) return null;

  // Cycle to the next role on click
  const currentIdx = roles.indexOf(activeRole);
  const nextRole = roles[(currentIdx + 1) % roles.length];
  const current = ROLE_META[activeRole] || { label: activeRole, icon: "👤" };
  const next = ROLE_META[nextRole] || { label: nextRole, icon: "👤" };

  return (
    <button
      onClick={() => onSwitch(nextRole)}
      title={`Switch to ${next.label}`}
      className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
    >
      <span className="text-base">{current.icon}</span>
      <span className="hidden sm:inline">{current.label}</span>
      <span className="text-white/50">⇄</span>
    </button>
  );
}
