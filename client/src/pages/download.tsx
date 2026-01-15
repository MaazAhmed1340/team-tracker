import { Monitor, Download as DownloadIcon, CheckCircle, Shield, Clock, Activity, Laptop } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: Clock,
    title: "Automatic Screenshots",
    description: "Captures screenshots at configurable intervals set by your admin",
  },
  {
    icon: Activity,
    title: "Activity Tracking",
    description: "Monitors keyboard and mouse activity for productivity metrics",
  },
  {
    icon: Shield,
    title: "Secure & Private",
    description: "All data is encrypted and transmitted securely to your team's server",
  },
];

const platforms = [
  {
    id: "windows",
    name: "Windows",
    version: "Windows 10+",
    extension: ".exe",
  },
  {
    id: "macos",
    name: "macOS",
    version: "macOS 10.13+",
    extension: ".dmg",
  },
  {
    id: "linux",
    name: "Linux",
    version: "Ubuntu 18.04+",
    extension: ".AppImage",
  },
];

const steps = [
  "Download the agent for your operating system",
  "Install and launch the application",
  "Enter your server URL and Team Member ID",
  "Connect and start monitoring",
];

export default function Download() {
  return (
    <div className="min-h-full p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Monitor className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            Download TeamTrack Agent
          </h1>
          <p className="mt-2 text-muted-foreground">
            Install the desktop agent to start monitoring your work activity
          </p>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="text-center">
              <CardContent className="pt-6">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Choose Your Platform</CardTitle>
            <CardDescription>
              Download the agent for your operating system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {platforms.map((platform) => (
                <div
                  key={platform.id}
                  className="flex flex-col items-center rounded-lg border p-6 hover-elevate"
                  data-testid={`card-platform-${platform.id}`}
                >
                  <Laptop className="mb-3 h-12 w-12" />
                  <h3 className="font-semibold">{platform.name}</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    {platform.version}
                  </p>
                  <Button
                    className="w-full"
                    data-testid={`button-download-${platform.id}`}
                  >
                    <DownloadIcon className="mr-2 h-4 w-4" />
                    Download {platform.extension}
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-lg bg-muted/50 p-4 text-center">
              <Badge variant="secondary" className="mb-2">
                Coming Soon
              </Badge>
              <p className="text-sm text-muted-foreground">
                Desktop agent downloads will be available once the builds are ready.
                For now, developers can build from source using the instructions below.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Installation Steps</CardTitle>
            <CardDescription>
              Get started with TeamTrack in just a few minutes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {steps.map((step, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    {index + 1}
                  </div>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>For Developers</CardTitle>
            <CardDescription>
              Build the desktop agent from source
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted p-4 font-mono text-sm">
              <p className="text-muted-foreground"># Clone and build the desktop agent</p>
              <p className="mt-2">cd desktop-agent</p>
              <p>npm install</p>
              <p>npm start</p>
              <p className="mt-4 text-muted-foreground"># Build for distribution</p>
              <p>npm run build:win   # Windows</p>
              <p>npm run build:mac   # macOS</p>
              <p>npm run build:linux # Linux</p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Need help? Contact your team administrator for your Team Member ID.</p>
        </div>
      </div>
    </div>
  );
}
