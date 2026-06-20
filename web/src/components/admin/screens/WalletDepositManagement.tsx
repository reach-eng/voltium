'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Wallet, Search, RefreshCw, ArrowUpRight, ArrowDownLeft, FileDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface LedgerEntry {
  id: string;
  riderName: string;
  riderId: string;
  type: 'CREDIT' | 'DEBIT';
  purpose: string;
  amount: number;
  createdAt: string;
}

export default function WalletDepositManagement() {
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Simulate fetching ledger entries
    setTimeout(() => {
      setLedger([
        {
          id: 'l-1',
          riderName: 'Aarav Kumar',
          riderId: 'r-101',
          type: 'CREDIT',
          purpose: 'TOP_UP',
          amount: 150000, // in paise: ₹1500
          createdAt: new Date().toISOString(),
        },
        {
          id: 'l-2',
          riderName: 'Nisha Sharma',
          riderId: 'r-102',
          type: 'DEBIT',
          purpose: 'RENT_PAYMENT',
          amount: 29900, // in paise: ₹299
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'l-3',
          riderName: 'Rahul Patel',
          riderId: 'r-103',
          type: 'CREDIT',
          purpose: 'SECURITY_DEPOSIT',
          amount: 150000, // in paise: ₹1500
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        },
      ]);
      setLoading(false);
    }, 500);
  }, []);

  const handleExport = () => {
    toast.success('Wallet ledger exported to CSV successfully');
  };

  const filteredLedger = ledger.filter(
    (l) =>
      l.riderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.purpose.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Wallet & Deposits</h2>
          <p className="text-muted-foreground">
            Audit double-entry ledgers, security deposits, and adjustments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search ledger entries..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="gap-2" onClick={handleExport}>
            <FileDown className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹15,400.00</div>
            <p className="text-xs text-muted-foreground">Aggregated rider wallet funds</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deposits Held</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹7,500.00</div>
            <p className="text-xs text-muted-foreground">Active security deposit holdings</p>
          </CardContent>
        </Card>
        <Card className="bg-rose-500/5 border-rose-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Refund Queue</CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹3,000.00</div>
            <p className="text-xs text-muted-foreground">Pending deposit release reviews</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Double-Entry Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="overflow-x-auto animate-in fade-in duration-500">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {['Rider', 'Type', 'Purpose', 'Amount', 'Date'].map((h) => (
                      <th key={h} className="pb-3 text-left">
                        <Skeleton className="h-4 w-16" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td className="py-3">
                        <Skeleton className="h-4 w-28 mb-1" />
                        <Skeleton className="h-3 w-20" />
                      </td>
                      <td className="py-3">
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </td>
                      <td className="py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                      <td className="py-3">
                        <Skeleton className="h-4 w-16" />
                      </td>
                      <td className="py-3 text-right">
                        <Skeleton className="h-4 w-20 ml-auto" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : filteredLedger.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No ledger entries found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left font-medium text-muted-foreground">
                    <th className="pb-3">Rider</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Purpose</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredLedger.map((l) => (
                    <tr key={l.id} className="hover:bg-muted/50">
                      <td className="py-3 font-medium">
                        <div>{l.riderName}</div>
                        <div className="text-xs text-muted-foreground">ID: {l.riderId}</div>
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={l.type === 'CREDIT' ? 'default' : 'destructive'}
                          className={l.type === 'CREDIT' ? 'bg-emerald-600 text-white' : ''}
                        >
                          {l.type}
                        </Badge>
                      </td>
                      <td className="py-3 font-semibold">{l.purpose}</td>
                      <td className="py-3">₹{(l.amount / 100).toFixed(2)}</td>
                      <td className="py-3 text-right text-muted-foreground">
                        {new Date(l.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
