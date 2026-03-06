import { useEffect, useState, useCallback } from "react";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebase";
import { distanceMeters, getBrowserLocation } from "../utils/geo";

export function useSchoolGeofence() {
  const [school, setSchool] = useState(null);
  const [loadingSchool, setLoadingSchool] = useState(true);
  const [schoolError, setSchoolError] = useState("");

  useEffect(() => {
    let cancelled = false;

    // 🔑 WAIT FOR AUTH FIRST
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoadingSchool(false);
        setSchoolError("Not signed in.");
        return;
      }

      try {
        setLoadingSchool(true);
        setSchoolError("");

        const snap = await getDoc(doc(db, "school", "main"));

        if (!snap.exists()) {
          throw new Error("Missing Firestore doc: school/main");
        }

        const data = snap.data();

        if (typeof data.lat !== "number") throw new Error("school.lat must be a number");
        if (typeof data.lng !== "number") throw new Error("school.lng must be a number");
        if (typeof data.radiusMeters !== "number")
          throw new Error("school.radiusMeters must be a number");

        if (!cancelled) setSchool(data);
      } catch (e) {
        console.error("Failed to load school:", e);
        if (!cancelled) setSchoolError(e.message);
      } finally {
        if (!cancelled) setLoadingSchool(false);
      }
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

 const checkOnCampus = useCallback(async () => {
  if (loadingSchool) return { ok: false, reason: "School location loading…" };
  if (schoolError) return { ok: false, reason: schoolError };
  if (!school) return { ok: false, reason: "School not available." };

let pos;
try {
  pos = await getBrowserLocation();
} catch (e) {
  return { ok: false, reason: e.message || "Failed to get location." };
}

  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  const accuracyM = pos.coords.accuracy;

  const d = distanceMeters(lat, lng, school.lat, school.lng);

  console.log("Geo debug:", {
    lat,
    lng,
    accuracyM,
    distanceM: Math.round(d),
    schoolLat: school.lat,
    schoolLng: school.lng,
    radiusMeters: school.radiusMeters,
  });

  // ✅ Accuracy gate (prevents false failures on laptops / poor GPS)
  const MAX_ACCURACY_M = 150;
  if (accuracyM > MAX_ACCURACY_M) {
    return {
      ok: false,
      reason: `Location accuracy too low (${Math.round(
        accuracyM
      )}m). Turn on GPS or use a mobile device.`,
      accuracyM,
      distanceM: d,
    };
  }

  if (d <= school.radiusMeters) {
    return { ok: true, lat, lng, accuracyM, distanceM: d };
  }

  return {
    ok: false,
    reason: `You must be on school premises. You are ~${Math.round(
      d
    )}m away (radius ${school.radiusMeters}m).`,
    accuracyM,
    distanceM: d,
  };
}, [loadingSchool, schoolError, school]);


  return { school, loadingSchool, schoolError, checkOnCampus };
}
