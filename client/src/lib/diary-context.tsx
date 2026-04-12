import { createContext, useContext, useState, type ReactNode } from "react";

interface DiaryContextType {
  isDiaryOpen: boolean;
  openDiary: () => void;
  closeDiary: () => void;
  isBookTrackerOpen: boolean;
  openBookTracker: () => void;
  closeBookTracker: () => void;
}

const DiaryContext = createContext<DiaryContextType>({ 
  isDiaryOpen: false, 
  openDiary: () => {}, 
  closeDiary: () => {},
  isBookTrackerOpen: false,
  openBookTracker: () => {},
  closeBookTracker: () => {}
});

export function useDiary() {
  return useContext(DiaryContext);
}

export function DiaryProvider({ children }: { children: ReactNode }) {
  const [isDiaryOpen, setIsDiaryOpen] = useState(false);
  const [isBookTrackerOpen, setIsBookTrackerOpen] = useState(false);
  
  const openDiary = () => setIsDiaryOpen(true);
  const closeDiary = () => setIsDiaryOpen(false);
  const openBookTracker = () => setIsBookTrackerOpen(true);
  const closeBookTracker = () => setIsBookTrackerOpen(false);
  
  return (
    <DiaryContext.Provider value={{ 
      isDiaryOpen, openDiary, closeDiary,
      isBookTrackerOpen, openBookTracker, closeBookTracker
    }}>
      {children}
    </DiaryContext.Provider>
  );
}
