import { Colors } from '../colors';

const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [255, 255, 255];
  return [parseInt(result[1]!, 16), parseInt(result[2]!, 16), parseInt(result[3]!, 16)];
};

const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const lerpColor = (color1: string, color2: string, t: number): string => {
  const [r1, g1, b1] = hexToRgb(color1);
  const [r2, g2, b2] = hexToRgb(color2);
  return rgbToHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t));
};

export const getAgeColor = (date: Date, now: Date = new Date()): string => {
  const ageInDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

  const fresh = Colors.SUCCESS;
  const yellow = Colors.SECONDARY;
  const orange = Colors.WARNING;
  const red = Colors.ERROR;

  if (ageInDays <= 0) return fresh;
  if (ageInDays <= 3) return lerpColor(fresh, yellow, ageInDays / 3);
  if (ageInDays <= 7) return lerpColor(yellow, orange, (ageInDays - 3) / 4);
  if (ageInDays <= 14) return lerpColor(orange, red, (ageInDays - 7) / 7);
  return red;
};

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