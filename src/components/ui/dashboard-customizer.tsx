import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Switch } from './switch';
import { Label } from './label';
import { Button } from './button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { toast } from 'sonner';

interface WidgetSettings {
  id: string;
  name: string;
  enabled: boolean;
  position: number;
}

interface DashboardSettings {
  layout: 'grid' | 'list';
  refreshInterval: number;
  widgets: WidgetSettings[];
}

export function DashboardCustomizer() {
  const [settings, setSettings] = useState<DashboardSettings>({
    layout: 'grid',
    refreshInterval: 30,
    widgets: [
      { id: 'security-overview', name: 'Security Overview', enabled: true, position: 0 },
      { id: 'container-stats', name: 'Container Statistics', enabled: true, position: 1 },
      { id: 'recent-alerts', name: 'Recent Alerts', enabled: true, position: 2 },
      { id: 'resource-usage', name: 'Resource Usage', enabled: true, position: 3 },
      { id: 'vulnerability-scan', name: 'Vulnerability Scan', enabled: true, position: 4 },
    ],
  });

  const handleLayoutChange = (value: 'grid' | 'list') => {
    setSettings({ ...settings, layout: value });
  };

  const handleRefreshIntervalChange = (value: string) => {
    setSettings({ ...settings, refreshInterval: parseInt(value) });
  };

  const handleWidgetToggle = (widgetId: string) => {
    setSettings({
      ...settings,
      widgets: settings.widgets.map(widget =>
        widget.id === widgetId ? { ...widget, enabled: !widget.enabled } : widget
      ),
    });
  };

  const handleSave = () => {
    // TODO: Implement API call to save settings
    toast.success('Dashboard settings saved successfully');
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Dashboard Customization</CardTitle>
        <CardDescription>
          Customize your dashboard layout and widget preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Layout Style</Label>
          <Select value={settings.layout} onValueChange={handleLayoutChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select layout style" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="grid">Grid Layout</SelectItem>
              <SelectItem value="list">List Layout</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Auto-refresh Interval</Label>
          <Select
            value={settings.refreshInterval.toString()}
            onValueChange={handleRefreshIntervalChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select refresh interval" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 seconds</SelectItem>
              <SelectItem value="30">30 seconds</SelectItem>
              <SelectItem value="60">1 minute</SelectItem>
              <SelectItem value="300">5 minutes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-4">
          <Label>Visible Widgets</Label>
          <div className="space-y-2">
            {settings.widgets.map(widget => (
              <div key={widget.id} className="flex items-center justify-between">
                <Label htmlFor={widget.id}>{widget.name}</Label>
                <Switch
                  id={widget.id}
                  checked={widget.enabled}
                  onCheckedChange={() => handleWidgetToggle(widget.id)}
                />
              </div>
            ))}
          </div>
        </div>

        <Button onClick={handleSave} className="w-full">
          Save Dashboard Settings
        </Button>
      </CardContent>
    </Card>
  );
}