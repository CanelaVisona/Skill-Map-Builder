import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm() {
  const [username, setUsername] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!username.trim()) {
      setError("Por favor ingresa un nombre de usuario");
      return;
    }
    
    setIsSubmitting(true);
    const success = await login(username.trim());
    setIsSubmitting(false);
    
    if (!success) {
      setError("Error al iniciar sesión. Intenta de nuevo.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold" data-testid="text-login-title">LIFEGAME</CardTitle>
          <p className="text-sm text-muted-foreground italic mt-2" data-testid="text-motto">
            "IF YOU HAVE A PROBLEM, YOU HAVE A QUEST. LET'S PLAY"
          </p>
          <CardDescription className="mt-4" data-testid="text-login-description">
            Ingresa tu nombre de usuario para continuar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Nombre de usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isSubmitting}
                autoFocus
                data-testid="input-username"
              />
              {error && (
                <p className="text-sm text-destructive" data-testid="text-login-error">{error}</p>
              )}
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting}
              data-testid="button-login"
            >
              {isSubmitting ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
