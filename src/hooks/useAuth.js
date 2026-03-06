import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u ?? null);

      if (!u) {
        setProfile(null);
        setInitializing(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        setProfile(snap.exists() ? snap.data() : null);
      } catch (e) {
        console.error("Failed to load profile:", e);
        setProfile(null);
      } finally {
        setInitializing(false);
      }
    });

    return () => unsub();
  }, []);

  return { user, profile, initializing };
}
