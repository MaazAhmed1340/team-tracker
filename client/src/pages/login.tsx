// client/src/pages/login.tsx
import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";

interface LoginPayload {
  email: string;
  password: string;
  remember?: boolean;
}

interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export default function Login() {
  const [, navigate] = useLocation();
  const { login } = useAuth();

  const [form, setForm] = useState<LoginPayload>({
    email: "",
    password: "",
    remember: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (checked: boolean) => {
    setForm((prev) => ({ ...prev, remember: checked }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });

      const data = (await res.json()) as LoginResponse | { error: string };
      if ("error" in data) throw new Error(data.error);

      login(data.user, data.accessToken);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <p className="text-sm text-muted-foreground">Enter your email and password to continue</p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2">
                <Checkbox checked={form.remember} onCheckedChange={handleCheckboxChange} />
                <span className="text-sm text-muted-foreground">Remember me</span>
              </label>

              <a href="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot password?
              </a>
            </div>

            {error && (
              <p className="text-sm text-destructive" data-testid="login-error">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading} data-testid="btn-login">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>

            <div className="flex justify-center text-sm text-muted-foreground">
              <a href="/signup" className="text-primary hover:underline">
                Don't have an account? Sign up
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
