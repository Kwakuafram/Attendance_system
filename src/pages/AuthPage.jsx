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
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="min-h-screen bg-linear-to-br from-fuchsia-100 via-sky-100 to-emerald-100 flex items-center justify-center py-8 px-2">
      <div className="w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 bg-white grid grid-cols-1 md:grid-cols-2 overflow-hidden">
        {/* Left panel */}
        <div className="hidden md:flex flex-col justify-center items-center bg-linear-to-br from-fuchsia-600 to-sky-500 p-10 text-white relative">
          <div className="absolute top-6 left-6 text-lg font-bold tracking-wide opacity-80 select-none">GREENIDGE INT. SCHOOL</div>
          <div className="flex-1 flex flex-col justify-center items-center">
            <h1 className="text-4xl font-extrabold mb-4 drop-shadow-lg">Welcome Back!</h1>
            <p className="text-lg mb-6 text-fuchsia-100/90 max-w-xs text-center">Sign in to mark your attendance, view reports, and manage your school day securely.</p>
          
          </div>
          <div className="absolute bottom-6 left-6 text-xs text-fuchsia-100/60">Powered by Firebase</div>
        </div>

        {/* Right panel */}
        <div className="p-8 sm:p-12 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">
              {isSignup ? "Create an account" : "Sign in"}
            </h2>
            <p className="text-sm text-slate-500">
              {isSignup
                ? "Use your school email address to create an account."
                : "Welcome back. Please sign in to continue."}
            </p>
          </div>

          {errCode && <FirebaseError code={errCode} />}

          <form onSubmit={handleEmailAuth} className="space-y-5">
            {isSignup && (
              <div>
                <label className="text-sm font-medium text-slate-700">Full name</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200"
                  placeholder="e.g., Ama Mensah"
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200"
                placeholder="teacher@school.com"
                autoComplete="email"
                type="email"
                required
              />
            </div>

            <div className="relative">
              <label className="text-sm font-medium text-slate-700">Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-200 pr-12"
                placeholder="••••••••"
                autoComplete={isSignup ? "new-password" : "current-password"}
                type={showPassword ? "text" : "password"}
                required
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute right-3 top-9 text-fuchsia-500 hover:text-fuchsia-700 text-xl focus:outline-none"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <span role="img" aria-label="Hide">🙈</span>
                ) : (
                  <span role="img" aria-label="Show">👁️</span>
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-linear-to-r from-fuchsia-600 to-sky-500 px-4 py-3 text-base font-semibold text-white shadow-md hover:from-fuchsia-700 hover:to-sky-600 disabled:opacity-60 transition-all"
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
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-semibold text-slate-800 hover:bg-fuchsia-50 hover:border-fuchsia-200 disabled:opacity-60 transition-all"
            >
              <span className="inline-block align-middle mr-2">🔒</span> Continue with Google
            </button>
          </form>

          <div className="mt-6 text-sm text-slate-600 text-center">
            {isSignup ? (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="font-semibold text-fuchsia-700 hover:underline"
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                New teacher?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="font-semibold text-fuchsia-700 hover:underline"
                >
                  Create an account
                </button>
              </>
            )}
          </div>

          <p className="mt-6 text-xs leading-relaxed text-slate-500 text-center">
            {"By continuing, you agree to use this system for official attendance tracking."}
            <span className="block" />
            {"Location permission is required for check-in/out actions."}
          </p>
        </div>
      </div>
    </div>
  );
  }
