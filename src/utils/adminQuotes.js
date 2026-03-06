/**
 * Daily Motivational Quotes for School Administrators
 *
 * Every school day, admins see a leadership-themed motivational quote.
 * The quote rotates daily (deterministic based on the date) so all admins
 * see the same quote on the same day.
 */

const ADMIN_QUOTES = [
  { quote: "A leader is one who knows the way, goes the way, and shows the way.", author: "John C. Maxwell" },
  { quote: "The task of leadership is not to put greatness into people, but to elicit it, for the greatness is there already.", author: "John Buchan" },
  { quote: "Management is doing things right; leadership is doing the right things.", author: "Peter Drucker" },
  { quote: "The function of leadership is to produce more leaders, not more followers.", author: "Ralph Nader" },
  { quote: "A good leader takes a little more than his share of the blame, a little less than his share of the credit.", author: "Arnold H. Glasow" },
  { quote: "Before you are a leader, success is all about growing yourself. When you become a leader, success is all about growing others.", author: "Jack Welch" },
  { quote: "Leadership is not about being in charge. It is about taking care of those in your charge.", author: "Simon Sinek" },
  { quote: "A school administrator's job is to create the conditions for teachers to teach and students to learn.", author: "Unknown" },
  { quote: "The best executive is the one who has sense enough to pick good men to do what he wants done.", author: "Theodore Roosevelt" },
  { quote: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
  { quote: "An organization, no matter how well designed, is only as good as the people who live and work in it.", author: "Dee Hock" },
  { quote: "Great leaders don't set out to be a leader… They set out to make a difference.", author: "Lisa Haisha" },
  { quote: "The quality of a leader is reflected in the standards they set for themselves.", author: "Ray Kroc" },
  { quote: "If your actions inspire others to dream more, learn more, do more and become more, you are a leader.", author: "John Quincy Adams" },
  { quote: "Alone we can do so little; together we can do so much.", author: "Helen Keller" },
  { quote: "The greatest leader is not the one who does the greatest things, but the one who gets people to do the greatest things.", author: "Ronald Reagan" },
  { quote: "What you do has far greater impact than what you say.", author: "Stephen Covey" },
  { quote: "A genuine leader is not a searcher for consensus but a molder of consensus.", author: "Martin Luther King Jr." },
  { quote: "People buy into the leader before they buy into the vision.", author: "John C. Maxwell" },
  { quote: "Effective leadership is not about making speeches or being liked; leadership is defined by results, not attributes.", author: "Peter Drucker" },
  { quote: "Education is the passport to the future, for tomorrow belongs to those who prepare for it today.", author: "Malcolm X" },
  { quote: "Good administration makes the whole school flourish.", author: "Unknown" },
  { quote: "Every great school begins with a great administrator who believes in the mission.", author: "Unknown" },
  { quote: "Run the school like you own it, care for it like you built it.", author: "Unknown" },
  { quote: "The strength of the team is each individual member. The strength of each member is the team.", author: "Phil Jackson" },
];

const DAY_GREETINGS = {
  1: "Happy Monday — Lead with Purpose!",
  2: "Terrific Tuesday — Empower Your Team!",
  3: "Wonderful Wednesday — Halfway There, Keep Going!",
  4: "Thankful Thursday — Almost at the Finish Line!",
  5: "Fantastic Friday — Celebrate This Week's Wins!",
};

/**
 * Get a daily admin-themed motivational quote.
 * Deterministic based on date string so all admins see the same quote.
 * Returns { quote, author, greeting } or null on weekends.
 */
export function getAdminQuote(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z");
  const dayOfWeek = d.getUTCDay();

  if (dayOfWeek === 0 || dayOfWeek === 6) return null;

  const greeting = DAY_GREETINGS[dayOfWeek] || "Have a Great Day!";

  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % ADMIN_QUOTES.length;

  return { ...ADMIN_QUOTES[idx], greeting };
}
