import { createContext, useContext, useState, type ReactNode } from "react";

interface DiaryContextType {
  isDiaryMode: boolean;
  toggleDiaryMode: () => void;
}

const DiaryContext = createContext<DiaryContextType>({ isDiaryMode: false, toggleDiaryMode: () => {} });

export function useDiaryMode() {
  return useContext(DiaryContext);
}

export function DiaryProvider({ children }: { children: ReactNode }) {
  const [isDiaryMode, setIsDiaryMode] = useState(false);
  const toggleDiaryMode = () => setIsDiaryMode(prev => !prev);
  return (
    <DiaryContext.Provider value={{ isDiaryMode, toggleDiaryMode }}>
      {children}
    </DiaryContext.Provider>
  );
}
