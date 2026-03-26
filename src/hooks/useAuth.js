import { useEffect, useState, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

const ACTIVE_ROLE_KEY = "activeRole";

/** Derive the roles array from a user profile (supports both `roles` array and legacy `role` string). */
function deriveRoles(profile) {
  if (!profile) return [];
  if (Array.isArray(profile.roles) && profile.roles.length > 0) return profile.roles;
  if (profile.role) return [profile.role];
  return ["TEACHER"];
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [activeRole, setActiveRoleState] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u ?? null);

      if (!u) {
        setProfile(null);
        setActiveRoleState(null);
        setInitializing(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        const data = snap.exists() ? snap.data() : null;
        setProfile(data);

        const roles = deriveRoles(data);
        const saved = localStorage.getItem(ACTIVE_ROLE_KEY);
        // Use saved role if it's still valid for this user, otherwise first role
        setActiveRoleState(saved && roles.includes(saved) ? saved : roles[0]);
      } catch (e) {
        console.error("Failed to load profile:", e);
        setProfile(null);
      } finally {
        setInitializing(false);
      }
    });

    return () => unsub();
  }, []);

  const roles = deriveRoles(profile);

  const switchRole = useCallback(
    (newRole) => {
      if (roles.includes(newRole)) {
        setActiveRoleState(newRole);
        localStorage.setItem(ACTIVE_ROLE_KEY, newRole);
      }
    },
    [roles],
  );

  return { user, profile, initializing, roles, activeRole, switchRole };
}
