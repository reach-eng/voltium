'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Bell,
  Moon,
  Sun,
  Languages,
  Smartphone,
  Lock,
  ShieldCheck,
  Info,
  FileText,
  ShieldAlert,
  Star,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import { useAppStore } from '@/store/app';
import { useTheme } from 'next-themes';
import { useRiderProfile } from '@/hooks/useRiderData';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';

const fadeUp: any = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: 'easeOut' },
  }),
};

export default function SettingsScreen() {
  const setScreen = useAppStore((s) => s.setScreen);
  const goBack = useAppStore((s) => s.goBack);
  const { theme, setTheme } = useTheme();

  // Local settings states matching Flutter
  const [notifications, setNotifications] = useState(true);
  const [twoFactor, setTwoFactor] = useState(true);
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [showLangDialog, setShowLangDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const isDark = theme === 'dark';

  const handleLaunchUrl = (url: string) => {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleRateApp = () => {
    handleLaunchUrl('https://play.google.com/store/apps/details?id=com.voltium.rider');
  };

  const handleDeleteAccount = () => {
    setShowDeleteDialog(false);
    toast({
      title: 'Account Deletion',
      description: 'Account deletion is not yet available. Please contact support.',
      variant: 'default',
    });
  };

  return (
    <div className="min-h-screen bg-background pb-12 transition-colors duration-200">
      {/* AppBar / Header */}
      <div className="flex items-center gap-4 px-5 pt-12 pb-4 border-b border-border/10 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <button
          onClick={goBack}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-[0px_4px_10px_rgba(0,0,0,0.05)] border border-border/50 hover:bg-muted transition-colors"
          aria-label="Go Back"
        >
          <ArrowLeft size={20} className="text-foreground" />
        </button>
        <h1 className="text-[1.375rem] font-bold text-foreground">Settings</h1>
      </div>

      <div className="px-5 mt-6 space-y-6 max-w-md mx-auto">
        {/* APP SETTINGS Section */}
        <div className="space-y-2">
          <h2 className="text-[0.75rem] font-black text-muted-foreground uppercase tracking-wider px-1">
            App Settings
          </h2>
          <motion.div
            custom={0}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="rounded-2xl bg-card border border-border/50 shadow-[0px_4px_10px_rgba(0,0,0,0.02)] overflow-hidden divide-y divide-border/40"
          >
            {/* Notifications */}
            <div className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                  <Bell size={18} />
                </div>
                <div>
                  <p className="text-[0.9375rem] font-semibold text-foreground">Notifications</p>
                </div>
              </div>
              <Switch
                id="notificationsSwitch"
                checked={notifications}
                onCheckedChange={setNotifications}
              />
            </div>

            {/* Dark Mode */}
            <div className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-500/10 text-slate-500">
                  {isDark ? <Moon size={18} /> : <Sun size={18} />}
                </div>
                <div>
                  <p className="text-[0.9375rem] font-semibold text-foreground">Dark Mode</p>
                </div>
              </div>
              <Switch
                id="darkModeSwitch"
                checked={isDark}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              />
            </div>

            {/* Language */}
            <button
              id="languageOption"
              onClick={() => setShowLangDialog(true)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                  <Languages size={18} />
                </div>
                <div>
                  <p className="text-[0.9375rem] font-semibold text-foreground">Language</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium">
                <span>{language === 'hi' ? 'Hindi' : 'English'}</span>
                <ChevronRight size={16} />
              </div>
            </button>
          </motion.div>
        </div>

        {/* SECURITY Section */}
        <div className="space-y-2">
          <h2 className="text-[0.75rem] font-black text-muted-foreground uppercase tracking-wider px-1">
            Security
          </h2>
          <motion.div
            custom={1}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="rounded-2xl bg-card border border-border/50 shadow-[0px_4px_10px_rgba(0,0,0,0.02)] overflow-hidden divide-y divide-border/40"
          >
            {/* Change Phone Number */}
            <button
              id="changePhoneTile"
              onClick={() => toast({ description: 'Phone number change coming soon' })}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
                  <Smartphone size={18} />
                </div>
                <div>
                  <p className="text-[0.9375rem] font-semibold text-foreground">
                    Change Phone Number
                  </p>
                </div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>

            {/* Change Password */}
            <button
              id="changePasswordTile"
              onClick={() => toast({ description: 'Password change coming soon' })}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                  <Lock size={18} />
                </div>
                <div>
                  <p className="text-[0.9375rem] font-semibold text-foreground">Change Password</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>

            {/* Two-Factor Auth */}
            <div className="flex items-center justify-between p-4 hover:bg-muted/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-500">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <p className="text-[0.9375rem] font-semibold text-foreground">Two-Factor Auth</p>
                </div>
              </div>
              <Switch id="twoFactorSwitch" checked={twoFactor} onCheckedChange={setTwoFactor} />
            </div>
          </motion.div>
        </div>

        {/* ABOUT Section */}
        <div className="space-y-2">
          <h2 className="text-[0.75rem] font-black text-muted-foreground uppercase tracking-wider px-1">
            About
          </h2>
          <motion.div
            custom={2}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="rounded-2xl bg-card border border-border/50 shadow-[0px_4px_10px_rgba(0,0,0,0.02)] overflow-hidden divide-y divide-border/40"
          >
            {/* App Version */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-500/10 text-slate-500">
                  <Info size={18} />
                </div>
                <div>
                  <p className="text-[0.9375rem] font-semibold text-foreground">App Version</p>
                </div>
              </div>
              <span className="font-mono text-sm text-muted-foreground">v2.1.0</span>
            </div>

            {/* Terms of Service */}
            <button
              id="termsTile"
              onClick={() => handleLaunchUrl('https://voltium.app/terms')}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-500/10 text-slate-500">
                  <FileText size={18} />
                </div>
                <div>
                  <p className="text-[0.9375rem] font-semibold text-foreground">Terms of Service</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>

            {/* Privacy Policy */}
            <button
              id="privacyTile"
              onClick={() => handleLaunchUrl('https://voltium.app/privacy')}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-500/10 text-slate-500">
                  <ShieldAlert size={18} />
                </div>
                <div>
                  <p className="text-[0.9375rem] font-semibold text-foreground">Privacy Policy</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>

            {/* Rate Us */}
            <button
              id="rateUsTile"
              onClick={handleRateApp}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/10 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                  <Star size={18} />
                </div>
                <div>
                  <p className="text-[0.9375rem] font-semibold text-foreground">Rate Us</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          </motion.div>
        </div>

        {/* DANGER ZONE Section */}
        <div className="space-y-2">
          <h2 className="text-[0.75rem] font-black text-red-500 uppercase tracking-wider px-1">
            Danger Zone
          </h2>
          <motion.div
            custom={3}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 shadow-[0px_4px_10px_rgba(0,0,0,0.02)] flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                <Trash2 size={22} />
              </div>
              <div>
                <h3 className="text-[0.9375rem] font-bold text-red-700 dark:text-red-400">
                  Delete Account
                </h3>
                <p className="text-xs text-red-500/80">This action is irreversible</p>
              </div>
            </div>
            <button
              id="deleteAccountButton"
              onClick={() => setShowDeleteDialog(true)}
              className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-900/10 hover:bg-red-700 transition-colors active:scale-95 shrink-0"
            >
              Delete
            </button>
          </motion.div>
        </div>
      </div>

      {/* Language Selection Dialog */}
      <AnimatePresence>
        {showLangDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLangDialog(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm rounded-3xl bg-card border border-border p-6 shadow-2xl z-10 space-y-4"
            >
              <h3 className="text-lg font-bold text-foreground">Select Language</h3>
              <div className="space-y-1">
                <button
                  id="englishRadio"
                  onClick={() => {
                    setLanguage('en');
                    setShowLangDialog(false);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-muted transition-colors text-left"
                >
                  <span className="font-semibold text-foreground">English</span>
                  <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary">
                    {language === 'en' && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
                  </div>
                </button>
                <button
                  id="hindiRadio"
                  onClick={() => {
                    setLanguage('hi');
                    setShowLangDialog(false);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-muted transition-colors text-left"
                >
                  <span className="font-semibold text-foreground">हिंदी (Hindi)</span>
                  <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-primary">
                    {language === 'hi' && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
                  </div>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Account Confirmation Dialog */}
      <AnimatePresence>
        {showDeleteDialog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDeleteDialog(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm rounded-3xl bg-card border border-border p-6 shadow-2xl z-10 space-y-4"
            >
              <h3 className="text-lg font-bold text-foreground">Delete Account</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This action is irreversible. All your data, including KYC documents, wallet balance,
                and rental history will be permanently deleted. Are you sure?
              </p>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  id="cancelDeleteButton"
                  onClick={() => setShowDeleteDialog(false)}
                  className="rounded-full bg-muted px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  id="confirmDeleteButton"
                  onClick={handleDeleteAccount}
                  className="rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
