/**
 * Daily Motivational Quotes for Teachers
 *
 * Every school day when teachers log in, they see a warm motivational message.
 * The quote rotates daily (deterministic based on the date) so all teachers
 * see the same quote on the same day.
 */

const MONDAY_QUOTES = [
  {
    quote: "A teacher affects eternity; no one can tell where their influence stops.",
    author: "Henry Adams",
  },
  {
    quote: "The beautiful thing about learning is that nobody can take it away from you.",
    author: "B.B. King",
  },
  {
    quote: "Education is the most powerful weapon which you can use to change the world.",
    author: "Nelson Mandela",
  },
  {
    quote: "Teaching is the greatest act of optimism.",
    author: "Colleen Wilcox",
  },
  {
    quote: "The influence of a good teacher can never be erased.",
    author: "Unknown",
  },
  {
    quote: "Every child deserves a champion — an adult who will never give up on them.",
    author: "Rita Pierson",
  },
  {
    quote: "What we learn with pleasure we never forget.",
    author: "Alfred Mercier",
  },
  {
    quote: "It is the supreme art of the teacher to awaken joy in creative expression and knowledge.",
    author: "Albert Einstein",
  },
  {
    quote: "Teachers plant the seeds of knowledge that grow forever.",
    author: "Unknown",
  },
  {
    quote: "The best teachers teach from the heart, not from the book.",
    author: "Unknown",
  },
  {
    quote: "Good teachers know how to bring out the best in students.",
    author: "Charles Kuralt",
  },
  {
    quote: "One child, one teacher, one pen and one book can change the world.",
    author: "Malala Yousafzai",
  },
  {
    quote: "In learning you will teach, and in teaching you will learn.",
    author: "Phil Collins",
  },
  {
    quote: "The task of the modern educator is not to cut down jungles, but to irrigate deserts.",
    author: "C.S. Lewis",
  },
  {
    quote: "If you are planning for a year, sow rice; for a decade, plant trees; for a lifetime, educate people.",
    author: "Chinese Proverb",
  },
  {
    quote: "Better than a thousand days of diligent study is one day with a great teacher.",
    author: "Japanese Proverb",
  },
  {
    quote: "Be the teacher you wish you had when you were growing up.",
    author: "Unknown",
  },
  {
    quote: "Your Monday morning thoughts set the tone for your whole week. Think of yourself as a gift to your students.",
    author: "Unknown",
  },
  {
    quote: "Every Monday is a chance to start fresh and make a difference in a child's life.",
    author: "Unknown",
  },
  {
    quote: "The energy of a Monday sets the pace for the week. Bring your best self today!",
    author: "Unknown",
  },
  {
    quote: "You are not just a teacher. You are a manager of a better future.",
    author: "Unknown",
  },
  {
    quote: "To teach is to touch a life forever.",
    author: "Unknown",
  },
  {
    quote: "Success isn't always about greatness. It's about consistency. Show up every day and make a difference.",
    author: "Dwayne Johnson",
  },
  {
    quote: "The more you give, the more you receive. Keep pouring into your students this week.",
    author: "Unknown",
  },
  {
    quote: "Monday is the day to set intentions. Let your intention be to inspire someone today.",
    author: "Unknown",
  },
  {
    quote: "Great teachers empathize with kids, respect them, and believe that each one has something special.",
    author: "Ann Lieberman",
  },
  {
    quote: "Don't watch the clock; do what it does — keep going.",
    author: "Sam Levenson",
  },
  {
    quote: "You make a living by what you get. You make a life by what you give.",
    author: "Winston Churchill",
  },
  {
    quote: "Teaching is a calling too. And I've always thought that teachers, in their way, are holy.",
    author: "Jeannette Walls",
  },
  {
    quote: "Welcome back! A new week is 5 fresh chances to learn, to grow, and to inspire.",
    author: "Unknown",
  },
];

/**
 * Get a Monday motivational quote.
 * The quote is deterministic based on the date string (YYYY-MM-DD)
 * so all teachers see the same quote on the same Monday.
 */
export function getMondayQuote(dateStr) {
  // Simple hash from the date string to pick a consistent quote
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % MONDAY_QUOTES.length;
  return MONDAY_QUOTES[idx];
}

/**
 * Get all quotes (for testing / admin preview).
 */
export function getAllQuotes() {
  return MONDAY_QUOTES;
}

// ─── General weekday quotes (Tue–Fri) ──────────────────────────────────────
const WEEKDAY_QUOTES = [
  { quote: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { quote: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { quote: "Every day is a new opportunity to make a difference in a child's life.", author: "Unknown" },
  { quote: "Strive not to be a success, but rather to be of value.", author: "Albert Einstein" },
  { quote: "What you do today can improve all your tomorrows.", author: "Ralph Marston" },
  { quote: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { quote: "Small progress is still progress. Keep going!", author: "Unknown" },
  { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { quote: "Act as if what you do makes a difference. It does.", author: "William James" },
  { quote: "In a world where you can be anything, be kind.", author: "Jennifer Dukes Lee" },
  { quote: "Your patience and dedication shape the future, one student at a time.", author: "Unknown" },
  { quote: "Today's effort is tomorrow's harvest. Keep planting seeds of knowledge.", author: "Unknown" },
  { quote: "A good teacher is like a candle — it consumes itself to light the way for others.", author: "Mustafa Kemal Atatürk" },
  { quote: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { quote: "You are making a bigger impact than you realize. Keep showing up.", author: "Unknown" },
  { quote: "Courage doesn't always roar. Sometimes it's the quiet voice at the end of the day saying 'I will try again tomorrow.'", author: "Mary Anne Radmacher" },
  { quote: "The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.", author: "Brian Herbert" },
  { quote: "Stay committed to your decisions, but stay flexible in your approach.", author: "Tony Robbins" },
  { quote: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { quote: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
];

const DAY_GREETINGS = {
  1: "Happy Monday — Welcome Back!",
  2: "Terrific Tuesday — Keep It Up!",
  3: "Wonderful Wednesday — Halfway There!",
  4: "Thankful Thursday — Almost There!",
  5: "Fantastic Friday — Finish Strong!",
};

/**
 * Get a daily motivational quote for any school day.
 * On Mondays uses the Monday-specific pool; Tue–Fri uses general pool.
 * Returns { quote, author, greeting } or null.
 */
export function getDailyQuote(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z");
  const dayOfWeek = d.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat

  // Weekend — no quote
  if (dayOfWeek === 0 || dayOfWeek === 6) return null;

  const pool = dayOfWeek === 1 ? MONDAY_QUOTES : WEEKDAY_QUOTES;
  const greeting = DAY_GREETINGS[dayOfWeek] || "Have a Great Day!";

  // Deterministic hash from date string
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % pool.length;

  return { ...pool[idx], greeting };
}
