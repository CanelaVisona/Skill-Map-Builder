import { useState } from "react";
import { LoginForm } from "@/components/LoginForm";
import { RegisterForm } from "@/components/RegisterForm";

export function AuthPage() {
  const [isRegistering, setIsRegistering] = useState(false);

  if (isRegistering) {
    return (
      <RegisterForm onBackToLogin={() => setIsRegistering(false)} />
    );
  }

  return (
    <LoginForm onRegisterClick={() => setIsRegistering(true)} />
  );
}
