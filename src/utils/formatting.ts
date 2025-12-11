export const formatCompactTime = (date: Date, now: Date = new Date()): string => {
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffMinutes < 60) {
    return `${Math.max(1, diffMinutes)}m`;
  } else if (diffHours < 24) {
    return `${diffHours}h`;
  } else if (diffDays < 7) {
    return `${diffDays}d`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks}w`;
  } else if (diffMonths < 12) {
    return `${diffMonths}M`;
  } else {
    return `${diffYears}y`;
  }
};