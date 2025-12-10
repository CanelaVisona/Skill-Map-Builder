import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  Target, 
  BookOpen, 
  ChevronRight, 
  ChevronLeft, 
  MousePointer2,
  CheckCircle2,
  Edit3,
  Layers,
  HelpCircle,
  X
} from "lucide-react";

const ONBOARDING_KEY = "skill-tree-onboarding-completed";

interface OnboardingGuideProps {
  onComplete: () => void;
  isOpen: boolean;
}

const welcomeSteps = [
  {
    icon: Sparkles,
    title: "¡Bienvenido a tu Skill Tree!",
    description: "Una herramienta visual para organizar tu crecimiento personal. Aquí podrás crear árboles de habilidades, proyectos y un diario de reflexiones.",
    color: "from-purple-500 to-pink-500"
  },
  {
    icon: Target,
    title: "Áreas de Habilidades",
    description: "Las Áreas son para habilidades continuas que quieres desarrollar a largo plazo. Por ejemplo: tocar guitarra, aprender idiomas, o mejorar tu salud.",
    color: "from-blue-500 to-cyan-500"
  },
  {
    icon: Layers,
    title: "Proyectos",
    description: "Los Proyectos son para metas con un fin específico. Por ejemplo: planificar un viaje, organizar un evento, o completar un curso.",
    color: "from-green-500 to-emerald-500"
  },
  {
    icon: BookOpen,
    title: "Tu Diario Personal",
    description: "El Diario tiene 4 secciones: Logros (tareas completadas), Personajes (personas importantes), Lugares (espacios significativos) y Sombras (desafíos a superar).",
    color: "from-amber-500 to-orange-500"
  }
];

const tourSteps = [
  {
    icon: MousePointer2,
    title: "Crear un Área o Proyecto",
    description: "Toca el botón '+' en el menú lateral para crear una nueva área de habilidades o un proyecto.",
    tip: "Las áreas tienen un ícono de infinito ∞, los proyectos tienen un ícono de bandera."
  },
  {
    icon: CheckCircle2,
    title: "Completar Nodos",
    description: "Toca un nodo para marcarlo como completado. Los nodos se desbloquean en orden: primero completa los anteriores.",
    tip: "Los nodos bloqueados aparecen en gris, los disponibles en color, y los completados tienen un check."
  },
  {
    icon: Edit3,
    title: "Modificar un Nodo",
    description: "Mantén presionado un nodo para abrir el menú de edición. Ahí puedes cambiar el título, descripción, y escribir feedback.",
    tip: "El feedback es tu reflexión personal sobre lo que aprendiste o lograste."
  },
  {
    icon: Layers,
    title: "Subtareas",
    description: "Toca el título de un nodo (el texto) para ver sus subtareas. Cada nodo puede tener su propio árbol de pasos.",
    tip: "Las subtareas te ayudan a dividir grandes metas en pasos pequeños y manejables."
  },
  {
    icon: BookOpen,
    title: "Abrir el Diario",
    description: "Toca el ícono del libro en la esquina superior derecha para abrir tu diario personal.",
    tip: "En 'Logros' verás todas las tareas que completaste, junto con tus feedbacks."
  }
];

export function OnboardingGuide({ onComplete, isOpen }: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [phase, setPhase] = useState<"welcome" | "tour">("welcome");
  
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setPhase("welcome");
    }
  }, [isOpen]);
  
  const totalWelcomeSteps = welcomeSteps.length;
  const totalTourSteps = tourSteps.length;
  
  const handleNext = () => {
    if (phase === "welcome") {
      if (currentStep < totalWelcomeSteps - 1) {
        setCurrentStep(prev => prev + 1);
      } else {
        setPhase("tour");
        setCurrentStep(0);
      }
    } else {
      if (currentStep < totalTourSteps - 1) {
        setCurrentStep(prev => prev + 1);
      } else {
        handleComplete();
      }
    }
  };
  
  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    } else if (phase === "tour") {
      setPhase("welcome");
      setCurrentStep(totalWelcomeSteps - 1);
    }
  };
  
  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    onComplete();
  };
  
  const handleSkip = () => {
    handleComplete();
  };
  
  const currentData = phase === "welcome" ? welcomeSteps[currentStep] : tourSteps[currentStep];
  const Icon = currentData.icon;
  const progress = phase === "welcome" 
    ? ((currentStep + 1) / totalWelcomeSteps) * 50 
    : 50 + ((currentStep + 1) / totalTourSteps) * 50;
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleSkip()}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-background border border-border">
        <DialogTitle className="sr-only">Guía de bienvenida</DialogTitle>
        
        <div className="relative">
          <div className="h-1 bg-muted">
            <motion.div 
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          
          <button 
            onClick={handleSkip}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          
          <div className="p-8">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${phase}-${currentStep}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div className="flex justify-center">
                  <div className={`p-4 rounded-2xl bg-gradient-to-br ${phase === "welcome" ? (currentData as typeof welcomeSteps[0]).color : "from-violet-500 to-purple-500"}`}>
                    <Icon className="h-10 w-10 text-white" />
                  </div>
                </div>
                
                <div className="text-center space-y-3">
                  <h2 className="text-xl font-semibold text-foreground">
                    {currentData.title}
                  </h2>
                  <p className="text-muted-foreground leading-relaxed">
                    {currentData.description}
                  </p>
                  {phase === "tour" && (currentData as typeof tourSteps[0]).tip && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-border">
                      <p className="text-sm text-muted-foreground">
                        💡 {(currentData as typeof tourSteps[0]).tip}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
            
            <div className="flex items-center justify-between mt-8">
              <Button
                variant="ghost"
                onClick={handlePrev}
                disabled={phase === "welcome" && currentStep === 0}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              
              <div className="flex gap-1">
                {(phase === "welcome" ? welcomeSteps : tourSteps).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-1.5 rounded-full transition-colors ${
                      i === currentStep ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
              
              <Button onClick={handleNext} className="gap-1">
                {phase === "tour" && currentStep === totalTourSteps - 1 ? (
                  "¡Empezar!"
                ) : (
                  <>
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </div>
          
          <div className="px-8 pb-6">
            <p className="text-xs text-center text-muted-foreground">
              {phase === "welcome" ? "Introducción" : "Tutorial"} • Paso {currentStep + 1} de {phase === "welcome" ? totalWelcomeSteps : totalTourSteps}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
      data-testid="button-help"
      title="Ver guía"
    >
      <HelpCircle className="h-5 w-5" />
    </button>
  );
}

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
