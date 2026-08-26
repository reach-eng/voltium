import { Search, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { STATE_FILTERS } from './helpers';

const KYC_FILTERS = ['ALL', 'APPROVED', 'REJECTED', 'INFO_REQUIRED', 'PENDING'];

interface RiderSearchInputProps {
  search: string;
  setSearch: (value: string) => void;
  searching: boolean;
}

export function RiderSearchInput({ search, setSearch, searching }: RiderSearchInputProps) {
  return (
    <div className="relative flex-1 max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <Input
        placeholder="Search by name, rider ID, or phone..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="pl-10 h-11 rounded-xl bg-background border-muted-foreground/20 focus:border-primary text-base"
      />
      {searching && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

interface RiderFilterTabsProps {
  stateFilter: string;
  setStateFilter: (value: string) => void;
  kycFilter: string;
  setKycFilter: (value: string) => void;
}

export function RiderFilterTabs({
  stateFilter,
  setStateFilter,
  kycFilter,
  setKycFilter,
}: RiderFilterTabsProps) {
  return (
    <>
      {/* Keyboard Shortcuts Hint */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Keyboard className="w-3 h-3" />
        <span>Ctrl+A Select All · Ctrl+K Approve · Ctrl+R Suspend · Ctrl+Z Undo</span>
      </div>

      {/* State Filter Tabs */}
      <Tabs value={stateFilter} onValueChange={setStateFilter}>
        <TabsList className="bg-muted/30 p-1 rounded-xl">
          {STATE_FILTERS.map((s) => (
            <TabsTrigger
              key={s}
              value={s}
              className="rounded-lg text-xs font-bold uppercase tracking-tight h-8 px-4"
            >
              {s.replace('_', ' ')}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* KYC Status Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
          KYC:
        </span>
        {KYC_FILTERS.map((s) => (
          <Button
            key={s}
            variant="ghost"
            size="sm"
            onClick={() => setKycFilter(s)}
            className={`h-7 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight transition-all ${
              kycFilter === s
                ? 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
            }`}
          >
            {s.replace('_', ' ')}
          </Button>
        ))}
      </div>
    </>
  );
}
