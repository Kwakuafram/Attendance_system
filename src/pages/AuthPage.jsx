import { useMemo, useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth } from "../firebase";
import toast from "react-hot-toast";


function FirebaseError({ code }) {
  const msg = useMemo(() => {
    if (!code) return null;
    switch (code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
        return "Invalid email or password.";
      case "auth/user-not-found":
        return "No account found with that email.";
      case "auth/email-already-in-use":
        return "That email is already in use.";
      case "auth/weak-password":
        return "Password is too weak. Use at least 6 characters.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/popup-closed-by-user":
        return "Popup closed before sign-in completed.";
      default:
        return "Authentication failed. Please try again.";
    }
  }, [code]);

  if (!msg) return null;

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {msg}
      <div className="mt-1 text-xs text-red-600 opacity-80">{code}</div>
    </div>
  );
}

export default function AuthPage() {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errCode, setErrCode] = useState("");

  const [busy, setBusy] = useState(false);


 async function handleEmailAuth(e) {
  e.preventDefault();
  setErrCode("");
 
  toast.dismiss();
  setBusy(true);

  try {
    if (mode === "signup") {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (fullName.trim()) {
        await updateProfile(cred.user, { displayName: fullName.trim() });
      }
      toast.success("Account created successfully.");
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Signed in successfully.");
    }
  } catch (err) {
    setErrCode(err?.code || "auth/unknown");
    toast.error("Authentication failed. Please try again.");
  } finally {
    setBusy(false);
  }
}

async function handleGoogleSignIn() {
  setErrCode("");
  
  toast.dismiss();
  setBusy(true);

  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    toast.success("Signed in with Google.");
  } catch (err) {
    setErrCode(err?.code || "auth/unknown");
    toast.error("Google sign-in failed.");
  } finally {
    setBusy(false);
  }
}

async function handleSignOut() {
  setErrCode("");
 
  toast.dismiss();
  setBusy(true);

  try {
    await signOut(auth);
    toast.success("Signed out.");
  } catch (err) {
    setErrCode(err?.code || "auth/unknown");
    toast.error("Sign out failed.");
  } finally {
    setBusy(false);
  }
}


 
  const isSignup = mode === "signup";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4">
        <div className="grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:grid-cols-2">
          {/* Left panel */}
          <div className="hidden bg-linear-to-br from-slate-900 to-slate-700 p-10 text-white md:block">
            <div className="text-sm font-medium tracking-wide text-slate-200">
              Teacher Attendance
            </div>
            <h1 className="mt-3 text-3xl font-semibold leading-tight">
              Secure sign-in for daily check-in and check-out.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-slate-200">
              This MVP uses Firebase Authentication and restricts attendance actions
              to the school premises via geofencing.
            </p>

            <div className="mt-10 space-y-3 text-sm text-slate-200">
              <div className="flex items-start gap-3">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />
                <div>On-time cutoff: 06:15 (Africa/Accra)</div>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />
                <div>Late penalty: GHS 5 per late day</div>
              </div>
              <div className="flex items-start gap-3">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />
                <div>Monthly deduction summary in dashboard</div>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="p-6 sm:p-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {isSignup ? "Create an account" : "Sign in"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {isSignup
                    ? "Use your school email address to create an account."
                    : "Welcome back. Please sign in to continue."}
                </p>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={busy}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                title="Sign out (if already signed in)"
              >
                Sign out
              </button>
            </div>

           

            {errCode && <FirebaseError code={errCode} />}

            <form onSubmit={handleEmailAuth} className="mt-6 space-y-4">
              {isSignup ? (
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Full name
                  </label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    placeholder="e.g., Ama Mensah"
                    autoComplete="name"
                  />
                </div>
              ) : null}

              <div>
                <label className="text-sm font-medium text-slate-700">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  placeholder="teacher@school.com"
                  autoComplete="email"
                  type="email"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Password
                </label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  placeholder="••••••••"
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  type="password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {busy ? "Please wait..." : isSignup ? "Create account" : "Sign in"}
              </button>

              <div className="relative py-2">
                <div className="h-px w-full bg-slate-200" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="bg-white px-3 text-xs text-slate-500">OR</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={busy}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              >
                Continue with Google
              </button>
            </form>

            <div className="mt-6 text-sm text-slate-600">
              {isSignup ? (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="font-semibold text-slate-900 hover:underline"
                  >
                    Sign in
                  </button>
                </>
              ) : (
                <>
                  New teacher?{" "}
                  <button
                    type="button"
                    onClick={() => setMode("signup")}
                    className="font-semibold text-slate-900 hover:underline"
                  >
                    Create an account
                  </button>
                </>
              )}
            </div>

            <p className="mt-6 text-xs leading-relaxed text-slate-500">
              By continuing, you agree to use this system for official attendance
              tracking. Location permission is required for check-in/out actions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
