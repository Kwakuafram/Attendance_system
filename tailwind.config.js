/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  safelist: [
    // Calendar color classes
    'bg-emerald-200', 'text-emerald-800',
    'bg-amber-200', 'text-amber-800',
    'bg-blue-200', 'text-blue-800',
    'bg-red-200', 'text-red-800',
    'bg-slate-100', 'text-slate-400',
    'bg-white', 'text-slate-600',
    'ring-2', 'ring-violet-500', 'ring-offset-1',
  ],
  plugins: [],
};
