import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";

function dateKey(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function pad(n, len = 4) {
  return String(n).padStart(len, "0");
}

function uuid() {
  return (crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(16).slice(2)}`);
}

/**
 * Supported receipt types and their Firestore collections + default purpose codes
 */
const RECEIPT_CONFIG = {
  FEES: {
    collection: "fee_receipts",
    defaultPurpose: "SCHOOL_FEES",
    counterPrefix: "fees",
  },
  HEALTH_AND_MAINTENANCE: {
    collection: "health_maintenance_receipts",
    defaultPurpose: "HEALTH_AND_MAINTENANCE",
    counterPrefix: "health_and_maintenance",
  },
  BOOKS: {
    collection: "books_receipts",
    defaultPurpose: "BOOKS",
    counterPrefix: "books",
  },
};

/**
 * Generic receipt creator (Fees + Health Book + Maintenance Book)
 */
export async function createReceipt({
  receiptType = "FEES", // FEES | HEALTH_BOOK | MAINTENANCE_BOOK

  adminUid,
  adminName,
  studentName,
  studentId = "",
  classId = "",
  className = "",

  amount,
  currency = "GHS",
  paymentMethod, // CASH | MOMO | BANK
  reference = "",

  // optional override; if not provided, uses the default purpose for the receiptType
  purpose,
}) {
  if (!adminUid) throw new Error("Not signed in.");
  if (!studentName?.trim()) throw new Error("Student name is required.");

  const cfg = RECEIPT_CONFIG[receiptType];
  if (!cfg) throw new Error(`Invalid receiptType: ${receiptType}`);

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) throw new Error("Amount must be a valid number > 0.");
  if (!paymentMethod) throw new Error("Select payment method.");

  const day = dateKey();

  // Read current termKey from school/main
  const schoolRef = doc(db, "school", "main");
  const schoolSnap = await getDoc(schoolRef);
  const termKey = schoolSnap.exists() ? (schoolSnap.data().currentTermKey || "") : "";
  if (!termKey) throw new Error("currentTermKey is missing in school/main.");

  // Keep counters SEPARATE per receiptType (recommended)
  const dailyCounterRef = doc(db, "counters", `receipt_${cfg.counterPrefix}_daily_${day}`);
  const termCounterRef = doc(db, "counters", `receipt_${cfg.counterPrefix}_term_${termKey}`);

  // Write into the proper collection
  const receiptRef = doc(db, cfg.collection, `${day}_${uuid()}`);

  return await runTransaction(db, async (tx) => {
    const dailySnap = await tx.get(dailyCounterRef);
    const termSnap = await tx.get(termCounterRef);

    const dailyNext = dailySnap.exists() ? Number(dailySnap.data().next || 1) : 1;
    const termNext = termSnap.exists() ? Number(termSnap.data().next || 1) : 1;

    const dailyNo = `${day}-${pad(dailyNext, 4)}`;   // 2026-01-13-0005
    const termNo = `${termKey}-${pad(termNext, 4)}`; // 2026-T1-0123

    tx.set(dailyCounterRef, { next: dailyNext + 1 }, { merge: true });
    tx.set(termCounterRef, { next: termNext + 1 }, { merge: true });

    const finalPurpose = purpose || cfg.defaultPurpose;

    tx.set(receiptRef, {
      receiptType,     // FEES | HEALTH_BOOK | MAINTENANCE_BOOK
      dailyNo,
      termNo,
      date: day,
      termKey,

      amount: amt,
      currency,
      paymentMethod,
      reference,
      purpose: finalPurpose,
      status: "ISSUED",

      studentId,
      studentName: studentName.trim(),
      classId,
      className,

      createdByUid: adminUid,
      createdByName: adminName || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      id: receiptRef.id,
      receiptType,
      dailyNo,
      termNo,
      date: day,
      termKey,
      amount: amt,
      currency,
      studentName: studentName.trim(),
      className,
      paymentMethod,
      reference,
      createdByName: adminName || "",
      purpose: finalPurpose,
    };
  });
}
