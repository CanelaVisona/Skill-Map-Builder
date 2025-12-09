import { createContext, useContext, useState, type ReactNode } from "react";

interface DiaryContextType {
  isDiaryOpen: boolean;
  openDiary: () => void;
  closeDiary: () => void;
}

const DiaryContext = createContext<DiaryContextType>({ 
  isDiaryOpen: false, 
  openDiary: () => {}, 
  closeDiary: () => {} 
});

export function useDiary() {
  return useContext(DiaryContext);
}

export function DiaryProvider({ children }: { children: ReactNode }) {
  const [isDiaryOpen, setIsDiaryOpen] = useState(false);
  const openDiary = () => setIsDiaryOpen(true);
  const closeDiary = () => setIsDiaryOpen(false);
  return (
    <DiaryContext.Provider value={{ isDiaryOpen, openDiary, closeDiary }}>
      {children}
    </DiaryContext.Provider>
  );
}
