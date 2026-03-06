import { useEffect, useState } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

import TeacherDashboard from "./pages/TeacherDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AuthPage from "./pages/AuthPage"; // your login/signup page
import { ensureUserProfile } from "./services/userService";

// inside onAuthStateChanged:



export default function AppRouter() {
const [user, setUser] = useState(null);
const [role, setRole] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setRole(null);
      if (!u) {
        setLoading(false);
        return;
      }

      const snap = await getDoc(doc(db, "users", u.uid));
      if (snap.exists()) {
        setRole(snap.data().role || "TEACHER");
      } else {
        const profile = await ensureUserProfile({ uid: u.uid, email: u.email });
        setRole(profile.role || "TEACHER");
      }

      setLoading(false);
    });

    return () => unsub();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  if (!user) return <AuthPage />;

  return role === "ADMIN" ? <AdminDashboard /> : <TeacherDashboard />;
}
