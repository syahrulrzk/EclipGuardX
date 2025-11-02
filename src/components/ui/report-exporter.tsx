import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Button } from './button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Label } from './label';
import { Calendar } from './calendar';
import { Checkbox } from './checkbox';
import { toast } from 'sonner';

interface ExportSettings {
  format: 'pdf' | 'excel';
  dateRange: {
    start: Date;
    end: Date;
  };
  sections: {
    securityAlerts: boolean;
    vulnerabilities: boolean;
    performance: boolean;
    systemLogs: boolean;
  };
}

export function ReportExporter() {
  const [settings, setSettings] = useState<ExportSettings>({
    format: 'pdf',
    dateRange: {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      end: new Date(),
    },
    sections: {
      securityAlerts: true,
      vulnerabilities: true,
      performance: true,
      systemLogs: true,
    },
  });

  const handleFormatChange = (value: 'pdf' | 'excel') => {
    setSettings({ ...settings, format: value });
  };

  const handleDateChange = (type: 'start' | 'end', date: Date) => {
    setSettings({
      ...settings,
      dateRange: {
        ...settings.dateRange,
        [type]: date,
      },
    });
  };

  const handleSectionToggle = (section: keyof typeof settings.sections) => {
    setSettings({
      ...settings,
      sections: {
        ...settings.sections,
        [section]: !settings.sections[section],
      },
    });
  };

  const handleExport = async () => {
    try {
      // TODO: Implement actual export functionality
      toast.success(`Report exported successfully as ${settings.format.toUpperCase()}`);
    } catch (error) {
      toast.error('Failed to export report');
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Export Report</CardTitle>
        <CardDescription>
          Export your security and monitoring data to PDF or Excel format
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Export Format</Label>
          <Select value={settings.format} onValueChange={handleFormatChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select export format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pdf">PDF Document</SelectItem>
              <SelectItem value="excel">Excel Spreadsheet</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Date Range</Label>
          <div className="flex space-x-4">
            <div>
              <Label>Start Date</Label>
              <Calendar
                mode="single"
                selected={settings.dateRange.start}
                onSelect={(date) => date && handleDateChange('start', date)}
                className="rounded-md border"
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Calendar
                mode="single"
                selected={settings.dateRange.end}
                onSelect={(date) => date && handleDateChange('end', date)}
                className="rounded-md border"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Label>Report Sections</Label>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="security-alerts"
                checked={settings.sections.securityAlerts}
                onCheckedChange={() => handleSectionToggle('securityAlerts')}
              />
              <Label htmlFor="security-alerts">Security Alerts</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="vulnerabilities"
                checked={settings.sections.vulnerabilities}
                onCheckedChange={() => handleSectionToggle('vulnerabilities')}
              />
              <Label htmlFor="vulnerabilities">Vulnerability Reports</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="performance"
                checked={settings.sections.performance}
                onCheckedChange={() => handleSectionToggle('performance')}
              />
              <Label htmlFor="performance">Performance Metrics</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="system-logs"
                checked={settings.sections.systemLogs}
                onCheckedChange={() => handleSectionToggle('systemLogs')}
              />
              <Label htmlFor="system-logs">System Logs</Label>
            </div>
          </div>
        </div>

        <Button
          onClick={handleExport}
          disabled={!Object.values(settings.sections).some(Boolean)}
          className="w-full"
        >
          Export Report
        </Button>
      </CardContent>
    </Card>
  );
}