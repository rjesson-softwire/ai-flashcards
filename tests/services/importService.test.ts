import { parseImportedJSON, parseImportedCSV } from '../../src/services/importService';
import { FlashcardSet } from '../../src/types';

// Helper to strip volatile fields for assertions
const normalizeSet = (set: FlashcardSet) => ({
  title: set.title,
  source: set.source,
  cards: set.cards.map(c => ({ id: typeof c.id, question: c.question, answer: c.answer })),
});

describe('importService - JSON parsing', () => {
  test('parses array of question/answer objects', () => {
    const text = JSON.stringify([
      { question: 'Q1', answer: 'A1' },
      { question: 'Q2', answer: 'A2' },
    ]);

    const set = parseImportedJSON(text, 'my-set.json');
    expect(normalizeSet(set)).toEqual({
      title: 'my set',
      source: 'Imported: my-set.json',
      cards: [
        { id: 'string', question: 'Q1', answer: 'A1' },
        { id: 'string', question: 'Q2', answer: 'A2' },
      ],
    });
    expect(set.createdAt instanceof Date).toBe(true);
  });

  test('parses full FlashcardSet and preserves provided fields', () => {
    const text = JSON.stringify({
      title: 'Provided Title',
      source: 'Provided Source',
      createdAt: '2024-01-01T00:00:00.000Z',
      cards: [
        { id: 'abc', question: 'Q', answer: 'A' },
        { question: 'Q2', answer: 'A2' }, // missing id -> generated
      ],
    });

    const set = parseImportedJSON(text, 'ignored.json');
    expect(set.title).toBe('Provided Title');
    expect(set.source).toBe('Provided Source');
    expect(set.createdAt instanceof Date).toBe(true);
    expect(set.cards[0].id).toBe('abc');
    expect(typeof set.cards[1].id).toBe('string');
  });

  test('throws on invalid JSON', () => {
    expect(() => parseImportedJSON('{bad json', 'f.json')).toThrow('Invalid JSON');
  });
});

describe('importService - CSV parsing', () => {
  test('parses CSV with case-insensitive headers', () => {
    const csv = `question,ANSWER\nWhat is 2+2?,4`;
    const set = parseImportedCSV(csv, 'math.csv');
    expect(set.title).toBe('math');
    expect(set.source).toBe('Imported: math.csv');
    expect(set.cards).toHaveLength(1);
    expect(set.cards[0]).toEqual(expect.objectContaining({ question: 'What is 2+2?', answer: '4' }));
  });

  test('preserves quotes inside unquoted fields', () => {
    const csv = `Question,Answer\nWhat does "hello" mean,It means greeting`;
    const set = parseImportedCSV(csv, 'quotes.csv');
    expect(set.cards[0].question).toBe('What does "hello" mean');
  });

  test('handles quoted fields with commas and escaped quotes', () => {
    const csv = [
      'Question,Answer',
      '"Question with, comma","Answer with ""quotes"" and, comma"',
    ].join('\n');
    const set = parseImportedCSV(csv, 'complex.csv');
    expect(set.cards[0].question).toBe('Question with, comma');
    expect(set.cards[0].answer).toBe('Answer with "quotes" and, comma');
  });

  test('throws on invalid headers', () => {
    const csv = `Q,A\nx,y`;
    expect(() => parseImportedCSV(csv, 'bad.csv')).toThrow('Invalid CSV headers. Expected: Question,Answer');
  });

  test('throws when no valid rows', () => {
    const csv = `Question,Answer\n,\n , `;
    expect(() => parseImportedCSV(csv, 'empty.csv')).toThrow('No cards found');
  });
});
