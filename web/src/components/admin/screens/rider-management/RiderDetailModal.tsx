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
 , History, UserPlus, X, ShieldX, Building } from 'lucide-react';
import { Calendar, CheckCircle2, Smartphone, ShieldAlert, Users, Lock  } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { STATE_FILTERS, DetailGroup, getKycBadge } from './index';
import { MediaPreview } from '../../media-preview';
import DeviceTrackingView from '../DeviceTrackingView';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/lib/date-utils';

const permissions = [
  { id: 'location', label: 'Location' },
  { id: 'camera', label: 'Camera' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'contacts', label: 'Contacts' }
];

export function RiderDetailModal({
  selectedRider, setSelectedRider, isEditing, setIsEditing, editForm, setEditForm, saving, selectedKycDocs, setSelectedKycDocs, setConfirmKycAction, kycRejectionReason, handleUpdateRider, handleDeleteKycDoc, handleBulkDeleteKycDocs, toggleKycDoc, handleTlAction, handleClearGuarantor, startEditing
}: any) {
  return (
        <Dialog
          open={!!selectedRider}
          onOpenChange={(o) => {
            if (!o) {
              setSelectedRider(null);
              setIsEditing(false);
            }
          }}
        >
          <DialogContent className="!max-w-[90vw] !w-[90vw] max-h-[95vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl rounded-3xl bg-background/95 backdrop-blur-xl">
            <DialogHeader className="px-8 pt-8 pb-4 bg-muted/20 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                    <User className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-black tracking-tight">
                      {selectedRider?.fullName || 'Rider Profile'}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground font-mono flex items-center gap-2 flex-wrap">
                      {selectedRider?.riderId} · {selectedRider?.phone}
                      {selectedRider?.sharedGuarantorWith &&
                        selectedRider.sharedGuarantorWith.length > 0 && (
                          <Badge
                            variant="destructive"
                            className="h-5 text-[8px] px-2 rounded-full animate-pulse"
                          >
                            Shared Backup Contact Risk
                          </Badge>
                        )}
                    </p>
                    {(selectedRider?.fatherName ||
                      selectedRider?.motherName ||
                      selectedRider?.dob) && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-3">
                        {selectedRider?.fatherName && (
                          <span>
                            Father:{' '}
                            <span className="font-semibold text-foreground">
                              {selectedRider.fatherName}
                            </span>
                          </span>
                        )}
                        {selectedRider?.motherName && (
                          <span>
                            Mother:{' '}
                            <span className="font-semibold text-foreground">
                              {selectedRider.motherName}
                            </span>
                          </span>
                        )}
                        {selectedRider?.dob && (
                          <span>
                            DOB:{' '}
                            <span className="font-semibold text-foreground">
                              {selectedRider.dob}
                            </span>
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant={isEditing ? 'default' : 'outline'}
                    size="sm"
                    className={`rounded-xl h-10 px-5 gap-2 font-bold transition-all ${isEditing ? 'bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-500/20 border-none' : ''}`}
                    onClick={() => (isEditing ? setIsEditing(false) : startEditing())}
                  >
                    {isEditing ? <Lock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    {isEditing ? 'Editing Active' : 'Unlock to Edit'}
                  </Button>
                  <Badge
                    variant="outline"
                    className="h-10 px-4 rounded-xl bg-blue-500/5 border-blue-500/20 text-blue-600 font-bold uppercase tracking-widest text-[10px] flex items-center gap-2"
                  >
                    <ShieldCheck className="w-3 h-3" /> Rider Details
                  </Badge>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto px-8 py-4 no-scrollbar">
              {selectedRider && (
                <Tabs defaultValue="profile" className="w-full">
                  <TabsList className="grid w-full grid-cols-8 mb-8 bg-muted/30 p-1 rounded-2xl h-12 sticky top-0 z-10 backdrop-blur-md">
                    <TabsTrigger
                      value="profile"
                      className="rounded-xl font-bold text-[10px] uppercase"
                    >
                      Personal Info
                    </TabsTrigger>
                    <TabsTrigger value="kyc" className="rounded-xl font-bold text-[10px] uppercase">
                      ID Photos
                    </TabsTrigger>
                    <TabsTrigger
                      value="guarantor"
                      className="rounded-xl font-bold text-[10px] uppercase"
                    >
                      Guarantor Details
                    </TabsTrigger>
                    <TabsTrigger
                      value="inspection"
                      className="rounded-xl font-bold text-[10px] uppercase"
                    >
                      Vehicle Handover
                    </TabsTrigger>
                    <TabsTrigger
                      value="journey"
                      className="rounded-xl font-bold text-[10px] uppercase"
                    >
                      Account Steps
                    </TabsTrigger>
                    <TabsTrigger
                      value="money"
                      className="rounded-xl font-bold text-[10px] uppercase"
                    >
                      Money
                    </TabsTrigger>
                    <TabsTrigger
                      value="device"
                      className="rounded-xl font-bold text-[10px] uppercase"
                    >
                      Phone Access
                    </TabsTrigger>
                    <TabsTrigger value="ops" className="rounded-xl font-bold text-[10px] uppercase">
                      Work Details
                    </TabsTrigger>
                  </TabsList>

                  {/* ── Profile Tab ── */}
                  <TabsContent
                    value="profile"
                    className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    {/* High Priority Alerts */}
                    {(selectedRider.returnPending || selectedRider.tlChangeRequested) && (
                      <div className="space-y-3">
                        {selectedRider.returnPending && (
                          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center">
                                <Clock className="w-5 h-5 text-rose-500" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-rose-600">
                                  Vehicle Return Pending
                                </p>
                                <p className="text-xs text-rose-500/70">
                                  Rider has submitted photos for return approval.
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-rose-500/20 text-rose-600 hover:bg-rose-500/10"
                            >
                              Review Photos
                            </Button>
                          </div>
                        )}
                        {selectedRider.tlChangeRequested && (
                          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                                  <UserPlus className="w-5 h-5 text-amber-500" />
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-amber-600">
                                    TL Change Requested
                                  </p>
                                  <p className="text-xs text-amber-500/70">
                                    Reason: {selectedRider.tlChangeReason || 'No reason provided'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-600"
                                  onClick={() => handleTlAction(selectedRider.id, 'reject')}
                                >
                                  Reject
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-amber-500 hover:bg-amber-600"
                                  onClick={() => handleTlAction(selectedRider.id, 'approve')}
                                >
                                  Approve Change
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-6">
                      <DetailGroup
                        label="Full Name"
                        value={isEditing ? editForm.fullName : selectedRider.fullName}
                        isEditing={isEditing}
                        field="fullName"
                        onEdit={(v) => setEditForm({ ...editForm, fullName: v })}
                      />
                      <DetailGroup
                        label="Email Address"
                        value={isEditing ? editForm.email : selectedRider.email}
                        isEditing={isEditing}
                        field="email"
                        onEdit={(v) => setEditForm({ ...editForm, email: v })}
                      />
                      <DetailGroup
                        label="Phone Number"
                        value={isEditing ? editForm.phone : selectedRider.phone}
                        isEditing={isEditing}
                        field="phone"
                        onEdit={(v) => setEditForm({ ...editForm, phone: v })}
                      />
                      <DetailGroup
                        label="Father's Name"
                        value={isEditing ? editForm.fatherName : selectedRider.fatherName}
                        isEditing={isEditing}
                        field="fatherName"
                        onEdit={(v) => setEditForm({ ...editForm, fatherName: v })}
                      />
                      <DetailGroup
                        label="Mother's Name"
                        value={isEditing ? editForm.motherName : selectedRider.motherName}
                        isEditing={isEditing}
                        field="motherName"
                        onEdit={(v) => setEditForm({ ...editForm, motherName: v })}
                      />
                      <DetailGroup
                        label="Date of Birth"
                        value={isEditing ? editForm.dob : selectedRider.dob}
                        isEditing={isEditing}
                        field="dob"
                        type="date"
                        onEdit={(v) => setEditForm({ ...editForm, dob: v })}
                      />
                      <DetailGroup
                        label="Intent"
                        value={isEditing ? editForm.intent : selectedRider.intent}
                        isEditing={isEditing}
                        field="intent"
                        onEdit={(v) => setEditForm({ ...editForm, intent: v })}
                      />
                      <DetailGroup
                        label="Emergency Contact"
                        value={
                          isEditing ? editForm.emergencyContact : selectedRider.emergencyContact
                        }
                        isEditing={isEditing}
                        field="emergencyContact"
                        onEdit={(v) => setEditForm({ ...editForm, emergencyContact: v })}
                      />
                      <DetailGroup
                        label="Lifecycle Status"
                        value={isEditing ? editForm.lifecycleStatus : selectedRider.lifecycleStatus}
                        isEditing={isEditing}
                        field="lifecycleStatus"
                        type="select"
                        options={STATE_FILTERS}
                        onEdit={(v) => setEditForm({ ...editForm, lifecycleStatus: v })}
                      />
                    </div>

                    <div className="col-span-2 space-y-2">
                      <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-widest text-[10px]">
                        <MapPin className="w-3 h-3" /> Current Address
                      </div>
                      {isEditing ? (
                        <textarea
                          value={editForm.currentAddress || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, currentAddress: e.target.value })
                          }
                          className="w-full min-h-[100px] p-4 rounded-2xl border border-muted/50 bg-muted/5 text-sm focus:outline-none focus:ring-1 ring-primary/30 transition-all font-medium"
                        />
                      ) : selectedRider.currentAddress ? (
                        <p className="text-sm font-medium whitespace-pre-wrap">
                          {selectedRider.currentAddress}
                        </p>
                      ) : (
                        <p className="text-sm italic text-muted-foreground">Not provided</p>
                      )}
                    </div>
                  </TabsContent>

                  {/* ── KYC Media Tab ── */}
                  <TabsContent
                    value="kyc"
                    className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    {selectedKycDocs.size > 0 && (
                      <div className="flex items-center gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-xl">
                        <span className="text-xs font-medium text-destructive">
                          {selectedKycDocs.size} document(s) selected
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs px-2 hover:bg-destructive/10 hover:text-destructive"
                          disabled={saving}
                          onClick={handleBulkDeleteKycDocs}
                        >
                          <Trash2 className="w-3 h-3 mr-1" /> Delete Selected
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 hover:bg-muted/10"
                          onClick={() => setSelectedKycDocs(new Set())}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/10 border border-muted/20">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className={`text-xs uppercase font-black tracking-widest ${getKycBadge(selectedRider.kycStatus)}`}
                        >
                          {selectedRider.kycStatus}
                        </Badge>
                        {selectedRider.kycRejectionReason && (
                          <span className="text-xs text-muted-foreground">
                            Reason: {selectedRider.kycRejectionReason}
                          </span>
                        )}
                      </div>
                      {(selectedRider.kycStatus === 'PENDING' ||
                        selectedRider.kycStatus === 'SUBMITTED' ||
                        selectedRider.kycStatus === 'INFO_REQUIRED') && (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                            onClick={() =>
                              setConfirmKycAction({ rider: selectedRider, action: 'approve' })
                            }
                          >
                            <ShieldCheck className="w-3 h-3 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-orange-500/30 text-orange-600 hover:bg-orange-500/10"
                            onClick={() =>
                              setConfirmKycAction({ rider: selectedRider, action: 'info_required' })
                            }
                          >
                            <ShieldAlert className="w-3 h-3 mr-1" /> Needs Correction
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-7 text-xs"
                            onClick={() =>
                              setConfirmKycAction({ rider: selectedRider, action: 'reject' })
                            }
                          >
                            <ShieldX className="w-3 h-3 mr-1" /> Reject
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <MediaPreview
                          src={selectedRider.profilePhoto}
                          label="Profile Photo"
                          onDelete={() => handleDeleteKycDoc('profilePhoto')}
                          selected={selectedKycDocs.has('profilePhoto')}
                          onSelect={() => toggleKycDoc('profilePhoto')}
                        />
                        {isEditing && (
                          <Input
                            value={editForm.profilePhoto || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, profilePhoto: e.target.value })
                            }
                            placeholder="Profile photo URL"
                            className="h-8 text-xs"
                          />
                        )}
                      </div>

                      <div className="space-y-2">
                        <MediaPreview
                          src={selectedRider.signature}
                          label="Rider Signature"
                          onDelete={() => handleDeleteKycDoc('signature')}
                          selected={selectedKycDocs.has('signature')}
                          onSelect={() => toggleKycDoc('signature')}
                        />
                        {isEditing && (
                          <Input
                            value={editForm.signature || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, signature: e.target.value })
                            }
                            placeholder="Signature URL"
                            className="h-8 text-xs"
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <MediaPreview
                          src={selectedRider.aadhaarFront}
                          label="Aadhaar Front"
                          onDelete={() => handleDeleteKycDoc('aadhaarFront')}
                          selected={selectedKycDocs.has('aadhaarFront')}
                          onSelect={() => toggleKycDoc('aadhaarFront')}
                        />
                        {isEditing && (
                          <Input
                            value={editForm.aadhaarFront || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, aadhaarFront: e.target.value })
                            }
                            placeholder="Aadhaar front URL"
                            className="h-8 text-xs"
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <MediaPreview
                          src={selectedRider.aadhaarBack}
                          label="Aadhaar Back"
                          onDelete={() => handleDeleteKycDoc('aadhaarBack')}
                          selected={selectedKycDocs.has('aadhaarBack')}
                          onSelect={() => toggleKycDoc('aadhaarBack')}
                        />
                        {isEditing && (
                          <Input
                            value={editForm.aadhaarBack || ''}
                            onChange={(e) =>
                              setEditForm({ ...editForm, aadhaarBack: e.target.value })
                            }
                            placeholder="Aadhaar back URL"
                            className="h-8 text-xs"
                          />
                        )}
                      </div>
                      <div className="space-y-2">
                        <MediaPreview
                          src={selectedRider.panCard}
                          label="PAN Card"
                          onDelete={() => handleDeleteKycDoc('panCard')}
                          selected={selectedKycDocs.has('panCard')}
                          onSelect={() => toggleKycDoc('panCard')}
                        />
                        {isEditing && (
                          <Input
                            value={editForm.panCard || ''}
                            onChange={(e) => setEditForm({ ...editForm, panCard: e.target.value })}
                            placeholder="PAN card URL"
                            className="h-8 text-xs"
                          />
                        )}
                      </div>
                    </div>
                    <div className="p-8 rounded-3xl bg-blue-500/5 border border-blue-500/10">
                      <div className="flex items-center gap-3 mb-6">
                        <Building className="w-8 h-8 text-blue-600" />
                        <h4 className="text-lg font-black tracking-tight text-blue-900">
                          Bank Details
                        </h4>
                      </div>
                      <div className="grid grid-cols-3 gap-6">
                        <DetailGroup
                          label="Bank Name"
                          value={isEditing ? editForm.bankName : selectedRider.bankName}
                          isEditing={isEditing}
                          field="bankName"
                          onEdit={(v) => setEditForm({ ...editForm, bankName: v })}
                        />
                        <DetailGroup
                          label="Account Number"
                          value={isEditing ? editForm.accountNumber : selectedRider.accountNumber}
                          isEditing={isEditing}
                          field="accountNumber"
                          onEdit={(v) => setEditForm({ ...editForm, accountNumber: v })}
                        />
                        <DetailGroup
                          label="IFSC Code"
                          value={isEditing ? editForm.ifscCode : selectedRider.ifscCode}
                          isEditing={isEditing}
                          field="ifscCode"
                          onEdit={(v) => setEditForm({ ...editForm, ifscCode: v })}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* ── Guarantor Tab ── */}
                  <TabsContent
                    value="guarantor"
                    className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    {selectedRider.sharedGuarantorWith?.length > 0 && (
                      <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-600">
                        <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                        <div className="text-xs font-bold">
                          Shared Backup Contact Risk: This contact phone is also linked to:{' '}
                          {selectedRider.sharedGuarantorWith.join(', ')}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                          <Users className="w-4 h-4" /> Personal Information
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <DetailGroup
                            label="Full Name"
                            value={isEditing ? editForm.guarantorName : selectedRider.guarantorName}
                            isEditing={isEditing}
                            field="guarantorName"
                            onEdit={(v) => setEditForm({ ...editForm, guarantorName: v })}
                          />
                          <DetailGroup
                            label="Phone Number"
                            value={
                              isEditing ? editForm.guarantorPhone : selectedRider.guarantorPhone
                            }
                            isEditing={isEditing}
                            field="guarantorPhone"
                            onEdit={(v) => setEditForm({ ...editForm, guarantorPhone: v })}
                          />
                          <DetailGroup
                            label="Date of Birth"
                            value={isEditing ? editForm.guarantorDob : selectedRider.guarantorDob}
                            isEditing={isEditing}
                            field="guarantorDob"
                            type="date"
                            onEdit={(v) => setEditForm({ ...editForm, guarantorDob: v })}
                          />
                          <DetailGroup
                            label="Father's Name"
                            value={
                              isEditing
                                ? editForm.guarantorFatherName
                                : selectedRider.guarantorFatherName
                            }
                            isEditing={isEditing}
                            field="guarantorFatherName"
                            onEdit={(v) => setEditForm({ ...editForm, guarantorFatherName: v })}
                          />
                          <DetailGroup
                            label="Mother's Name"
                            value={
                              isEditing
                                ? editForm.guarantorMotherName
                                : selectedRider.guarantorMotherName
                            }
                            isEditing={isEditing}
                            field="guarantorMotherName"
                            onEdit={(v) => setEditForm({ ...editForm, guarantorMotherName: v })}
                          />
                          <DetailGroup
                            label="Address"
                            value={
                              isEditing ? editForm.guarantorAddress : selectedRider.guarantorAddress
                            }
                            isEditing={isEditing}
                            field="guarantorAddress"
                            onEdit={(v) => setEditForm({ ...editForm, guarantorAddress: v })}
                          />
                        </div>
                        <div className="pt-4">
                          <DetailGroup
                            label="Verification Status"
                            value={
                              isEditing ? editForm.guarantorStatus : selectedRider.guarantorStatus
                            }
                            isEditing={isEditing}
                            field="guarantorStatus"
                            type="select"
                            options={['PENDING', 'VERIFIED', 'APPROVED', 'REJECTED']}
                            onEdit={(v) => setEditForm({ ...editForm, guarantorStatus: v })}
                          />
                        </div>
                      </div>
                      <div className="space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4" /> Visual Verification
                        </h4>
                        <div className="grid grid-cols-3 gap-4">
                          <MediaPreview
                            src={selectedRider.guarantorAadhaarFront}
                            label="Aadhaar Front"
                          />
                          <MediaPreview
                            src={selectedRider.guarantorAadhaarBack}
                            label="Aadhaar Back"
                          />
                          <MediaPreview src={selectedRider.guarantorPan} label="PAN Card" />
                          <MediaPreview src={selectedRider.guarantorSignature} label="Signature" />
                          <MediaPreview
                            src={selectedRider.guarantorPhoto}
                            label="Guarantor Photo"
                          />
                        </div>
                        <MediaPreview
                          src={selectedRider.guarantorVideo}
                          label="Guarantor Video"
                          type="video"
                        />
                      </div>
                    </div>
                    {selectedRider.guarantorName && !isEditing && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 px-3"
                        onClick={handleClearGuarantor}
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Clear Guarantor
                      </Button>
                    )}
                  </TabsContent>

                  {/* ── Pickup Inspection Tab ── */}
                  <TabsContent
                    value="inspection"
                    className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    <div className="p-6 rounded-3xl bg-rose-500/5 border border-rose-500/10">
                      <div className="flex items-center justify-between mb-8">
                        <h4 className="text-sm font-black uppercase tracking-widest text-rose-600 flex items-center gap-2">
                          <Camera className="w-5 h-5" /> Vehicle Pickup Photos
                        </h4>
                        <div className="text-[10px] font-bold uppercase text-rose-500/60 tracking-tighter">
                          Required for Post-Active State
                        </div>
                      </div>
                      {!selectedRider.pickupPhotoFront &&
                      !selectedRider.pickupPhotoBack &&
                      !selectedRider.pickupPhotoLeft &&
                      !selectedRider.pickupPhotoRight &&
                      !selectedRider.pickupPhotoWithVehicle ? (
                        <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-3xl bg-background/50 text-center opacity-40">
                          <Camera className="w-10 h-10 text-rose-500 mb-4" />
                          <p className="text-sm font-black uppercase">No Pickup Photos</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Vehicle handover photos have not been uploaded yet.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-6">
                          <MediaPreview src={selectedRider.pickupPhotoFront} label="Front View" />
                          <MediaPreview src={selectedRider.pickupPhotoBack} label="Rear View" />
                          <MediaPreview src={selectedRider.pickupPhotoLeft} label="Left Side" />
                          <MediaPreview src={selectedRider.pickupPhotoRight} label="Right Side" />
                          <MediaPreview
                            src={selectedRider.pickupPhotoWithVehicle}
                            label="With Vehicle"
                          />
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* ── Lifecycle Tab ── */}
                  <TabsContent
                    value="journey"
                    className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-widest text-primary">
                          Sign-Up Steps
                        </h4>
                        <div className="space-y-3">
                          {[
                            { label: 'Deposit', key: 'depositDone', dateKey: 'depositDoneAt' },
                            { label: 'KYC', key: 'kycDone', dateKey: 'kycDoneAt' },
                            { label: 'Plan', key: 'planDone', dateKey: 'planDoneAt' },
                            { label: 'Pickup', key: 'pickupDone', dateKey: 'pickedUpAt' },
                          ].map((step) => (
                            <div
                              key={step.key}
                              className="flex items-center justify-between p-5 rounded-2xl bg-muted/20 border border-muted/50 group transition-all hover:bg-muted/30"
                            >
                              <div className="space-y-0.5">
                                <span className="text-xs font-black uppercase tracking-tight block">
                                  {step.label}
                                </span>
                                <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest">
                                  System Flag
                                </span>
                                {selectedRider[step.key] && selectedRider[step.dateKey] && (
                                  <span className="text-[9px] text-muted-foreground/50 block mt-0.5">
                                    {formatDateDDMMYYYY(selectedRider[step.dateKey])}
                                  </span>
                                )}
                              </div>
                              {isEditing ? (
                                <button
                                  onClick={() =>
                                    setEditForm({ ...editForm, [step.key]: !editForm[step.key] })
                                  }
                                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold transition-all ${editForm[step.key] ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'}`}
                                >
                                  {editForm[step.key] ? (
                                    <CheckCircle2 className="w-3 h-3" />
                                  ) : (
                                    <Clock className="w-3 h-3" />
                                  )}
                                  {editForm[step.key] ? 'Done' : 'Pending'}
                                </button>
                              ) : selectedRider[step.key] ? (
                                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10 w-fit gap-1 text-[10px]">
                                  <CheckCircle2 className="w-3 h-3" /> Done
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-amber-500 border-amber-500/20 w-fit gap-1 text-[10px]"
                                >
                                  <Clock className="w-3 h-3" /> Pending
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-widest text-primary">
                          Account Controls
                        </h4>
                        <div className="p-8 rounded-3xl bg-primary/5 border border-primary/10 space-y-8">
                          <DetailGroup
                            label="Lifecycle Status"
                            value={
                              isEditing ? editForm.lifecycleStatus : selectedRider.lifecycleStatus
                            }
                            isEditing={isEditing}
                            field="lifecycleStatus"
                            type="select"
                            options={['NEW', 'KYC_SUBMITTED', 'ACTIVE', 'SUSPENDED', 'CLOSED']}
                            onEdit={(v) => setEditForm({ ...editForm, lifecycleStatus: v })}
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* ── Finance Tab ── */}
                  <TabsContent
                    value="money"
                    className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    <div className="grid grid-cols-2 gap-6">
                      <div className="p-10 rounded-[2.5rem] bg-emerald-500/5 border border-emerald-500/10 shadow-sm transition-all hover:shadow-lg hover:shadow-emerald-500/5">
                        <div className="flex items-center gap-3 mb-4 text-emerald-600">
                          <Wallet className="w-6 h-6" />
                          <Label className="text-xs font-black uppercase tracking-widest">
                            Current Wallet Balance
                          </Label>
                        </div>
                        <div className="flex items-center text-4xl font-black tracking-tighter">
                          <span className="text-emerald-500 opacity-50 mr-2">₹</span>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={editForm.walletBalance || 0}
                              onChange={(e) =>
                                setEditForm({ ...editForm, walletBalance: Number(e.target.value) })
                              }
                              className="bg-transparent border-none text-4xl font-black h-auto p-0 focus-visible:ring-0 w-full"
                            />
                          ) : (
                            <span>
                              {(selectedRider.walletBalance || 0).toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="p-10 rounded-[2.5rem] bg-blue-500/5 border border-blue-500/10 shadow-sm transition-all hover:shadow-lg hover:shadow-blue-500/5">
                        <div className="flex items-center gap-3 mb-4 text-blue-600">
                          <ShieldCheck className="w-6 h-6" />
                          <Label className="text-xs font-black uppercase tracking-widest">
                            Security Deposit Held
                          </Label>
                        </div>
                        <div className="flex items-center text-4xl font-black tracking-tighter">
                          <span className="text-blue-500 opacity-50 mr-2">₹</span>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={editForm.securityDeposit || 0}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  securityDeposit: Number(e.target.value),
                                })
                              }
                              className="bg-transparent border-none text-4xl font-black h-auto p-0 focus-visible:ring-0 w-full"
                            />
                          ) : (
                            <span>
                              {(selectedRider.securityDeposit || 0).toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="p-6 rounded-3xl bg-muted/20 border flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-background flex items-center justify-center border shadow-sm">
                          <Calendar className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/50">
                            Deposit Payment Status
                          </p>
                          {isEditing ? (
                            <Select
                              value={editForm.depositStatus || 'PENDING'}
                              onValueChange={(v) => setEditForm({ ...editForm, depositStatus: v })}
                            >
                              <SelectTrigger className="bg-transparent border-none h-auto p-0 font-black text-lg focus:outline-none">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PENDING">PENDING</SelectItem>
                                <SelectItem value="PAID">PAID</SelectItem>
                                <SelectItem value="REFUNDED">REFUNDED</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase font-black tracking-widest ${getKycBadge(selectedRider.depositStatus)}`}
                            >
                              {selectedRider.depositStatus}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase text-muted-foreground/50 mb-1">
                          Payment Streak
                        </p>
                        <div className="text-2xl font-black flex items-center justify-end gap-2 text-emerald-600">
                          <Zap className="w-5 h-5 fill-emerald-600" />
                          {selectedRider.paymentStreak || 0}
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  {/* ── Device Tab ── */}
                  <TabsContent
                    value="device"
                    className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    {/* Permission Matrix */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-bold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                        <Smartphone className="w-4 h-4" /> Phone Permissions
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {permissions.map((perm) => (
                          <div
                            key={perm.id}
                            className="flex flex-col gap-1.5 p-3 rounded-xl border bg-muted/5"
                          >
                            <span className="text-[10px] font-bold uppercase text-muted-foreground/60">
                              {perm.label}
                            </span>
                            <div className="flex items-center justify-between">
                              {selectedRider[perm.id] ? (
                                <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10 w-fit gap-1 text-[10px]">
                                  <CheckCircle2 className="w-3 h-3" /> Granted
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-rose-400 border-rose-400/20 w-fit gap-1 text-[10px]"
                                >
                                  <ShieldAlert className="w-3 h-3" /> Required
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <DeviceTrackingView riderId={selectedRider.id} />
                  </TabsContent>

                  {/* ── Ops Tab ── */}
                  <TabsContent
                    value="ops"
                    className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    <div className="grid grid-cols-2 gap-8">
                      <div className="p-8 rounded-3xl bg-muted/20 border space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                          <Users className="w-4 h-4" /> Hierarchy & Support
                        </h4>
                        <div className="space-y-4">
                          <DetailGroup
                            label="Assigned Team Leader"
                            value={isEditing ? editForm.teamLeader : selectedRider.teamLeader}
                            isEditing={isEditing}
                            field="teamLeader"
                            onEdit={(v) => setEditForm({ ...editForm, teamLeader: v })}
                          />
                          <DetailGroup
                            label="Assigned TL Name"
                            value={
                              isEditing ? editForm.assignedTlName : selectedRider.assignedTlName
                            }
                            isEditing={isEditing}
                            field="assignedTlName"
                            onEdit={(v) => setEditForm({ ...editForm, assignedTlName: v })}
                          />
                          <DetailGroup
                            label="Assigned TL Phone"
                            value={
                              isEditing ? editForm.assignedTlPhone : selectedRider.assignedTlPhone
                            }
                            isEditing={isEditing}
                            field="assignedTlPhone"
                            onEdit={(v) => setEditForm({ ...editForm, assignedTlPhone: v })}
                          />
                          <DetailGroup
                            label="Emergency Contact"
                            value={
                              isEditing ? editForm.emergencyContact : selectedRider.emergencyContact
                            }
                            isEditing={isEditing}
                            field="emergencyContact"
                            onEdit={(v) => setEditForm({ ...editForm, emergencyContact: v })}
                          />
                          <DetailGroup
                            label="Referred By"
                            value={isEditing ? editForm.referredBy : selectedRider.referredBy}
                            isEditing={isEditing}
                            field="referredBy"
                            onEdit={(v) => setEditForm({ ...editForm, referredBy: v })}
                          />
                        </div>
                      </div>
                      <div className="p-8 rounded-3xl bg-muted/20 border space-y-6">
                        <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                          <Bike className="w-4 h-4" /> Hub Operations
                        </h4>
                        <div className="space-y-4">
                          <DetailGroup
                            label="Preferred Pickup Hub"
                            value={isEditing ? editForm.pickupHub : selectedRider.pickupHub}
                            isEditing={isEditing}
                            field="pickupHub"
                            onEdit={(v) => setEditForm({ ...editForm, pickupHub: v })}
                          />
                          <DetailGroup
                            label="Work Shift Preference"
                            value={
                              isEditing ? editForm.preferredShift : selectedRider.preferredShift
                            }
                            isEditing={isEditing}
                            field="preferredShift"
                            onEdit={(v) => setEditForm({ ...editForm, preferredShift: v })}
                          />
                          <DetailGroup
                            label="Delivery Partner ID"
                            value={isEditing ? editForm.deliveryId : selectedRider.deliveryId}
                            isEditing={isEditing}
                            field="deliveryId"
                            onEdit={(v) => setEditForm({ ...editForm, deliveryId: v })}
                          />
                          <DetailGroup
                            label="User Intent"
                            value={isEditing ? editForm.intent : selectedRider.intent}
                            isEditing={isEditing}
                            field="intent"
                            onEdit={(v) => setEditForm({ ...editForm, intent: v })}
                          />
                          <DetailGroup
                            label="Active Vehicle"
                            value={isEditing ? editForm.activeVehicle : selectedRider.activeVehicle}
                            isEditing={isEditing}
                            field="activeVehicle"
                            onEdit={(v) => setEditForm({ ...editForm, activeVehicle: v })}
                          />
                          <DetailGroup
                            label="Vehicle Model"
                            value={
                              isEditing
                                ? editForm.activeVehicleModel
                                : selectedRider.activeVehicleModel
                            }
                            isEditing={isEditing}
                            field="activeVehicleModel"
                            onEdit={(v) => setEditForm({ ...editForm, activeVehicleModel: v })}
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </div>

            <DialogFooter className="px-8 py-6 bg-muted/20 border-t flex items-center justify-between">
              <div className="text-[10px] text-muted-foreground uppercase font-black tracking-widest flex items-center gap-2">
                {isEditing ? (
                  <Lock className="w-3 h-3 text-amber-500" />
                ) : (
                  <Lock className="w-3 h-3" />
                )}
                {isEditing ? 'Editing Active' : 'View Only'}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedRider(null);
                    setIsEditing(false);
                  }}
                  className="rounded-xl h-11 px-6 font-bold uppercase text-[10px] tracking-widest"
                >
                  Close
                </Button>
                {isEditing && (
                  <Button
                    onClick={handleUpdateRider}
                    disabled={saving}
                    className="rounded-xl h-11 px-10 font-black uppercase text-[10px] tracking-widest bg-primary shadow-lg shadow-primary/20 transition-all hover:scale-105"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

  );
}
