import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Camera, Filter, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScreenshotCard } from "@/components/screenshot-card";
import { ScreenshotLightbox } from "@/components/screenshot-lightbox";
import { EmptyState } from "@/components/empty-state";
import { ScreenshotCardSkeleton } from "@/components/loading-skeleton";
import type { ScreenshotWithMember, TeamMember } from "@shared/schema";

export default function Screenshots() {
  const [selectedScreenshot, setSelectedScreenshot] = useState<ScreenshotWithMember | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [selectedMember, setSelectedMember] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");

  const { data: screenshots, isLoading } = useQuery<ScreenshotWithMember[]>({
    queryKey: ["/api/screenshots"],
  });

  const { data: teamMembers } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
  });

  const filteredScreenshots = useMemo(() => {
    if (!screenshots) return [];
    
    return screenshots.filter((screenshot) => {
      if (selectedMember !== "all" && screenshot.teamMemberId !== selectedMember) {
        return false;
      }
      if (dateFilter) {
        const screenshotDate = format(new Date(screenshot.capturedAt), "yyyy-MM-dd");
        if (screenshotDate !== dateFilter) {
          return false;
        }
      }
      return true;
    });
  }, [screenshots, selectedMember, dateFilter]);

  const openLightbox = (screenshot: ScreenshotWithMember, index: number) => {
    setSelectedScreenshot(screenshot);
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setSelectedScreenshot(null);
  };

  const goToPrevious = () => {
    if (filteredScreenshots && lightboxIndex > 0) {
      const newIndex = lightboxIndex - 1;
      setLightboxIndex(newIndex);
      setSelectedScreenshot(filteredScreenshots[newIndex]);
    }
  };

  const goToNext = () => {
    if (filteredScreenshots && lightboxIndex < filteredScreenshots.length - 1) {
      const newIndex = lightboxIndex + 1;
      setLightboxIndex(newIndex);
      setSelectedScreenshot(filteredScreenshots[newIndex]);
    }
  };

  const clearFilters = () => {
    setSelectedMember("all");
    setDateFilter("");
  };

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="page-screenshots">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Screenshots</h1>
          <p className="text-muted-foreground">
            Browse and filter captured screenshots
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg font-medium">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
          {(selectedMember !== "all" || dateFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              data-testid="button-clear-filters"
            >
              Clear filters
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="member-filter">Team Member</Label>
              <Select
                value={selectedMember}
                onValueChange={setSelectedMember}
              >
                <SelectTrigger
                  id="member-filter"
                  className="w-[200px]"
                  data-testid="select-member-filter"
                >
                  <SelectValue placeholder="All members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All members</SelectItem>
                  {teamMembers?.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="date-filter">Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="date-filter"
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-[200px] pl-9"
                  data-testid="input-date-filter"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ScreenshotCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredScreenshots.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {filteredScreenshots.map((screenshot, index) => (
            <ScreenshotCard
              key={screenshot.id}
              screenshot={screenshot}
              onClick={() => openLightbox(screenshot, index)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={Camera}
              title="No screenshots found"
              description={
                selectedMember !== "all" || dateFilter
                  ? "Try adjusting your filters to see more results"
                  : "Screenshots will appear here once your team starts working"
              }
              action={
                (selectedMember !== "all" || dateFilter) && (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )
              }
            />
          </CardContent>
        </Card>
      )}

      <ScreenshotLightbox
        screenshot={selectedScreenshot}
        isOpen={!!selectedScreenshot}
        onClose={closeLightbox}
        onPrevious={goToPrevious}
        onNext={goToNext}
        hasPrevious={lightboxIndex > 0}
        hasNext={filteredScreenshots ? lightboxIndex < filteredScreenshots.length - 1 : false}
      />
    </div>
  );
}
