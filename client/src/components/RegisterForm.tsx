import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface RegisterFormProps {
  onBackToLogin: () => void;
}

export function RegisterForm({ onBackToLogin }: RegisterFormProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    if (!username.trim()) {
      setError("Por favor ingresa un nombre de usuario");
      return;
    }
    
    if (username.trim().length < 3) {
      setError("El nombre de usuario debe tener al menos 3 caracteres");
      return;
    }
    
    if (!password.trim()) {
      setError("Por favor ingresa una contraseña");
      return;
    }
    
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Try to login with the new credentials - this will create the user
      const success = await login(username.trim(), password);
      setIsSubmitting(false);
      
      if (success) {
        setSuccess("¡Usuario creado exitosamente!");
        // The user will be redirected automatically after login
      } else {
        setError("Error al crear el usuario. Intenta de nuevo.");
      }
    } catch (err) {
      setIsSubmitting(false);
      setError("Error al crear el usuario");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold tracking-tight">LIFEGAME</h1>
        <p className="text-sm text-muted-foreground italic mt-3">
          "IF YOU HAVE A PROBLEM, YOU HAVE A QUEST. LET'S PLAY"
        </p>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Crear Cuenta</CardTitle>
          <CardDescription>
            Crea una nueva cuenta para comenzar
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
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Confirmar contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {success && (
              <p className="text-sm text-green-600">{success}</p>
            )}
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creando..." : "Crear Cuenta"}
            </Button>
            <Button 
              type="button"
              variant="outline"
              className="w-full"
              onClick={onBackToLogin}
              disabled={isSubmitting}
            >
              Volver al Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
