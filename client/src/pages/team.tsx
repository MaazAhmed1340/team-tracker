import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Users, Plus, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TeamMemberRow } from "@/components/team-member-row";
import { EmptyState } from "@/components/empty-state";
import { TeamMemberRowSkeleton } from "@/components/loading-skeleton";
import { AddTeamMemberForm } from "@/components/add-team-member-form";
import { queryClient } from "@/lib/queryClient";
import type { TeamMemberWithStats } from "@shared/schema";

export default function Team() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const { data: teamMembers, isLoading } = useQuery<TeamMemberWithStats[]>({
    queryKey: ["/api/team-members/with-stats"],
  });

  const filteredMembers = teamMembers?.filter((member) =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddSuccess = () => {
    setIsAddDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
    queryClient.invalidateQueries({ queryKey: ["/api/team-members/with-stats"] });
  };

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="page-team">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team</h1>
          <p className="text-muted-foreground">
            Manage your team members and their monitoring settings
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-member">
              <Plus className="mr-2 h-4 w-4" />
              Add Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Team Member</DialogTitle>
            </DialogHeader>
            <AddTeamMemberForm onSuccess={handleAddSuccess} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search team members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-team"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {teamMembers?.length ?? 0} member{teamMembers?.length !== 1 ? "s" : ""}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <TeamMemberRowSkeleton key={i} />
              ))}
            </div>
          ) : filteredMembers && filteredMembers.length > 0 ? (
            <div className="divide-y">
              {filteredMembers.map((member) => (
                <TeamMemberRow
                  key={member.id}
                  member={member}
                  onClick={() => navigate(`/team/${member.id}`)}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Users}
              title={searchQuery ? "No results found" : "No team members"}
              description={
                searchQuery
                  ? "Try adjusting your search query"
                  : "Add team members to start monitoring their activity"
              }
              action={
                !searchQuery && (
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Member
                  </Button>
                )
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
