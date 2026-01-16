import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Calendar, Download, Clock, BarChart3, Users, Monitor } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { TeamMember, AppUsageSummary } from "@shared/schema";

type DateRange = "today" | "yesterday" | "thisWeek" | "lastWeek" | "thisMonth" | "last7days" | "last30days";

interface ProductivityData {
  date: string;
  activeTime: number;
  idleTime: number;
  screenshots: number;
}

interface TimeBreakdown {
  memberId: string;
  memberName: string;
  totalTime: number;
  activeTime: number;
  idleTime: number;
  projects: { name: string; duration: number }[];
}

interface TeamAppUsage {
  appName: string;
  appType: string;
  totalDuration: number;
  userCount: number;
}

interface ReportData {
  productivity: ProductivityData[];
  timeBreakdown: TimeBreakdown[];
  teamAppUsage: TeamAppUsage[];
  summary: {
    totalActiveTime: number;
    totalIdleTime: number;
    totalScreenshots: number;
    avgActivityScore: number;
  };
}

function getDateRange(range: DateRange): { start: Date; end: Date } {
  const now = new Date();
  switch (range) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday":
      const yesterday = subDays(now, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    case "thisWeek":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "lastWeek":
      const lastWeekStart = subDays(startOfWeek(now, { weekStartsOn: 1 }), 7);
      return { start: lastWeekStart, end: subDays(startOfWeek(now, { weekStartsOn: 1 }), 1) };
    case "thisMonth":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "last7days":
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    case "last30days":
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatHours(seconds: number): string {
  const hours = (seconds / 3600).toFixed(1);
  return `${hours}h`;
}

function escapeCSVField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export default function Reports() {
  const [dateRange, setDateRange] = useState<DateRange>("last7days");
  const { start, end } = getDateRange(dateRange);

  const queryParams = new URLSearchParams({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  }).toString();

  const { data: reportData, isLoading } = useQuery<ReportData>({
    queryKey: ["/api/reports", { startDate: start.toISOString(), endDate: end.toISOString() }],
    queryFn: async () => {
      const res = await fetch(`/api/reports?${queryParams}`);
      if (!res.ok) throw new Error("Failed to fetch report data");
      return res.json();
    },
  });

  const handleExportCSV = () => {
    if (!reportData) return;
    
    const rows = [
      ["Report Type", "Date Range", format(start, "yyyy-MM-dd"), "to", format(end, "yyyy-MM-dd")],
      [],
      ["Summary"],
      ["Total Active Time", formatDuration(reportData.summary.totalActiveTime)],
      ["Total Idle Time", formatDuration(reportData.summary.totalIdleTime)],
      ["Total Screenshots", reportData.summary.totalScreenshots.toString()],
      ["Avg Activity Score", `${reportData.summary.avgActivityScore.toFixed(1)}%`],
      [],
      ["Time Breakdown by Team Member"],
      ["Name", "Total Time", "Active Time", "Idle Time"],
      ...reportData.timeBreakdown.map(tb => [
        escapeCSVField(tb.memberName),
        formatDuration(tb.totalTime),
        formatDuration(tb.activeTime),
        formatDuration(tb.idleTime),
      ]),
      [],
      ["App Usage"],
      ["Application", "Type", "Total Duration", "Users"],
      ...reportData.teamAppUsage.map(app => [
        escapeCSVField(app.appName),
        escapeCSVField(app.appType),
        formatDuration(app.totalDuration),
        app.userCount.toString(),
      ]),
    ];

    const csvContent = rows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `teamtrack-report-${format(start, "yyyy-MM-dd")}-to-${format(end, "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const chartData = reportData?.productivity.map(p => ({
    date: format(new Date(p.date), "MMM d"),
    "Active Time (hrs)": Number((p.activeTime / 3600).toFixed(2)),
    "Idle Time (hrs)": Number((p.idleTime / 3600).toFixed(2)),
  })) || [];

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="page-reports">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Analyze team productivity and activity</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-[180px]" data-testid="select-date-range">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="yesterday">Yesterday</SelectItem>
              <SelectItem value="last7days">Last 7 Days</SelectItem>
              <SelectItem value="thisWeek">This Week</SelectItem>
              <SelectItem value="lastWeek">Last Week</SelectItem>
              <SelectItem value="thisMonth">This Month</SelectItem>
              <SelectItem value="last30days">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            onClick={handleExportCSV}
            disabled={!reportData}
            data-testid="button-export-csv"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-total-active-time">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total Active Time
                </span>
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <span className="text-2xl font-bold" data-testid="text-total-active-time">
                    {formatHours(reportData?.summary.totalActiveTime || 0)}
                  </span>
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-idle-time">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total Idle Time
                </span>
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <span className="text-2xl font-bold" data-testid="text-total-idle-time">
                    {formatHours(reportData?.summary.totalIdleTime || 0)}
                  </span>
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-screenshots-count">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Screenshots
                </span>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <span className="text-2xl font-bold" data-testid="text-screenshots-count">
                    {reportData?.summary.totalScreenshots || 0}
                  </span>
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-avg-activity">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Avg Activity
                </span>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <span className="text-2xl font-bold" data-testid="text-avg-activity">
                    {(reportData?.summary.avgActivityScore || 0).toFixed(0)}%
                  </span>
                )}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-status-online/10">
                <Users className="h-5 w-5 text-status-online" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-productivity-chart">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg font-medium">
            <BarChart3 className="h-4 w-4" />
            Productivity Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  label={{ value: 'Hours', angle: -90, position: 'insideLeft', fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                <Legend />
                <Bar dataKey="Active Time (hrs)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Idle Time (hrs)" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              No productivity data for this period
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card data-testid="card-time-breakdown">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg font-medium">
              <Users className="h-4 w-4" />
              Time by Team Member
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : reportData?.timeBreakdown && reportData.timeBreakdown.length > 0 ? (
              <div className="flex flex-col gap-3">
                {reportData.timeBreakdown.map((member) => (
                  <div 
                    key={member.memberId} 
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    data-testid={`row-member-time-${member.memberId}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{member.memberName}</span>
                      <span className="text-xs text-muted-foreground">
                        Active: {formatDuration(member.activeTime)} / Idle: {formatDuration(member.idleTime)}
                      </span>
                    </div>
                    <span className="text-lg font-semibold">{formatDuration(member.totalTime)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-6">
                No time tracking data for this period
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-app-analytics">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg font-medium">
              <Monitor className="h-4 w-4" />
              Top Applications
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : reportData?.teamAppUsage && reportData.teamAppUsage.length > 0 ? (
              <div className="flex flex-col gap-3">
                {reportData.teamAppUsage.slice(0, 8).map((app, index) => (
                  <div 
                    key={`${app.appName}-${index}`}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    data-testid={`row-app-usage-${index}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{app.appName}</span>
                      <span className="text-xs text-muted-foreground">
                        {app.appType} • {app.userCount} user{app.userCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="text-lg font-semibold">{formatDuration(app.totalDuration)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-6">
                No app usage data for this period
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
