import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface LoginFormProps {
  onRegisterClick?: () => void;
}

export function LoginForm({ onRegisterClick }: LoginFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
    
    if (!password.trim()) {
      setError("Por favor ingresa una contraseña");
      return;
    }
    
    setIsSubmitting(true);
    const success = await login(username.trim(), password);
    setIsSubmitting(false);
    
    if (!success) {
      setError("Nombre de usuario o contraseña incorrectos");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold tracking-tight" data-testid="text-login-title">LIFEGAME</h1>
        <p className="text-sm text-muted-foreground italic mt-3" data-testid="text-motto">
          "IF YOU HAVE A PROBLEM, YOU HAVE A QUEST. LET'S PLAY"
        </p>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardDescription data-testid="text-login-description">
            Ingresa tus credenciales para continuar
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
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                data-testid="input-password"
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
            {onRegisterClick && (
              <Button 
                type="button"
                variant="outline"
                className="w-full"
                onClick={onRegisterClick}
                disabled={isSubmitting}
              >
                Crear Cuenta
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
