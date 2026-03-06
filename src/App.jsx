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
  const { user, initializing, profile } = useAuth();

  // Dismiss splash once auth is resolved
  useEffect(() => {
    if (!initializing) dismissSplash();
  }, [initializing]);

  return initializing ? null : !user ? (
    <AuthPage />
  ) : profile?.role === "ADMIN" ? (
    <AdminDashboard profile={profile} />
  ) : profile?.role === "TEACHER" ? (
    <TeacherDashboard profile={profile} />
  ) : profile?.role === "ACCOUNTS" ? (
    <BursaryDashboard profile={profile} />
  ) : (
    <NonTeacherDashboard profile={profile} />
  );
}
