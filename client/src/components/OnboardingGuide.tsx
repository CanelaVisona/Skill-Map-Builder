import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, HelpCircle, Sparkles, BookOpen, Target, CheckCircle2 } from "lucide-react";
import { Button } from "./ui/button";

const ONBOARDING_KEY = "skilltree-onboarding-complete";

export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);
  
  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      setIsFirstTime(true);
      setShowOnboarding(true);
    }
  }, []);
  
  const openGuide = () => setShowOnboarding(true);
  const closeGuide = () => setShowOnboarding(false);
  
  return {
    showOnboarding,
    isFirstTime,
    openGuide,
    closeGuide
  };
}

export function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
      onClick={onClick}
      data-testid="button-help"
      title="Guía de inicio"
    >
      <HelpCircle className="h-5 w-5" />
    </button>
  );
}

interface OnboardingGuideProps {
  onComplete: () => void;
  isOpen: boolean;
}

type Step = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
};

const tourSteps: Step[] = [
  {
    id: "welcome",
    title: "¡Bienvenido a tu Skill Tree!",
    description: "\"IF YOU HAVE A PROBLEM, YOU HAVE A QUEST. LET'S PLAY\"\n\nEsta herramienta te ayuda a visualizar y seguir tu progreso en diferentes áreas.",
    icon: <Sparkles className="h-6 w-6 text-yellow-500" />
  },
  {
    id: "quests",
    title: "Main Quest y Side Quest",
    description: "Usa el botón + en la barra lateral para crear misiones. Main Quest son áreas de desarrollo continuo. Side Quest son proyectos con objetivo específico.",
    icon: <Target className="h-6 w-6 text-green-500" />
  },
  {
    id: "nodes",
    title: "Nodos de habilidad",
    description: "Cada círculo es una tarea. Toca para completarla. Mantén presionado el nombre del nodo para editar título y descripción. Mantén presionado el círculo para más opciones.",
    icon: <CheckCircle2 className="h-6 w-6 text-emerald-500" />
  },
  {
    id: "diary",
    title: "Quest Diary",
    description: "Toca el icono del libro (arriba a la derecha) para abrir tu diario. Ahí verás tus logros y puedes agregar personajes, lugares y sombras.",
    icon: <BookOpen className="h-6 w-6 text-amber-500" />
  }
];

export function OnboardingGuide({ onComplete, isOpen }: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);
  
  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };
  
  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };
  
  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    onComplete();
  };
  
  const handleSkip = () => {
    handleComplete();
  };
  
  if (!isOpen) return null;
  
  const step = tourSteps[currentStep];
  
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/50"
        onClick={handleSkip}
      />
      
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="relative bg-card border border-border rounded-xl shadow-2xl w-80 max-w-[calc(100vw-32px)] z-10"
        >
          <div className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                {step.icon}
                <h3 className="font-bold text-lg">{step.title}</h3>
              </div>
              <button
                onClick={handleSkip}
                className="text-muted-foreground hover:text-foreground transition-colors -mt-1 -mr-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <p className="text-muted-foreground text-sm leading-relaxed mb-5">
              {step.description}
            </p>
            
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                {tourSteps.map((_, index) => (
                  <div
                    key={index}
                    className={`h-1.5 rounded-full transition-all ${
                      index === currentStep 
                        ? "w-4 bg-primary" 
                        : index < currentStep 
                          ? "w-1.5 bg-primary/50" 
                          : "w-1.5 bg-muted"
                    }`}
                  />
                ))}
              </div>
              
              <div className="flex gap-2">
                {currentStep > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePrev}
                    className="h-8 px-3"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleNext}
                  className="h-8 px-4"
                >
                  {currentStep === tourSteps.length - 1 ? "¡Empezar!" : "Siguiente"}
                  {currentStep < tourSteps.length - 1 && <ChevronRight className="h-4 w-4 ml-1" />}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
