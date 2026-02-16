import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTeamData } from '@/hooks/useTeamData';

interface LandingPageSettings {
  id: string;
  default_client_team_slug: string | null;
  cta_text: string;
  hero_title: string;
  hero_description: string;
  show_how_it_works: boolean;
  show_features: boolean;
  logo_link: string;
  footer_copyright_text: string;
}

const LandingPageSettings = () => {
  const [settings, setSettings] = useState<LandingPageSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { clientTeams } = useTeamData();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('landing_page_settings')
        .select('*')
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setSettings(data);
    } catch (error) {
      console.error('Error fetching landing page settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('landing_page_settings')
        .upsert({
          ...settings,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast.success('Landing page settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!settings) {
    return <div className="p-6">No settings found</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="bg-e3-space-blue/30 border-e3-white/10">
        <CardHeader>
          <CardTitle className="text-e3-white">Landing Page Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="hero-title" className="text-e3-white">Hero Title</Label>
            <Input
              id="hero-title"
              value={settings.hero_title}
              onChange={(e) => setSettings({ ...settings, hero_title: e.target.value })}
              placeholder="Enter hero title"
              className="bg-e3-space-blue/50 border-e3-white/20 text-e3-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hero-description" className="text-e3-white">Hero Description</Label>
            <Textarea
              id="hero-description"
              value={settings.hero_description}
              onChange={(e) => setSettings({ ...settings, hero_description: e.target.value })}
              placeholder="Enter hero description"
              rows={3}
              className="bg-e3-space-blue/50 border-e3-white/20 text-e3-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cta-text" className="text-e3-white">Call-to-Action Button Text</Label>
            <Input
              id="cta-text"
              value={settings.cta_text}
              onChange={(e) => setSettings({ ...settings, cta_text: e.target.value })}
              placeholder="e.g., Start Booking"
              className="bg-e3-space-blue/50 border-e3-white/20 text-e3-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="logo-link" className="text-e3-white">Logo Link URL</Label>
            <Input
              id="logo-link"
              value={settings.logo_link}
              onChange={(e) => setSettings({ ...settings, logo_link: e.target.value })}
              placeholder="https://e3-services.com?utnm_source=booking_page&utm_medium=logo&utm_campaign=landing_page"
              className="bg-e3-space-blue/50 border-e3-white/20 text-e3-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="footer-copyright" className="text-e3-white">Footer Copyright Text</Label>
            <Input
              id="footer-copyright"
              value={settings.footer_copyright_text}
              onChange={(e) => setSettings({ ...settings, footer_copyright_text: e.target.value })}
              placeholder="© 2026 E3 Services. All rights reserved."
              className="bg-e3-space-blue/50 border-e3-white/20 text-e3-white"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="default-team" className="text-e3-white">Default Team for Booking</Label>
            <Select
              value={settings.default_client_team_slug || ''}
              onValueChange={(value) => setSettings({ ...settings, default_client_team_slug: value })}
            >
              <SelectTrigger className="bg-e3-space-blue/50 border-e3-white/20 text-e3-white">
                <SelectValue placeholder="Select default team" />
              </SelectTrigger>
              <SelectContent className="bg-e3-space-blue border-e3-white/20">
                {clientTeams?.map((team) => (
                  <SelectItem key={team.id} value={team.name.toLowerCase().replace(/\s+/g, '-')} className="text-e3-white hover:bg-e3-white/10">
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            <Label className="text-e3-white">Page Sections</Label>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="show-how-it-works"
                checked={settings.show_how_it_works}
                onCheckedChange={(checked) => setSettings({ ...settings, show_how_it_works: checked })}
              />
              <Label htmlFor="show-how-it-works" className="text-e3-white">Show "How it works" section</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="show-features"
                checked={settings.show_features}
                onCheckedChange={(checked) => setSettings({ ...settings, show_features: checked })}
              />
              <Label htmlFor="show-features" className="text-e3-white">Show features section</Label>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full bg-e3-emerald text-e3-space-blue hover:bg-e3-emerald/90">
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default LandingPageSettings;