import React, { useState } from 'react';
import { X, UserCheck, Loader } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { ClientTeam } from '@/types/team';
import { GoogleWorkspaceService, GoogleWorkspaceUser } from '../../utils/googleWorkspaceService';
import WorkspaceUserSelector from './WorkspaceUserSelector';

interface AddMemberFormProps {
  onClose: () => void;
  onSuccess: () => void;
  clientTeams: ClientTeam[];
}

const AddMemberForm: React.FC<AddMemberFormProps> = ({ onClose, onSuccess, clientTeams }) => {
  const [selectedUser, setSelectedUser] = useState<GoogleWorkspaceUser | null>(null);
  const [formData, setFormData] = useState({
    role: 'Team Member',
    clientTeamIds: [] as string[],
    addToAllTeams: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const { toast } = useToast();

  // Load available roles
  React.useEffect(() => {
    const loadRoles = async () => {
      try {
        const { data, error } = await supabase
          .from('member_roles')
          .select('*')
          .eq('is_active', true)
          .order('name');
        
        if (error) throw error;
        setAvailableRoles(data || []);
      } catch (error) {
        console.error('Error loading roles:', error);
      }
    };
    
    loadRoles();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser) {
      toast({
        title: "Validation Error",
        description: "Please select a team member from your workspace",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Check if user already exists
      // FIX: Used .maybeSingle() instead of .single() to avoid PGRST116 error when 0 rows are found
      const { data: existingMember, error: existError } = await (supabase as any)
        .from('team_members')
        .select('id')
        .eq('email', selectedUser.primaryEmail)
        .maybeSingle();

      if (existError) throw existError;

      if (existingMember) {
        throw new Error('This team member has already been added');
      }

      // 2. Find the UUID for the selected role
      // FIX: Find the actual role_id from the availableRoles array to satisfy the not-null constraint
      const selectedRoleData = availableRoles.find(r => r.name === formData.role);
      if (!selectedRoleData) {
        throw new Error('Invalid role selected');
      }

      // 3. Create team member with Google profile data
      const { data: memberData, error: memberError } = await (supabase as any)
        .from('team_members')
        .insert({
          name: selectedUser.name.fullName,
          email: selectedUser.primaryEmail,
          role: formData.role, // Kept for legacy compatibility if the column still exists
          role_id: selectedRoleData.id, // FIX: Added the required role_id
          is_active: true,
          google_calendar_id: selectedUser.primaryEmail,
          google_photo_url: selectedUser.thumbnailPhotoUrl || null,
          google_profile_data: {
            orgUnitPath: selectedUser.orgUnitPath,
            isAdmin: selectedUser.isAdmin,
            isDelegatedAdmin: selectedUser.isDelegatedAdmin,
            lastLoginTime: selectedUser.lastLoginTime,
            creationTime: selectedUser.creationTime,
            hasPhotoUrl: !!selectedUser.thumbnailPhotoUrl
          }
        })
        .select()
        .single();

      if (memberError) throw memberError;

      // 4. Add client team relationships
      const teamIds = formData.addToAllTeams ? clientTeams.map(t => t.id) : formData.clientTeamIds;
      
      if (teamIds.length > 0) {
        const relationships = teamIds.map(teamId => ({
          team_member_id: memberData.id,
          client_team_id: teamId
        }));

        const { error: relationshipError } = await (supabase as any)
          .from('team_member_client_teams')
          .insert(relationships);

        if (relationshipError) throw relationshipError;
      }

      toast({
        title: "Team Member Added",
        description: `${selectedUser.name.fullName} has been added successfully`,
      });

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error adding team member:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to add team member',
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTeamToggle = (teamId: string) => {
    setFormData(prev => ({
      ...prev,
      clientTeamIds: prev.clientTeamIds.includes(teamId)
        ? prev.clientTeamIds.filter(id => id !== teamId)
        : [...prev.clientTeamIds, teamId]
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-e3-space-blue rounded-lg p-6 w-full max-w-md border border-e3-white/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-e3-emerald">Add Team Member</h2>
          <button
            onClick={onClose}
            className="p-2 text-e3-white/60 hover:text-e3-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <WorkspaceUserSelector
            selectedUser={selectedUser}
            onUserSelect={setSelectedUser}
          />

          <div>
            <label className="block text-e3-white/80 text-sm font-medium mb-2">
              <UserCheck className="w-4 h-4 inline mr-2" />
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="w-full p-3 bg-e3-space-blue/50 border border-e3-white/20 rounded-lg text-e3-white focus:border-e3-azure focus:outline-none"
            >
              {availableRoles.map(role => (
                <option key={role.id} value={role.name}>{role.name}</option>
              ))}
            </select>
          </div>

          {clientTeams.length > 0 && (
            <div>
              <label className="block text-e3-white/80 text-sm font-medium mb-2">
                Client Teams Assignment
              </label>
              
              {/* Add to All Teams Checkbox */}
              <div className="mb-3">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.addToAllTeams}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      addToAllTeams: e.target.checked,
                      clientTeamIds: e.target.checked ? [] : prev.clientTeamIds
                    }))}
                    className="w-4 h-4 text-e3-emerald bg-e3-space-blue/50 border-e3-white/20 rounded focus:ring-e3-emerald"
                  />
                  <span className="text-e3-emerald text-sm font-medium">Add to all client teams</span>
                </label>
              </div>
              
              {!formData.addToAllTeams && (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {clientTeams.map(team => (
                    <label key={team.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.clientTeamIds.includes(team.id)}
                        onChange={() => handleTeamToggle(team.id)}
                        className="w-4 h-4 text-e3-azure bg-e3-space-blue/50 border-e3-white/20 rounded focus:ring-e3-azure"
                      />
                      <span className="text-e3-white/80 text-sm">{team.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-e3-white/20 text-e3-white/80 rounded-lg hover:bg-e3-white/5 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedUser}
              className="flex-1 py-2 px-4 bg-e3-azure text-e3-white rounded-lg hover:bg-e3-azure/80 transition disabled:opacity-50 flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <Loader className="w-4 h-4 animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                'Add Member'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddMemberForm;