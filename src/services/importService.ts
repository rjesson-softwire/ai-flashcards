import { Flashcard, FlashcardSet } from '../types';
import { v4 as uuidv4 } from 'uuid';

const deriveTitleFromFileName = (fileName: string): string => {
  const base = fileName.replace(/\.[^.]+$/, '');
  return base.replace(/[_-]+/g, ' ').trim() || 'Imported Flashcards';
};

export const parseImportedJSON = (text: string, fileName: string): FlashcardSet => {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON');
  }

  const now = new Date();
  const source = `Imported: ${fileName}`;

  if (Array.isArray(data)) {
    const cards = data.map((item) => {
      if (!item || typeof item !== 'object') throw new Error('Invalid JSON card');
      const q = (item as any).question;
      const a = (item as any).answer;
      if (typeof q !== 'string' || typeof a !== 'string') throw new Error('Invalid JSON card fields');
      return { id: uuidv4(), question: q, answer: a } as Flashcard;
    });
    if (cards.length === 0) throw new Error('No cards found');
    return {
      title: deriveTitleFromFileName(fileName),
      source,
      cards,
      createdAt: now,
    };
  }

  if (data && typeof data === 'object') {
    const obj = data as any;
    if (!obj.cards || !Array.isArray(obj.cards)) throw new Error('Missing cards array');
    const title: string = typeof obj.title === 'string' && obj.title.trim() ? obj.title : deriveTitleFromFileName(fileName);
    const cards: Flashcard[] = obj.cards.map((c: any) => {
      const q = c?.question;
      const a = c?.answer;
      if (typeof q !== 'string' || typeof a !== 'string') throw new Error('Invalid JSON card fields');
      return { id: typeof c?.id === 'string' && c.id ? c.id : uuidv4(), question: q, answer: a };
    });
    if (cards.length === 0) throw new Error('No cards found');
    const createdAt = obj.createdAt ? new Date(obj.createdAt) : now;
    return {
      title,
      source: typeof obj.source === 'string' && obj.source.trim() ? obj.source : source,
      cards,
      createdAt,
    };
  }

  throw new Error('Unsupported JSON format');
};

const splitCsvLines = (text: string): string[] => {
  // Normalize newlines, keep quoted fields intact when splitting lines
  const normalized = text.replace(/\r\n?/g, '\n');
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === '"') {
      const next = normalized[i + 1];
      if (inQuotes && next === '"') { // escaped quote
        current += '"';
        i++; // skip next quote
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === '\n' && !inQuotes) {
      lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
};

const parseCsvRow = (row: string): string[] => {
  // Split by commas not inside quotes
  const tokens = row.match(/("([^"]|"")*"|[^,]*)/g) || [];
  return tokens.map((field) => {
    let v = field;
    // If field is quoted, strip surrounding quotes and unescape double quotes
    if (v.startsWith('"') && v.endsWith('"')) {
      v = v.slice(1, -1).replace(/""/g, '"');
    }
    return v.trim();
  });
};

export const parseImportedCSV = (text: string, fileName: string): FlashcardSet => {
  const lines = splitCsvLines(text).filter(l => l.trim().length > 0);
  if (lines.length === 0) throw new Error('Empty CSV');

  const headerRaw = parseCsvRow(lines[0]).map(h => h.replace(/^\uFEFF/, ''));
  const header = headerRaw.map(h => h.toLowerCase());
  if (header.length < 2 || header[0] !== 'question' || header[1] !== 'answer') {
    throw new Error('Invalid CSV headers. Expected: Question,Answer');
  }

  const cards: Flashcard[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvRow(lines[i]);
    // tolerate extra columns but only use first two
    const q = row[0] ?? '';
    const a = row[1] ?? '';
    if (!q || !a) continue; // skip incomplete rows
    cards.push({ id: uuidv4(), question: q, answer: a });
  }

  if (cards.length === 0) throw new Error('No cards found');

  return {
    title: deriveTitleFromFileName(fileName),
    source: `Imported: ${fileName}`,
    cards,
    createdAt: new Date(),
  };
};
