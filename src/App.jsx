import { useEffect } from "react";
import AuthPage from "./pages/AuthPage";
import TeacherDashboard from "./pages/TeacherDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import NonTeacherDashboard from "./pages/NonTeacherDashboard";
import { useAuth } from "./hooks/useAuth";
import BursaryDashboard from "./pages/BursaryDashboard";

function dismissSplash() {
  const el = document.getElementById("splash");
  if (el) {
    el.classList.add("hide");
    setTimeout(() => el.remove(), 600);
  }
}

export default function App() {
  const { user, initializing, profile, roles, activeRole, switchRole } = useAuth();

  // Dismiss splash once auth is resolved
  useEffect(() => {
    if (!initializing) dismissSplash();
  }, [initializing]);

  if (initializing) return null;
  if (!user) return <AuthPage />;

  const roleProps = { profile, roles, activeRole, switchRole };

  switch (activeRole) {
    case "ADMIN":
      return <AdminDashboard {...roleProps} />;
    case "TEACHER":
      return <TeacherDashboard {...roleProps} />;
    case "ACCOUNTS":
      return <BursaryDashboard {...roleProps} />;
    default:
      return <NonTeacherDashboard {...roleProps} />;
  }
}
