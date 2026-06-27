import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  CalendarDays, AlertTriangle, ShieldCheck, FileText, Wrench, Shield, CheckCircle, 
  Plus, Bike, User, Ticket, Eye, Camera, MoreVertical, Edit, Search, Activity, Trash2, MapPin, SearchX, Download, ExternalLink, Key, Zap, Info, Clock, DollarSign, Wallet
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export function AddRiderModal({
  showAddDialog, setShowAddDialog, newRider, setNewRider, addingRider, handleAddRider
}: any) {
  return (
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>Add New Rider</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  placeholder="Rider name"
                  value={newRider.fullName}
                  onChange={(e: any) => setNewRider((p: any) => ({ ...p, fullName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone Number (10 digits)</Label>
                <Input
                  placeholder="9876543210"
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={newRider.phone}
                  onChange={(e: any) =>
                    setNewRider((p: any) => ({
                      ...p,
                      phone: e.target.value.replace(/\D/g, '').slice(0, 10),
                    }))
                  }
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddRider} disabled={addingRider || newRider.phone.length < 10}>
                {addingRider ? 'Creating...' : 'Add Rider'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

  );
}
