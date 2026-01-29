import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Settings as SettingsIcon, Camera, Bell, Shield, Save, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { UserManagement } from "@/components/user-management";
import { useAuth } from "@/contexts/auth-context";

const settingsSchema = z.object({
  screenshotInterval: z.number().min(1).max(60),
  enableActivityTracking: z.boolean(),
  enableMouseTracking: z.boolean(),
  enableKeyboardTracking: z.boolean(),
  enableNotifications: z.boolean(),
  idleThreshold: z.number().min(1).max(30),
  blurSensitiveContent: z.boolean(),
  autoStartMonitoring: z.boolean(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

interface AppSettings {
  screenshotInterval: number;
  enableActivityTracking: boolean;
  enableMouseTracking: boolean;
  enableKeyboardTracking: boolean;
  enableNotifications: boolean;
  idleThreshold: number;
  blurSensitiveContent: boolean;
  autoStartMonitoring: boolean;
}

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: settings, isLoading } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      screenshotInterval: 5,
      enableActivityTracking: true,
      enableMouseTracking: true,
      enableKeyboardTracking: true,
      enableNotifications: true,
      idleThreshold: 5,
      blurSensitiveContent: false,
      autoStartMonitoring: true,
    },
    values: settings,
  });

  const mutation = useMutation({
    mutationFn: async (data: SettingsFormData) => {
      return apiRequest("PUT", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Settings saved",
        description: "Your settings have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SettingsFormData) => {
    mutation.mutate(data);
  };

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="page-settings">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Configure monitoring and notification preferences
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <Tabs defaultValue="screenshots" className="space-y-6">
            <TabsList>
              <TabsTrigger value="screenshots" data-testid="tab-screenshots">
                <Camera className="mr-2 h-4 w-4" />
                Screenshots
              </TabsTrigger>
              <TabsTrigger value="activity" data-testid="tab-activity">
                <SettingsIcon className="mr-2 h-4 w-4" />
                Activity
              </TabsTrigger>
              <TabsTrigger value="notifications" data-testid="tab-notifications">
                <Bell className="mr-2 h-4 w-4" />
                Notifications
              </TabsTrigger>
              <TabsTrigger value="privacy" data-testid="tab-privacy">
                <Shield className="mr-2 h-4 w-4" />
                Privacy
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="team" data-testid="tab-team">
                  <Users className="mr-2 h-4 w-4" />
                  Team
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="screenshots">
              <Card>
                <CardHeader>
                  <CardTitle>Screenshot Settings</CardTitle>
                  <CardDescription>
                    Configure how often screenshots are captured
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </div>
                  ) : (
                    <>
                      <FormField
                        control={form.control}
                        name="screenshotInterval"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Screenshot Interval</FormLabel>
                              <span className="text-sm font-medium">
                                Every {field.value} minute{field.value !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <FormControl>
                              <Slider
                                min={1}
                                max={30}
                                step={1}
                                value={[field.value]}
                                onValueChange={(value) => field.onChange(value[0])}
                                data-testid="slider-screenshot-interval"
                              />
                            </FormControl>
                            <FormDescription>
                              How often to capture screenshots from team members
                            </FormDescription>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="autoStartMonitoring"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel>Auto-start Monitoring</FormLabel>
                              <FormDescription>
                                Automatically start monitoring when team members come online
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-auto-start"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity">
              <Card>
                <CardHeader>
                  <CardTitle>Activity Tracking</CardTitle>
                  <CardDescription>
                    Configure what activity data to collect
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoading ? (
                    <div className="space-y-4">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : (
                    <>
                      <FormField
                        control={form.control}
                        name="enableActivityTracking"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel>Enable Activity Tracking</FormLabel>
                              <FormDescription>
                                Track overall activity levels and idle time
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-activity-tracking"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="enableMouseTracking"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel>Mouse Activity</FormLabel>
                              <FormDescription>
                                Track mouse movements and clicks
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-mouse-tracking"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="enableKeyboardTracking"
                        render={({ field }) => (
                          <FormItem className="flex items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel>Keyboard Activity</FormLabel>
                              <FormDescription>
                                Track keyboard usage (keypress counts only)
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="switch-keyboard-tracking"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="idleThreshold"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Idle Threshold</FormLabel>
                              <span className="text-sm font-medium">
                                {field.value} minute{field.value !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <FormControl>
                              <Slider
                                min={1}
                                max={30}
                                step={1}
                                value={[field.value]}
                                onValueChange={(value) => field.onChange(value[0])}
                                data-testid="slider-idle-threshold"
                              />
                            </FormControl>
                            <FormDescription>
                              Mark user as idle after this period of inactivity
                            </FormDescription>
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications">
              <Card>
                <CardHeader>
                  <CardTitle>Notification Settings</CardTitle>
                  <CardDescription>
                    Configure when and how you receive notifications
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoading ? (
                    <Skeleton className="h-16 w-full" />
                  ) : (
                    <FormField
                      control={form.control}
                      name="enableNotifications"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel>Enable Notifications</FormLabel>
                            <FormDescription>
                              Receive alerts for extended idle periods and status changes
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-notifications"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="privacy">
              <Card>
                <CardHeader>
                  <CardTitle>Privacy Settings</CardTitle>
                  <CardDescription>
                    Configure privacy and data protection options
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {isLoading ? (
                    <Skeleton className="h-16 w-full" />
                  ) : (
                    <FormField
                      control={form.control}
                      name="blurSensitiveContent"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel>Blur Sensitive Content</FormLabel>
                            <FormDescription>
                              Automatically blur potentially sensitive information in screenshots
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-blur-content"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {isAdmin && (
              <TabsContent value="team">
                <UserManagement />
              </TabsContent>
            )}
          </Tabs>

          <div className="mt-6 flex justify-end">
            <Button
              type="submit"
              disabled={mutation.isPending}
              data-testid="button-save-settings"
            >
              <Save className="mr-2 h-4 w-4" />
              {mutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
