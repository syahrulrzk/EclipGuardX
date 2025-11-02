import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Switch } from './switch';
import { Label } from './label';
import { Button } from './button';
import { Input } from './input';
import { toast } from 'sonner';

interface EmailSettings {
  enabled: boolean;
  email: string;
  alertTypes: {
    security: boolean;
    performance: boolean;
    system: boolean;
  };
}

export function EmailNotificationSettings() {
  const [settings, setSettings] = useState<EmailSettings>({
    enabled: false,
    email: '',
    alertTypes: {
      security: true,
      performance: true,
      system: true,
    },
  });

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, email: e.target.value });
  };

  const handleToggleEnabled = (checked: boolean) => {
    setSettings({ ...settings, enabled: checked });
  };

  const handleAlertTypeToggle = (type: keyof typeof settings.alertTypes) => {
    setSettings({
      ...settings,
      alertTypes: {
        ...settings.alertTypes,
        [type]: !settings.alertTypes[type],
      },
    });
  };

  const handleSave = () => {
    // TODO: Implement API call to save settings
    toast.success('Email notification settings saved successfully');
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Email Notifications</CardTitle>
        <CardDescription>
          Configure your email notification preferences for important alerts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <Label htmlFor="notifications-enabled">Enable Email Notifications</Label>
          <Switch
            id="notifications-enabled"
            checked={settings.enabled}
            onCheckedChange={handleToggleEnabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Notification Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="your@email.com"
            value={settings.email}
            onChange={handleEmailChange}
            disabled={!settings.enabled}
          />
        </div>

        <div className="space-y-4">
          <Label>Alert Types</Label>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="security-alerts">Security Alerts</Label>
              <Switch
                id="security-alerts"
                checked={settings.alertTypes.security}
                onCheckedChange={() => handleAlertTypeToggle('security')}
                disabled={!settings.enabled}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="performance-alerts">Performance Alerts</Label>
              <Switch
                id="performance-alerts"
                checked={settings.alertTypes.performance}
                onCheckedChange={() => handleAlertTypeToggle('performance')}
                disabled={!settings.enabled}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="system-alerts">System Alerts</Label>
              <Switch
                id="system-alerts"
                checked={settings.alertTypes.system}
                onCheckedChange={() => handleAlertTypeToggle('system')}
                disabled={!settings.enabled}
              />
            </div>
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={!settings.enabled || !settings.email}
          className="w-full"
        >
          Save Settings
        </Button>
      </CardContent>
    </Card>
  );
}