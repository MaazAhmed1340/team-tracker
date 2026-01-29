// client/src/pages/signup.tsx
import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

interface SignupPayload {
  email: string;
  password: string;
  confirmPassword: string;
  companyName: string;
}

interface SignupResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    companyId?: string;
  };
  teamMember: {
    id: string;
    name: string;
    email: string;
  };
  company?: {
    id: string;
    name: string;
    email: string;
  };
}

export default function Signup() {
  const [, navigate] = useLocation();
  const { login } = useAuth();

  const [form, setForm] = useState<SignupPayload>({
    email: "",
    password: "",
    confirmPassword: "",
    companyName: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/company-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          companyName: form.companyName,
          companyEmail: form.email,
          adminEmail: form.email,
          adminPassword: form.password,
        }),
      });

      const data = (await res.json()) as SignupResponse | { error: string };
      if ("error" in data) throw new Error(data.error);

      login(data.user, data.accessToken);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Sign up</CardTitle>
          <p className="text-sm text-muted-foreground">
            Create an account to register your company
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              name="companyName"
              type="text"
              placeholder="Company Name"
              required
              value={form.companyName}
              onChange={handleInputChange}
              data-testid="input-companyName"
            />

            <Input
              name="email"
              type="email"
              placeholder="Email"
              required
              value={form.email}
              onChange={handleInputChange}
              data-testid="input-email"
            />

            <Input
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              required
              value={form.password}
              onChange={handleInputChange}
              data-testid="input-password"
              iconRight={
                showPassword ? (
                  <EyeOff className="h-4 w-4" onClick={() => setShowPassword(false)} />
                ) : (
                  <Eye className="h-4 w-4" onClick={() => setShowPassword(true)} />
                )
              }
            />

            <Input
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm Password"
              required
              value={form.confirmPassword}
              onChange={handleInputChange}
              data-testid="input-confirm-password"
              iconRight={
                showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" onClick={() => setShowConfirmPassword(false)} />
                ) : (
                  <Eye className="h-4 w-4" onClick={() => setShowConfirmPassword(true)} />
                )
              }
            />

            {error && (
              <p className="text-sm text-destructive" data-testid="signup-error">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading} data-testid="btn-signup">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing up...
                </>
              ) : (
                "Sign up"
              )}
            </Button>

            <div className="flex justify-between text-sm text-muted-foreground">
              <a href="/login" className="text-primary hover:underline">
                Already have an account? Sign in
              </a>
              <a href="/forgot-password" className="text-primary hover:underline">
                Forgot password?
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
