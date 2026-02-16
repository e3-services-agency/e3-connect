
import React, { useState } from 'react';
import { Plus, Settings, Calendar, Users, Edit, Trash2, Loader, Cog, Save, X, Building, UserCog } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTeamData } from '../hooks/useTeamData';
import { GoogleCalendarService } from '../utils/googleCalendarService';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '../integrations/supabase/client';
import AddMemberForm from './forms/AddMemberForm';
import AddTeamForm from './forms/AddTeamForm';
import TeamRolesManager from './TeamRolesManager';

const TeamConfig: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'members' | 'teams' | 'roles'>('members');
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const { toast } = useToast();  
  const { teamMembers = [], clientTeams = [], loading, error, refetch } = useTeamData() || {};

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

  const handleConnectGoogleCalendar = async (memberId: string) => {
    const member = teamMembers.find(m => m.id === memberId);
    if (!member) return;

    try {
      // Test if we can access the user's calendar using domain-wide delegation
      const isConnected = await GoogleCalendarService.testConnection();
      
      if (isConnected) {
        toast({
          title: "Calendar Access Confirmed",
          description: `${member.name}'s calendar is accessible through domain-wide delegation.`,
        });
        
        // In a real implementation, you would update the member's calendar status
        console.log(`Calendar access confirmed for ${member.email}`);
      } else {
        throw new Error('Domain-wide delegation not properly configured');
      }
    } catch (error) {
      console.error('Error connecting calendar:', error);
      toast({
        title: "Calendar Connection Failed",
        description: error instanceof Error ? error.message : 'Failed to connect calendar',
        variant: "destructive",
      });
    }
  };

  const handleAddMemberSuccess = () => {
    refetch();
    toast({
      title: "Success",
      description: "Team member added and calendar access configured",
    });
  };

  const handleAddTeamSuccess = () => {
    refetch();
    toast({
      title: "Success",
      description: "Client team created successfully",
    });
  };

  const handleEditMember = (member: any) => {
    setEditingMember(member.id);
    setEditData({
      name: member.name,
      role: member.role,
      is_active: member.isActive,
      clientTeams: (member.clientTeams || []).map((team: any) => team.id)
    });
  };

  const handleSaveMember = async (memberId: string) => {
    try {
      // Find the role_id for the selected role name
      const { data: roleData, error: roleError } = await supabase
        .from('member_roles')
        .select('id')
        .eq('name', editData.role)
        .eq('is_active', true)
        .single();

      if (roleError) {
        console.error('Error finding role:', roleError);
        throw new Error('Selected role not found');
      }

      // Update member details with role_id
      const { error: memberError } = await supabase
        .from('team_members')
        .update({
          name: editData.name,
          role_id: roleData.id,
          is_active: editData.is_active
        })
        .eq('id', memberId);

      if (memberError) throw memberError;

      // Update client team assignments
      if (editData.clientTeams) {
        // First, remove all existing assignments
        const { error: deleteError } = await supabase
          .from('team_member_client_teams')
          .delete()
          .eq('team_member_id', memberId);

        if (deleteError) throw deleteError;

        // Then, add new assignments
        if (editData.clientTeams.length > 0) {
          const { error: insertError } = await supabase
            .from('team_member_client_teams')
            .insert(
              editData.clientTeams.map((teamId: string) => ({
                team_member_id: memberId,
                client_team_id: teamId
              }))
            );

          if (insertError) throw insertError;
        }
      }

      setEditingMember(null);
      setEditData(null);
      refetch();
      toast({
        title: "Success",
        description: "Team member updated successfully",
      });
    } catch (error) {
      console.error('Error updating member:', error);
      toast({
        title: "Error",
        description: "Failed to update team member",
        variant: "destructive",
      });
    }
  };

  const handleDeleteMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to delete ${memberName}? This action cannot be undone.`)) return;

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      refetch();
      toast({
        title: "Success",
        description: "Team member deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting member:', error);
      toast({
        title: "Error",
        description: "Failed to delete team member",
        variant: "destructive",
      });
    }
  };

  const handleEditTeam = (team: any) => {
    setEditingTeam(team.id);
    const teamMemberIds = teamMembers
      .filter(member => member.clientTeams.some((ct: any) => ct.id === team.id))
      .map(member => member.id);
    
    setEditData({
      name: team.name,
      description: team.description,
      is_active: team.isActive,
      booking_slug: team.booking_slug || team.name.toLowerCase().replace(/\s+/g, '-'),
      teamMembers: teamMemberIds
    });
  };

  const handleSaveTeam = async (teamId: string) => {
    try {
      // Update team details including booking_slug
      const { error: teamError } = await supabase
        .from('client_teams')
        .update({
          name: editData.name,
          description: editData.description,
          is_active: editData.is_active,
          booking_slug: editData.booking_slug
        })
        .eq('id', teamId);

      if (teamError) throw teamError;

      // Update team member assignments
      if (editData.teamMembers !== undefined) {
        // First, remove all existing assignments
        const { error: deleteError } = await supabase
          .from('team_member_client_teams')
          .delete()
          .eq('client_team_id', teamId);

        if (deleteError) throw deleteError;

        // Then, add new assignments
        if (editData.teamMembers.length > 0) {
          const { error: insertError } = await supabase
            .from('team_member_client_teams')
            .insert(
              editData.teamMembers.map((memberId: string) => ({
                team_member_id: memberId,
                client_team_id: teamId
              }))
            );

          if (insertError) throw insertError;
        }
      }

      setEditingTeam(null);
      setEditData(null);
      refetch();
      toast({
        title: "Success",
        description: "Client team updated successfully",
      });
    } catch (error) {
      console.error('Error updating team:', error);
      toast({
        title: "Error",
        description: "Failed to update client team",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!confirm(`Are you sure you want to delete ${teamName}? This will also delete all related meetings and assignments. This action cannot be undone.`)) return;

    try {
      // First, check if there are any meetings associated with this team
      const { data: meetings, error: meetingsError } = await supabase
        .from('meetings')
        .select('id')
        .eq('client_team_id', teamId);

      if (meetingsError) throw meetingsError;

      // Delete all meetings associated with this team first
      if (meetings && meetings.length > 0) {
        const { error: deleteMeetingsError } = await supabase
          .from('meetings')
          .delete()
          .eq('client_team_id', teamId);

        if (deleteMeetingsError) throw deleteMeetingsError;
      }

      // Delete team member assignments
      const { error: deleteAssignmentsError } = await supabase
        .from('team_member_client_teams')
        .delete()
        .eq('client_team_id', teamId);

      if (deleteAssignmentsError) throw deleteAssignmentsError;

      // Finally, delete the client team
      const { error: deleteTeamError } = await supabase
        .from('client_teams')
        .delete()
        .eq('id', teamId);

      if (deleteTeamError) throw deleteTeamError;

      refetch();
      toast({
        title: "Success",
        description: "Client team and all related data deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting team:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete client team",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-e3-space-blue p-6 flex items-center justify-center">
        <div className="flex items-center gap-3 text-e3-white">
          <Loader className="w-6 h-6 animate-spin" />
          <span>Loading team data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-e3-space-blue p-6 flex items-center justify-center">
        <div className="text-center">
          <p className="text-e3-flame mb-4">{error}</p>
          <button
            onClick={refetch}
            className="cta focusable"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-e3-space-blue p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <div>
            <h1 className="heading text-e3-emerald mb-2">Team Configuration</h1>
            <p className="text-e3-white/80">Manage team members with Google Workspace domain-wide calendar access</p>
          </div>
        </header>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-8 bg-e3-space-blue/50 p-1 rounded-lg border border-e3-white/10">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex items-center px-4 py-2 rounded-md transition ${
              activeTab === 'members' 
                ? 'bg-e3-azure text-e3-white' 
                : 'text-e3-white/70 hover:text-e3-white hover:bg-e3-white/5'
            }`}
          >
            <Users className="w-4 h-4 mr-2" />
            Team Members ({teamMembers.length})
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`flex items-center px-4 py-2 rounded-md transition ${
              activeTab === 'teams' 
                ? 'bg-e3-azure text-e3-white' 
                : 'text-e3-white/70 hover:text-e3-white hover:bg-e3-white/5'
            }`}
          >
            <Building className="w-4 h-4 mr-2" />
            Client Teams ({clientTeams.length})
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`flex items-center px-4 py-2 rounded-md transition ${
              activeTab === 'roles' 
                ? 'bg-e3-azure text-e3-white' 
                : 'text-e3-white/70 hover:text-e3-white hover:bg-e3-white/5'
            }`}
          >
            <UserCog className="w-4 h-4 mr-2" />
            Team Roles
          </button>
        </div>

        {/* Team Members Tab */}
        {activeTab === 'members' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="sub-heading">Team Members</h2>
              <button
                onClick={() => setShowAddMember(true)}
                className="cta focusable flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Member
              </button>
            </div>

            {teamMembers.length === 0 ? (
              <div className="text-center py-12 text-e3-white/60">
                <Users className="w-12 h-12 mx-auto mb-4" />
                <p>No team members found. Add your first team member to get started.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {teamMembers.map(member => (
                  <div key={member.id} className="bg-e3-space-blue/70 p-6 rounded-lg border border-e3-white/10">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {/* Profile Photo - handle Google photos properly */}
                          {member.google_photo_url ? (
                            <img 
                              src={member.google_photo_url} 
                              alt={member.name}
                              className="w-10 h-10 rounded-full border-2 border-e3-azure/30 object-cover"
                              onError={(e) => {
                                console.error('Google photo failed to load for', member.name, ':', member.google_photo_url);
                                // Hide image and show initials fallback
                                e.currentTarget.style.display = 'none';
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallback) fallback.classList.remove('hidden');
                              }}
                              referrerPolicy="no-referrer"
                              crossOrigin="anonymous"
                            />
                          ) : null}
                          <div className={`w-10 h-10 rounded-full bg-e3-azure/20 flex items-center justify-center text-e3-azure font-bold border-2 border-e3-azure/30 ${member.google_photo_url ? 'hidden' : ''}`}>
                            {member.name.split(' ').map(n => n.charAt(0)).join('')}
                          </div>
                          
                          {editingMember === member.id ? (
                            <input
                              type="text"
                              value={editData?.name || ''}
                              onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                              className="flex-1 bg-e3-space-blue/50 border border-e3-white/20 rounded px-3 py-1 text-e3-white"
                            />
                          ) : (
                            <h3 className="font-bold text-lg">{member.name}</h3>
                          )}
                          
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            member.isActive ? 'bg-e3-emerald/20 text-e3-emerald' : 'bg-e3-white/20 text-e3-white/60'
                          }`}>
                            {member.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        
                        <p className="text-e3-white/80 mb-1">{member.email}</p>
                        
                        {editingMember === member.id ? (
                          <select
                            value={editData?.role || ''}
                            onChange={(e) => setEditData(prev => ({ ...prev, role: e.target.value }))}
                            className="bg-e3-space-blue/50 border border-e3-white/20 rounded px-3 py-1 text-e3-white mb-2"
                          >
                            {availableRoles.map(role => (
                              <option key={role.id} value={role.name}>{role.name}</option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-e3-white/60 mb-2">Role: {member.role}</p>
                        )}
                        
                        {/* Client Teams */}
                        <div className="mb-4">
                          <p className="text-e3-white/60 text-sm mb-2">Client Teams:</p>
                          {editingMember === member.id ? (
                            <div className="space-y-2">
                              {clientTeams.map(team => (
                                <label key={team.id} className="flex items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={editData?.clientTeams?.includes(team.id) || false}
                                    onChange={(e) => {
                                      const teamId = team.id;
                                      const isChecked = e.target.checked;
                                      setEditData(prev => ({
                                        ...prev,
                                        clientTeams: isChecked
                                          ? [...(prev?.clientTeams || []), teamId]
                                          : (prev?.clientTeams || []).filter(id => id !== teamId)
                                      }));
                                    }}
                                    className="rounded border-e3-white/20"
                                  />
                                  <span className="text-e3-white/80">{team.name}</span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <>
                              {member.clientTeams.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                  {member.clientTeams.map(team => (
                                    <span
                                      key={team.id}
                                      className="px-2 py-1 bg-e3-azure/20 text-e3-azure text-xs rounded-full"
                                    >
                                      {team.name}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-e3-white/40 text-sm">Not assigned to any client teams</span>
                              )}
                            </>
                          )}
                        </div>
                        
                        {/* Calendar Status */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-e3-emerald/20 text-e3-emerald">
                            <Calendar className="w-3 h-3" />
                            Calendar Access via Domain Delegation
                          </div>
                          
                          <button
                            onClick={() => handleConnectGoogleCalendar(member.id)}
                            className="text-e3-azure hover:text-e3-white text-sm underline"
                          >
                            Test Calendar Access
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        {editingMember === member.id ? (
                          <>
                            <button 
                              onClick={() => handleSaveMember(member.id)}
                              className="p-2 text-e3-emerald hover:text-e3-white transition"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => {
                                setEditingMember(null);
                                setEditData(null);
                              }}
                              className="p-2 text-e3-white/60 hover:text-e3-white transition"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={() => handleEditMember(member)}
                              className="p-2 text-e3-azure hover:text-e3-white transition"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteMember(member.id, member.name)}
                              className="p-2 text-e3-flame hover:text-e3-white transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Client Teams Tab */}
        {activeTab === 'teams' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="sub-heading">Client Teams</h2>
              <button
                onClick={() => setShowAddTeam(true)}
                className="cta focusable flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Team
              </button>
            </div>

            {clientTeams.length === 0 ? (
              <div className="text-center py-12 text-e3-white/60">
                <Settings className="w-12 h-12 mx-auto mb-4" />
                <p>No client teams found. Add your first client team to get started.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {clientTeams.map(team => {
                  const teamMemberCount = teamMembers.filter(member => 
                    member.clientTeams.some(ct => ct.id === team.id)
                  ).length;

                  return (
                    <div key={team.id} className="bg-e3-space-blue/70 p-6 rounded-lg border border-e3-white/10">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {editingTeam === team.id ? (
                              <input
                                type="text"
                                value={editData?.name || ''}
                                onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                                className="flex-1 bg-e3-space-blue/50 border border-e3-white/20 rounded px-3 py-1 text-e3-white"
                              />
                            ) : (
                              <h3 className="font-bold text-lg">{team.name}</h3>
                            )}
                            
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              team.isActive ? 'bg-e3-emerald/20 text-e3-emerald' : 'bg-e3-white/20 text-e3-white/60'
                            }`}>
                              {team.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          
                          {editingTeam === team.id ? (
                            <textarea
                              value={editData?.description || ''}
                              onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                              placeholder="Team description"
                              className="w-full bg-e3-space-blue/50 border border-e3-white/20 rounded px-3 py-2 text-e3-white mb-2"
                              rows={2}
                            />
                          ) : (
                            <p className="text-e3-white/80 mb-2">{team.description}</p>
                          )}
                          
                          {/* Team Members Section */}
                          <div className="mb-4">
                            <p className="text-e3-white/60 text-sm mb-2">
                              Team Members: {teamMemberCount}
                            </p>
                            {editingTeam === team.id ? (
                              <div className="space-y-2 max-h-32 overflow-y-auto">
                                {teamMembers.map(member => (
                                  <label key={member.id} className="flex items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={editData?.teamMembers?.includes(member.id) || false}
                                      onChange={(e) => {
                                        const memberId = member.id;
                                        const isChecked = e.target.checked;
                                        setEditData(prev => ({
                                          ...prev,
                                          teamMembers: isChecked
                                            ? [...(prev?.teamMembers || []), memberId]
                                            : (prev?.teamMembers || []).filter(id => id !== memberId)
                                        }));
                                      }}
                                      className="rounded border-e3-white/20"
                                    />
                                    <span className="text-e3-white/80">{member.name}</span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              teamMemberCount > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {teamMembers
                                    .filter(member => member.clientTeams.some((ct: any) => ct.id === team.id))
                                    .map(member => (
                                      <span
                                        key={member.id}
                                        className="px-2 py-1 bg-e3-emerald/20 text-e3-emerald text-xs rounded-full"
                                      >
                                        {member.name}
                                      </span>
                                    ))}
                                </div>
                              )
                            )}
                          </div>
                          
                          {/* Booking Link Section */}
                          <div className="mt-4 p-3 bg-e3-space-blue/50 rounded-md border border-e3-azure/20">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-e3-azure text-sm font-medium">Booking Link</p>
                              {editingTeam !== team.id && (
                                 <button
                                   onClick={() => {
                                     const bookingUrl = `${window.location.origin}/book/${team.booking_slug || team.name.toLowerCase().replace(/\s+/g, '-')}`;
                                     navigator.clipboard.writeText(bookingUrl);
                                     toast({
                                       title: "Link Copied!",
                                       description: "Booking link copied to clipboard",
                                     });
                                   }}
                                   className="text-xs text-e3-azure hover:text-e3-white px-2 py-1 bg-e3-azure/10 hover:bg-e3-azure/20 rounded transition"
                                 >
                                   Copy Link
                                 </button>
                              )}
                            </div>
                            {editingTeam === team.id ? (
                              <div className="space-y-2">
                                <div>
                                  <label className="block text-xs text-e3-white/60 mb-1">Booking Slug</label>
                                  <input
                                    type="text"
                                    value={editData?.booking_slug || ''}
                                    onChange={(e) => setEditData(prev => ({ ...prev, booking_slug: e.target.value }))}
                                    placeholder={team.name.toLowerCase().replace(/\s+/g, '-')}
                                    className="w-full text-xs text-e3-white/80 bg-e3-space-blue/70 px-2 py-1 rounded border border-e3-white/20"
                                  />
                                </div>
                                <code className="block text-xs text-e3-white/80 bg-e3-space-blue/70 px-2 py-1 rounded border">
                                  {window.location.origin}/book/{editData?.booking_slug || team.name.toLowerCase().replace(/\s+/g, '-')}
                                </code>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <code className="flex-1 text-xs text-e3-white/80 bg-e3-space-blue/70 px-2 py-1 rounded border">
                                  {window.location.origin}/book/{team.booking_slug || team.name.toLowerCase().replace(/\s+/g, '-')}
                                </code>
                                 <button
                                   onClick={() => {
                                     const bookingUrl = `${window.location.origin}/book/${team.booking_slug || team.name.toLowerCase().replace(/\s+/g, '-')}`;
                                     window.open(bookingUrl, '_blank');
                                   }}
                                   className="text-xs text-e3-emerald hover:text-e3-white px-2 py-1 bg-e3-emerald/10 hover:bg-e3-emerald/20 rounded transition"
                                 >
                                   View
                                 </button>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          {editingTeam === team.id ? (
                            <>
                              <button 
                                onClick={() => handleSaveTeam(team.id)}
                                className="p-2 text-e3-emerald hover:text-e3-white transition"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => {
                                  setEditingTeam(null);
                                  setEditData(null);
                                }}
                                className="p-2 text-e3-white/60 hover:text-e3-white transition"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button 
                                onClick={() => handleEditTeam(team)}
                                className="p-2 text-e3-azure hover:text-e3-white transition"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDeleteTeam(team.id, team.name)}
                                className="p-2 text-e3-flame hover:text-e3-white transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
         )}

         {/* Team Roles Tab */}
         {activeTab === 'roles' && (
           <TeamRolesManager />
         )}

        {/* Add Member Form Modal */}
        {showAddMember && (
          <AddMemberForm
            onClose={() => setShowAddMember(false)}
            onSuccess={handleAddMemberSuccess}
            clientTeams={clientTeams}
          />
        )}

        {/* Add Team Form Modal */}
        {showAddTeam && (
          <AddTeamForm
            onClose={() => setShowAddTeam(false)}
            onSuccess={handleAddTeamSuccess}
          />
        )}
      </div>
    </div>
  );
};

export default TeamConfig;
