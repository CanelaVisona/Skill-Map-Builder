import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import SkillTreePage from "@/pages/SkillTree";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { AuthPage } from "@/components/AuthPage";
import { useState } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={SkillTreePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AdminFixNodesButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [isDev] = useState(() => import.meta.env.DEV);

  if (!isDev) return null;

  const handleFixNodes = async () => {
    if (!confirm("¿Ejecutar migración para corregir nodos bloqueados?")) return;
    
    setIsLoading(true);
    try {
      const response = await fetch("/api/migrations/fix-locked-nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(`✅ Migración completada\n\nNodos corregidos: ${data.fixedCount}\n\nDetalles:\n${data.fixes.slice(0, 10).join('\n')}`);
      } else {
        alert("❌ Error en la migración");
      }
    } catch (error) {
      console.error("Migration error:", error);
      alert("❌ Error al ejecutar la migración");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleFixNodes}
      disabled={isLoading}
      className="fixed bottom-4 right-4 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium z-50 shadow-lg"
      title="Ejecutar migración para corregir nodos"
    >
      🔧 Fix Nodes
    </button>
  );
}

function AuthenticatedApp() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Cargando...</div>
      </div>
    );
  }
  
  if (!user) {
    return <AuthPage />;
  }
  
  return (
    <>
      <Router />
      <AdminFixNodesButton />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <AuthenticatedApp />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
