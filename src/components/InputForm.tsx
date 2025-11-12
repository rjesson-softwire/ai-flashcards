import React, { useState, useEffect, useRef } from 'react';
import { extractFlashcards } from '../services/llmService';
import { fetchWikipediaContent } from '../services/wikipediaService';
import { FlashcardSet } from '../types';
import { getLLMConfig } from '../config';
import { MockModeToggle } from './MockModeToggle';
import { parseImportedJSON, parseImportedCSV } from '../services/importService';
import '../styles/InputForm.css';

interface InputFormProps {
  setFlashcardSet: React.Dispatch<React.SetStateAction<FlashcardSet | null>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
}

const InputForm: React.FC<InputFormProps> = ({ setFlashcardSet, setLoading, setError }) => {
  const [isUrlInput, setIsUrlInput] = useState(true);
  const [input, setInput] = useState('');
  const [useMockMode, setUseMockMode] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  
  useEffect(() => {
    const savedSetting = localStorage.getItem('use_mock_mode');
    if (savedSetting) {
      setUseMockMode(savedSetting === 'true');
    }
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!input.trim()) {
      setError('Please enter a Wikipedia URL or text');
      return;
    }

    const config = getLLMConfig();
    
    if (!config.defaultApiKey || !config.defaultApiKey.trim()) {
      setError('Please set your API key in LLM Settings');
      return;
    }

    setLoading(true);

    try {
      let content = input;
      let source = 'Custom text';

      if (isUrlInput) {
        if (!isValidWikipediaUrl(input)) {
          setError('Please enter a valid Wikipedia URL');
          setLoading(false);
          return;
        }

        const wikiContent = await fetchWikipediaContent(input);
        content = wikiContent.content;
        source = input;
      }

      const flashcards = await extractFlashcards(content, undefined, useMockMode);

      setFlashcardSet({
        title: isUrlInput ? extractTitleFromUrl(input) : 'Custom Text Flashcards',
        source: source,
        cards: flashcards,
        createdAt: new Date()
      });
    } catch (error) {
      setError(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      setLoading(false);
    }
  };

  const isValidWikipediaUrl = (url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname.includes('wikipedia.org') && parsedUrl.pathname.length > 1;
    } catch {
      return false;
    }
  };

  const extractTitleFromUrl = (url: string): string => {
    try {
      const parsedUrl = new URL(url);
      const pathParts = parsedUrl.pathname.split('/');
      const lastPart = pathParts[pathParts.length - 1];
      return lastPart.replace(/_/g, ' ');
    } catch {
      return 'Wikipedia Flashcards';
    }
  };

  const handleImportJSON = (file: File) => {
    setError(null);
    setLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const set = parseImportedJSON(text, file.name);
        setFlashcardSet(set);
      } catch (e) {
        setError('Invalid JSON format. Expected FlashcardSet or array of {question, answer}.');
      } finally {
        setLoading(false);
        if (jsonInputRef.current) jsonInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setError('Failed to read JSON file');
      setLoading(false);
      if (jsonInputRef.current) jsonInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleImportCSV = (file: File) => {
    setError(null);
    setLoading(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const set = parseImportedCSV(text, file.name);
        setFlashcardSet(set);
      } catch (e) {
        setError('Invalid CSV. Expected headers: Question,Answer');
      } finally {
        setLoading(false);
        if (csvInputRef.current) csvInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setError('Failed to read CSV file');
      setLoading(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="input-form-container">
      <form onSubmit={handleSubmit}>
        <div className="input-type-selector">
          <button
            type="button"
            className={isUrlInput ? 'active' : ''}
            onClick={() => setIsUrlInput(true)}
          >
            Wikipedia URL
          </button>
          <button
            type="button"
            className={!isUrlInput ? 'active' : ''}
            onClick={() => setIsUrlInput(false)}
          >
            Custom Text
          </button>
        </div>

        <div className="form-group">
          <label htmlFor="input">
            {isUrlInput ? 'Wikipedia URL' : 'Text to extract flashcards from'}
          </label>
          <textarea
            id="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isUrlInput
                ? 'https://en.wikipedia.org/wiki/Artificial_intelligence'
                : 'Paste your text here...'
            }
            rows={isUrlInput ? 1 : 10}
          />
        </div>

        <MockModeToggle onChange={setUseMockMode} />
        
        <div className="import-actions">
          <button
            type="button"
            className="submit-button"
            onClick={() => jsonInputRef.current?.click()}
          >
            Import JSON
          </button>
          <button
            type="button"
            className="submit-button"
            onClick={() => csvInputRef.current?.click()}
          >
            Import CSV
          </button>
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportJSON(f);
            }}
          />
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportCSV(f);
            }}
          />
        </div>

        <button className="submit-button" type="submit">Generate Flashcards</button>
      </form>
    </div>
  );
};

export default InputForm;
