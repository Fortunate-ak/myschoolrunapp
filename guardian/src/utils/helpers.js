export const validateIdNumber = (idNumber) => {
  if (!idNumber) {
    return { valid: false, message: "ID number is required" };
  }

  let cleaned = idNumber.replace(/\s/g, "");

  if (cleaned.length === 0) {
    return {
      isValid: false,
      message: "ID number cannot be empty",
    };
  }

  const pattern = /^(\d{2})[- ]?(\d{6,7})[- ]?([A-Z])[- ]?(\d{2})$/;
  const match = cleaned.match(pattern);

  if (!match) {
    return {
      isValid: false,
      message: "Invalid Id Number",
    };
  }

  const [, firstTwo, middle, letter, lastTwo] = match;

  if (middle.length !== 6 && middle.length !== 7) {
    return {
      isValid: false,
      message: "Invalid ID Number",
    };
  }

  return {
    isValid: true,
    message: "Valid ID number",
    parts: {
      firstTwo: firstTwo,
      middle: middle,
      letter: letter,
      lastTwo: lastTwo,
    },
    formatted: `${firstTwo}-${middle}-${letter}-${lastTwo}`,
    normalized: `${firstTwo}-${middle}-${letter}-${lastTwo}`,
    original: idNumber,
  };
};

export const getRegistrationFormatStatus = (value) => {
  if (!value) return null;

  const lettersPart = value.slice(0, 3);
  const numbersPart = value.slice(3, 7);

  const hasThreeLetters = /^[A-Z]{3}$/.test(lettersPart);
  const hasFourNumbers = /^\d{4}$/.test(numbersPart);

  if (value.length === 7) {
    if (hasThreeLetters && hasFourNumbers) {
      return { valid: true, message: "✓ Valid format" };
    } else {
      return { valid: false, message: "Invalid format" };
    }
  } else {
    return {
      valid: false,
      message: `${value.length}/7 characters`,
    };
  }
};

export function addMinutesToTime(timeStr, minutesToAdd) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m + minutesToAdd;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const newH = Math.floor(wrapped / 60);
  const newM = wrapped % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

export function formatTime(timeStr) {
  if (!timeStr) return null;
  if (timeStr.split(":").length === 2) {
    return `${timeStr}:00`;
  }
  return timeStr;
}

export function formatChatTime(timeStr) {
  if (!timeStr) return null;

  // Extract HH:MM from any time format
  const match = timeStr.match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : timeStr;
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  if (!lat2 || !lon2) return 999;
  const R = 6371,
    dLat = ((lat2 - lat1) * Math.PI) / 180,
    dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function timeAgo(dateStr) {
  if (!dateStr) return "";

  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export const getInitials = (fullname = "") =>
  fullname
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("") || "?";

export function getStrength(pw) {
  if (!pw) return { score: 0, label: "", color: "transparent" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: "Very weak", color: "#ef4444" };
  if (score === 2) return { score, label: "Weak", color: "#f97316" };
  if (score === 3) return { score, label: "Fair", color: "#f59e0b" };
  if (score === 4) return { score, label: "Strong", color: "#22c55e" };
  return { score, label: "Very strong", color: "#16a34a" };
}

export const REQUIREMENTS = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "One number", test: (p) => /[0-9]/.test(p) },
  { label: "One special character", test: (p) => /[^A-Za-z0-9]/.test(p) },
];
