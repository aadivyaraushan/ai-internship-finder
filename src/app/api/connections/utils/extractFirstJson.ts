// Utility function to extract the first full JSON object/array from a string
export function extractFirstJSON(raw: string): string | null {
  // Find first opening brace or bracket
  const firstObj = raw.indexOf('{');
  const firstArr = raw.indexOf('[');

  if (firstObj === -1 && firstArr === -1) return null;

  let start: number;
  let openChar: '{' | '[';
  let closeChar: '}' | ']';

  if (firstObj === -1) {
    start = firstArr;
    openChar = '[';
    closeChar = ']';
  } else if (firstArr === -1) {
    start = firstObj;
    openChar = '{';
    closeChar = '}';
  } else {
    // Choose whichever appears first in the string
    if (firstObj < firstArr) {
      start = firstObj;
      openChar = '{';
      closeChar = '}';
    } else {
      start = firstArr;
      openChar = '[';
      closeChar = ']';
    }
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i++) {
    const char = raw[i];

    if (inString) {
      if (!escaped && char === '"') {
        inString = false;
      }
      escaped = char === '\\' && !escaped;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === openChar) {
      depth++;
    } else if (char === closeChar) {
      depth--;
      if (depth === 0) {
        return raw.slice(start, i + 1);
      }
    }
  }

  // If we reach here, we didn't find a matching close char; return null
  return null;
}
