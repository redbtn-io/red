'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, 
  User, 
  Bell, 
  Palette, 
  Shield, 
  Key,
  Loader2,
  Save,
  ChevronRight,
  Moon,
  Sun,
  Monitor,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { Header } from '@/components/layout/Header';
import { pageVariants, fadeUpVariants } from '@/lib/animations';

type SettingsSection = 'profile' | 'notifications' | 'appearance' | 'security';

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
  const [saving, setSaving] = useState(false);
  
  // Profile state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  
  // Notification state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // TODO: Implement profile update API
      await new Promise(resolve => setTimeout(resolve, 500));
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'appearance' as const, label: 'Appearance', icon: Palette },
    { id: 'notifications' as const, label: 'Notifications', icon: Bell },
    { id: 'security' as const, label: 'Security', icon: Shield },
  ];

  return (
    <div className="flex h-app bg-bg-primary overflow-hidden">
      <AppSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          title="Settings"
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onNewChat={() => {}}
        />

        <motion.main 
          className="flex-1 overflow-y-auto"
          variants={pageVariants}
          initial="initial"
          animate="animate"
        >
          <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
            <motion.div variants={fadeUpVariants}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Settings className="w-5 h-5 text-accent-text" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
                  <p className="text-sm text-text-secondary">Manage your account and preferences</p>
                </div>
              </div>
            </motion.div>

            <div className="flex flex-col lg:flex-row gap-6">
              {/* Sidebar Navigation */}
              <motion.div 
                className="lg:w-48 flex-shrink-0"
                variants={fadeUpVariants}
              >
                <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
                  {sections.map((section) => {
                    const Icon = section.icon;
                    const isActive = activeSection === section.id;
                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                          isActive
                            ? 'bg-accent/10 text-accent-text'
                            : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{section.label}</span>
                        {isActive && <ChevronRight className="w-4 h-4 ml-auto hidden lg:block" />}
                      </button>
                    );
                  })}
                </nav>
              </motion.div>

              {/* Content Area */}
              <motion.div 
                className="flex-1 min-w-0"
                variants={fadeUpVariants}
              >
                <div className="bg-bg-secondary border border-border rounded-xl p-6">
                  {activeSection === 'profile' && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-lg font-semibold text-text-primary mb-1">Profile</h2>
                        <p className="text-sm text-text-secondary">Update your personal information</p>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-text-secondary mb-2">
                            Name
                          </label>
                          <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-4 py-2.5 bg-bg-primary border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-transparent"
                            placeholder="Your name"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-text-secondary mb-2">
                            Email
                          </label>
                          <input
                            type="email"
                            value={email}
                            disabled
                            className="w-full px-4 py-2.5 bg-bg-primary border border-border rounded-lg text-text-muted cursor-not-allowed"
                          />
                          <p className="text-xs text-text-muted mt-1">Email cannot be changed</p>
                        </div>

                        <button
                          onClick={handleSaveProfile}
                          disabled={saving}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                          {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          Save Changes
                        </button>
                      </div>
                    </div>
                  )}

                  {activeSection === 'appearance' && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-lg font-semibold text-text-primary mb-1">Appearance</h2>
                        <p className="text-sm text-text-secondary">Customize how the app looks</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-text-secondary mb-3">
                          Theme
                        </label>
                        <div className="flex gap-2">
                          {[
                            { id: 'dark' as const, label: 'Dark', icon: Moon },
                            { id: 'light' as const, label: 'Light', icon: Sun },
                            { id: 'system' as const, label: 'System', icon: Monitor },
                          ].map((option) => {
                            const Icon = option.icon;
                            return (
                              <button
                                key={option.id}
                                onClick={() => setTheme(option.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                                  theme === option.id
                                    ? 'border-accent bg-accent/10 text-accent-text'
                                    : 'border-border text-text-secondary hover:border-border-hover hover:text-text-primary'
                                }`}
                              >
                                <Icon className="w-4 h-4" />
                                <span className="text-sm font-medium">{option.label}</span>
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-xs text-text-muted mt-2">
                          Choose your preferred color scheme. System will match your device settings.
                        </p>
                      </div>
                    </div>
                  )}

                  {activeSection === 'notifications' && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-lg font-semibold text-text-primary mb-1">Notifications</h2>
                        <p className="text-sm text-text-secondary">Manage how you receive updates</p>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-bg-primary border border-border rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-text-primary">Email Notifications</p>
                            <p className="text-xs text-text-secondary">Receive updates via email</p>
                          </div>
                          <button
                            onClick={() => setEmailNotifications(!emailNotifications)}
                            className={`w-11 h-6 rounded-full transition-colors ${
                              emailNotifications ? 'bg-accent' : 'bg-bg-tertiary'
                            }`}
                          >
                            <div
                              className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                                emailNotifications ? 'translate-x-5' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-bg-primary border border-border rounded-lg">
                          <div>
                            <p className="text-sm font-medium text-text-primary">Push Notifications</p>
                            <p className="text-xs text-text-secondary">Browser push notifications</p>
                          </div>
                          <button
                            onClick={() => setPushNotifications(!pushNotifications)}
                            className={`w-11 h-6 rounded-full transition-colors ${
                              pushNotifications ? 'bg-accent' : 'bg-bg-tertiary'
                            }`}
                          >
                            <div
                              className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                                pushNotifications ? 'translate-x-5' : 'translate-x-0.5'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeSection === 'security' && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-lg font-semibold text-text-primary mb-1">Security</h2>
                        <p className="text-sm text-text-secondary">Manage your account security</p>
                      </div>

                      <div className="space-y-4">
                        <div className="p-4 bg-bg-primary border border-border rounded-lg">
                          <div className="flex items-center gap-3 mb-2">
                            <Key className="w-5 h-5 text-text-secondary" />
                            <p className="text-sm font-medium text-text-primary">API Keys</p>
                          </div>
                          <p className="text-xs text-text-secondary mb-3">
                            Generate API keys to access Red programmatically
                          </p>
                          <button className="text-sm text-accent-text hover:text-accent-hover font-medium">
                            Manage API Keys →
                          </button>
                        </div>

                        <div className="p-4 bg-bg-primary border border-border rounded-lg">
                          <div className="flex items-center gap-3 mb-2">
                            <Shield className="w-5 h-5 text-text-secondary" />
                            <p className="text-sm font-medium text-text-primary">Sessions</p>
                          </div>
                          <p className="text-xs text-text-secondary mb-3">
                            View and manage your active sessions
                          </p>
                          <button className="text-sm text-accent-text hover:text-accent-hover font-medium">
                            View Sessions →
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </motion.main>
      </div>
    </div>
  );
}
