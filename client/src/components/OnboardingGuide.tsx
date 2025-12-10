import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, HelpCircle, Sparkles, BookOpen, Target, FolderKanban, CheckCircle2, ListTodo } from "lucide-react";
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

type TourStep = {
  id: string;
  targetSelector: string;
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right" | "center";
  icon: React.ReactNode;
};

const tourSteps: TourStep[] = [
  {
    id: "welcome",
    targetSelector: "",
    title: "¡Bienvenido a tu Skill Tree!",
    description: "Esta herramienta te ayuda a visualizar y seguir tu progreso en diferentes áreas. Vamos a hacer un recorrido rápido.",
    position: "center",
    icon: <Sparkles className="h-6 w-6 text-yellow-500" />
  },
  {
    id: "add-button",
    targetSelector: "[data-onboarding='add-button']",
    title: "Main Quest y Side Quest",
    description: "Aquí creas tus misiones. Main Quest son áreas de desarrollo continuo (Música, Trabajo). Side Quest son proyectos con objetivo específico.",
    position: "right",
    icon: <Target className="h-6 w-6 text-green-500" />
  },
  {
    id: "skill-node",
    targetSelector: "[data-onboarding='skill-node']",
    title: "Nodos y SubQuests",
    description: "Cada nodo es una tarea. Toca para completarla. Mantén presionado para opciones: editar título, agregar feedback, o crear SubQuests.",
    position: "bottom",
    icon: <CheckCircle2 className="h-6 w-6 text-emerald-500" />
  },
  {
    id: "diary",
    targetSelector: "[data-onboarding='diary-button']",
    title: "Quest Diary",
    description: "Tu diario personal. Aquí ves tus logros con feedback, y puedes agregar personajes, lugares y sombras derrotadas.",
    position: "left",
    icon: <BookOpen className="h-6 w-6 text-amber-500" />
  }
];

export function OnboardingGuide({ onComplete, isOpen }: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setTargetRect(null);
    }
  }, [isOpen]);
  
  const updateTargetPosition = useCallback(() => {
    const step = tourSteps[currentStep];
    if (step.targetSelector && step.position !== "center") {
      const element = document.querySelector(step.targetSelector);
      if (element) {
        setTargetRect(element.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    } else {
      setTargetRect(null);
    }
  }, [currentStep]);
  
  useEffect(() => {
    if (!isOpen) return;
    
    updateTargetPosition();
    
    window.addEventListener("resize", updateTargetPosition);
    window.addEventListener("scroll", updateTargetPosition, true);
    
    return () => {
      window.removeEventListener("resize", updateTargetPosition);
      window.removeEventListener("scroll", updateTargetPosition, true);
    };
  }, [isOpen, currentStep, updateTargetPosition]);
  
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
  const isCenter = step.position === "center" || !targetRect;
  
  const getTooltipStyle = (): React.CSSProperties => {
    if (isCenter || !targetRect) {
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 10001
      };
    }
    
    const padding = 16;
    const tooltipWidth = 320;
    const tooltipHeight = 200;
    
    switch (step.position) {
      case "right":
        return {
          position: "fixed",
          top: Math.max(padding, Math.min(targetRect.top, window.innerHeight - tooltipHeight - padding)),
          left: targetRect.right + padding,
          zIndex: 10001
        };
      case "left":
        return {
          position: "fixed",
          top: Math.max(padding, Math.min(targetRect.top, window.innerHeight - tooltipHeight - padding)),
          left: Math.max(padding, targetRect.left - tooltipWidth - padding),
          zIndex: 10001
        };
      case "bottom":
        return {
          position: "fixed",
          top: targetRect.bottom + padding,
          left: Math.max(padding, Math.min(targetRect.left, window.innerWidth - tooltipWidth - padding)),
          zIndex: 10001
        };
      case "top":
        return {
          position: "fixed",
          top: Math.max(padding, targetRect.top - tooltipHeight - padding),
          left: Math.max(padding, Math.min(targetRect.left, window.innerWidth - tooltipWidth - padding)),
          zIndex: 10001
        };
      default:
        return {
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 10001
        };
    }
  };
  
  const getArrowStyle = (): React.CSSProperties | null => {
    if (isCenter || !targetRect) return null;
    
    const arrowSize = 12;
    
    switch (step.position) {
      case "right":
        return {
          position: "absolute",
          left: -arrowSize,
          top: 24,
          width: 0,
          height: 0,
          borderTop: `${arrowSize}px solid transparent`,
          borderBottom: `${arrowSize}px solid transparent`,
          borderRight: `${arrowSize}px solid hsl(var(--card))`
        };
      case "left":
        return {
          position: "absolute",
          right: -arrowSize,
          top: 24,
          width: 0,
          height: 0,
          borderTop: `${arrowSize}px solid transparent`,
          borderBottom: `${arrowSize}px solid transparent`,
          borderLeft: `${arrowSize}px solid hsl(var(--card))`
        };
      case "bottom":
        return {
          position: "absolute",
          top: -arrowSize,
          left: 24,
          width: 0,
          height: 0,
          borderLeft: `${arrowSize}px solid transparent`,
          borderRight: `${arrowSize}px solid transparent`,
          borderBottom: `${arrowSize}px solid hsl(var(--card))`
        };
      case "top":
        return {
          position: "absolute",
          bottom: -arrowSize,
          left: 24,
          width: 0,
          height: 0,
          borderLeft: `${arrowSize}px solid transparent`,
          borderRight: `${arrowSize}px solid transparent`,
          borderTop: `${arrowSize}px solid hsl(var(--card))`
        };
      default:
        return null;
    }
  };
  
  return (
    <div className="fixed inset-0 z-[10000]">
      <div className="absolute inset-0 bg-black/70" />
      
      {targetRect && !isCenter && (
        <div
          className="absolute border-2 border-primary rounded-lg transition-all duration-300 pointer-events-none"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.5), 0 0 20px rgba(var(--primary), 0.3)",
            zIndex: 10000
          }}
        />
      )}
      
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          style={getTooltipStyle()}
          className="bg-card border border-border rounded-xl shadow-2xl w-80 max-w-[calc(100vw-32px)]"
        >
          {getArrowStyle() && (
            <div style={getArrowStyle() as React.CSSProperties} />
          )}
          
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
