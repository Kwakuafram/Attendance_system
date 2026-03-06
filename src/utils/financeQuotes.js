/**
 * Daily Motivational Quotes for Accounts / Finance Staff
 *
 * Every school day, accounts staff see a finance-themed motivational quote.
 * The quote rotates daily (deterministic based on the date) so all accounts
 * staff see the same quote on the same day.
 */

const FINANCE_QUOTES = [
  { quote: "A budget is telling your money where to go instead of wondering where it went.", author: "Dave Ramsey" },
  { quote: "Do not save what is left after spending, but spend what is left after saving.", author: "Warren Buffett" },
  { quote: "Accounting is the language of business.", author: "Warren Buffett" },
  { quote: "The art is not in making money, but in keeping it.", author: "Proverb" },
  { quote: "Beware of little expenses; a small leak will sink a great ship.", author: "Benjamin Franklin" },
  { quote: "Revenue is vanity, profit is sanity, but cash is king.", author: "Unknown" },
  { quote: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
  { quote: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { quote: "Money is a terrible master but an excellent servant.", author: "P.T. Barnum" },
  { quote: "Financial peace isn't the acquisition of stuff. It's learning to live on less than you make.", author: "Dave Ramsey" },
  { quote: "A penny saved is a penny earned.", author: "Benjamin Franklin" },
  { quote: "The goal isn't more money. The goal is living life on your terms.", author: "Chris Brogan" },
  { quote: "Accuracy is the twin brother of honesty; inaccuracy is the twin brother of dishonesty.", author: "Nathaniel Hawthorne" },
  { quote: "It's not your salary that makes you rich, it's your spending habits.", author: "Charles A. Jaffe" },
  { quote: "Money, like emotions, is something you must control to keep your life on the right track.", author: "Natasha Munson" },
  { quote: "The books are the school's financial memory. Keep them well.", author: "Unknown" },
  { quote: "Every number tells a story. Make sure yours is accurate.", author: "Unknown" },
  { quote: "Good accounting is the backbone of a well-run school.", author: "Unknown" },
  { quote: "Behind every successful school is a diligent accounts team.", author: "Unknown" },
  { quote: "The numbers don't lie. Let them guide your decisions.", author: "Unknown" },
  { quote: "Integrity is doing the right thing, even when no one is watching — especially with money.", author: "C.S. Lewis" },
  { quote: "Wealth consists not in having great possessions, but in having few wants.", author: "Epictetus" },
  { quote: "He who loses money, loses much. He who loses a friend, loses much more.", author: "Eleanor Roosevelt" },
  { quote: "Diligence is the mother of good luck.", author: "Benjamin Franklin" },
  { quote: "The secret of getting ahead is getting started — one receipt at a time.", author: "Unknown" },
];

const DAY_GREETINGS = {
  1: "Happy Monday — Fresh Books, Fresh Start!",
  2: "Terrific Tuesday — Keep the Numbers Right!",
  3: "Wonderful Wednesday — Halfway Through the Week!",
  4: "Thankful Thursday — Almost There!",
  5: "Fantastic Friday — Close the Week Strong!",
};

/**
 * Get a daily finance-themed motivational quote.
 * Deterministic based on date string so all staff see the same quote.
 * Returns { quote, author, greeting } or null on weekends.
 */
export function getFinanceQuote(dateStr) {
  const d = new Date(dateStr + "T12:00:00Z");
  const dayOfWeek = d.getUTCDay();

  if (dayOfWeek === 0 || dayOfWeek === 6) return null;

  const greeting = DAY_GREETINGS[dayOfWeek] || "Have a Great Day!";

  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % FINANCE_QUOTES.length;

  return { ...FINANCE_QUOTES[idx], greeting };
}
