import React, { useState } from 'react';
import { Settings, Users, Mail, Calendar, Home, Monitor, Globe } from 'lucide-react';
import AdminEmailSetup from '../components/AdminEmailSetup';
import GoogleCalendarSetup from '../components/GoogleCalendarSetup';
import TeamConfig from '../components/TeamConfig';
import ImprovedBusinessHours from '../components/ImprovedBusinessHours';
import SchedulingWindowSettings from '../components/SchedulingWindowSettings';
import BookedAppointmentSettings from '../components/BookedAppointmentSettings';
import LandingPageSettings from '../components/LandingPageSettings';
import BookingPageSettings from '../components/BookingPageSettings';

const AdminSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('team');

  // We reduced the tabs to make the UI much more intuitive
  const tabs = [
    { id: 'team', label: 'Team Management', icon: Users },
    { id: 'global-rules', label: 'Global Booking Rules', icon: Globe },
    { id: 'landing', label: 'Landing Page', icon: Home },
    { id: 'booking', label: 'Booking Pages', icon: Monitor },
    { id: 'calendar', label: 'Google Calendar', icon: Calendar },
    { id: 'email', label: 'Admin Email', icon: Mail }
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'team':
        return <TeamConfig />;
      case 'global-rules':
        return (
          <div className="space-y-8 animate-fade-in">
            <div className="border-b border-e3-white/10 pb-6 mb-6">
              <h2 className="text-2xl font-bold text-e3-emerald mb-2">Global Booking Rules</h2>
              <p className="text-e3-white/70">
                These are the default settings applied to all client teams and team members. 
                You can override these for specific individuals using the ⚙️ icon in Team Management.
              </p>
            </div>
            {/* Stacked Global Settings */}
            <ImprovedBusinessHours />
            <div className="h-px w-full bg-e3-white/10 my-8" />
            <SchedulingWindowSettings />
            <div className="h-px w-full bg-e3-white/10 my-8" />
            <BookedAppointmentSettings />
          </div>
        );
      case 'landing':
        return <LandingPageSettings />;
      case 'booking':
        return <BookingPageSettings />;
      case 'calendar':
        return <GoogleCalendarSetup />;
      case 'email':
        return <AdminEmailSetup />;
      default:
        return <TeamConfig />;
    }
  };

  return (
    <div className="min-h-screen bg-e3-space-blue p-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Settings className="w-8 h-8 text-e3-emerald" />
            <h1 className="text-3xl font-bold text-e3-white">Admin Settings</h1>
          </div>
          <p className="text-e3-white/60">Configure your team and system settings</p>
        </header>

        {/* Tab Navigation */}
        <div className="bg-e3-space-blue/50 rounded-lg p-1 mb-8 border border-e3-white/10">
          <div className="flex flex-wrap gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg transition text-sm font-medium flex-1 justify-center ${
                    activeTab === tab.id
                      ? 'bg-e3-emerald text-e3-space-blue'
                      : 'text-e3-white/70 hover:text-e3-white hover:bg-e3-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-e3-space-blue/30 rounded-lg border border-e3-white/10 p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;