'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Search, Shield, CheckCircle, XCircle, RefreshCw, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface Guarantor {
  id: string;
  name: string;
  relation: string;
  phone: string;
  status: string;
  riderName: string;
  riderId: string;
  createdAt: string;
  aadhaarFront: string | null;
  aadhaarBack: string | null;
  pan: string | null;
}

export default function GuarantorManagement() {
  const [guarantors, setGuarantors] = useState<Guarantor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGuarantor, setSelectedGuarantor] = useState<Guarantor | null>(null);
  const [fieldNote, setFieldNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    // Simulate fetching guarantors
    setTimeout(() => {
      setGuarantors([
        {
          id: 'g-1',
          name: 'Rajesh Kumar',
          relation: 'Father',
          phone: '+919876543210',
          status: 'PENDING',
          riderName: 'Aarav Kumar',
          riderId: 'r-101',
          createdAt: new Date().toISOString(),
          aadhaarFront: '/api/files/mock-aadhaar-front.jpg',
          aadhaarBack: '/api/files/mock-aadhaar-back.jpg',
          pan: '/api/files/mock-pan.jpg',
        },
        {
          id: 'g-2',
          name: 'Sunita Sharma',
          relation: 'Mother',
          phone: '+919988776655',
          status: 'APPROVED',
          riderName: 'Nisha Sharma',
          riderId: 'r-102',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          aadhaarFront: null,
          aadhaarBack: null,
          pan: null,
        }
      ]);
      setLoading(false);
    }, 500);
  }, []);

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setActionLoading(true);
    // Simulate API call
    setTimeout(() => {
      setGuarantors((prev) =>
        prev.map((g) => (g.id === id ? { ...g, status: newStatus } : g))
      );
      if (selectedGuarantor && selectedGuarantor.id === id) {
        setSelectedGuarantor((prev) => prev ? { ...prev, status: newStatus } : null);
      }
      toast.success(`Guarantor status updated to ${newStatus}`);
      setActionLoading(false);
    }, 500);
  };

  const filteredGuarantors = guarantors.filter(
    (g) =>
      g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.riderName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Guarantors</h2>
          <p className="text-muted-foreground">Verify and review guarantors for rider onboarding.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search guarantors..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Verification Queue</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : filteredGuarantors.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">No guarantors found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left font-medium text-muted-foreground">
                      <th className="pb-3">Name</th>
                      <th className="pb-3">Relationship</th>
                      <th className="pb-3">Rider</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredGuarantors.map((g) => (
                      <tr key={g.id} className="hover:bg-muted/50">
                        <td className="py-3 font-medium">{g.name}</td>
                        <td className="py-3">{g.relation}</td>
                        <td className="py-3">
                          <div>{g.riderName}</div>
                          <div className="text-xs text-muted-foreground">ID: {g.riderId}</div>
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={
                              g.status === 'APPROVED'
                                ? 'default'
                                : g.status === 'PENDING'
                                ? 'secondary'
                                : 'destructive'
                            }
                          >
                            {g.status}
                          </Badge>
                        </td>
                        <td className="py-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedGuarantor(g)}>
                            Review
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedGuarantor ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-bold">Review Details</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedGuarantor(null)}>
                Close
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm">Guarantor Information</h4>
                <div className="text-sm mt-1">
                  <div>Name: {selectedGuarantor.name}</div>
                  <div>Phone: {selectedGuarantor.phone}</div>
                  <div>Relationship: {selectedGuarantor.relation}</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm">Rider Details</h4>
                <div className="text-sm mt-1">
                  <div>Rider: {selectedGuarantor.riderName}</div>
                  <div className="text-xs text-muted-foreground">ID: {selectedGuarantor.riderId}</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm">Documents</h4>
                <div className="flex flex-col gap-2 mt-2">
                  <Button variant="outline" size="sm" className="justify-start gap-2">
                    <FileText className="h-4 w-4" /> Aadhaar Front
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start gap-2">
                    <FileText className="h-4 w-4" /> Aadhaar Back
                  </Button>
                  <Button variant="outline" size="sm" className="justify-start gap-2">
                    <FileText className="h-4 w-4" /> PAN Card
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Field Verification Notes</label>
                <Textarea
                  placeholder="Enter details from field check..."
                  value={fieldNote}
                  onChange={(e) => setFieldNote(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={actionLoading || selectedGuarantor.status === 'APPROVED'}
                  onClick={() => handleStatusUpdate(selectedGuarantor.id, 'APPROVED')}
                >
                  <CheckCircle className="h-4 w-4 mr-2" /> Approve
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  disabled={actionLoading || selectedGuarantor.status === 'REJECTED'}
                  onClick={() => handleStatusUpdate(selectedGuarantor.id, 'REJECTED')}
                >
                  <XCircle className="h-4 w-4 mr-2" /> Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <Shield className="h-10 w-10 mb-4 text-muted" />
            <p className="text-sm">Select a guarantor from the verification queue to begin review.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
