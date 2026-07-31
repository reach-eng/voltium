import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search } from 'lucide-react';

interface TransactionFiltersProps {
  tab: string;
  onTabChange: (tab: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  startDate: string;
  onStartDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
}

export function TransactionFilters({
  tab,
  onTabChange,
  search,
  onSearchChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
}: TransactionFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-4">
      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList className="bg-muted/30 p-1">
          <TabsTrigger value="all" className="h-10 px-4 text-xs">
            All
          </TabsTrigger>
          <TabsTrigger value="pending" className="h-10 px-4 text-xs">
            Pending
          </TabsTrigger>
          <TabsTrigger value="TOP_UP" className="h-10 px-4 text-xs">
            Top-ups
          </TabsTrigger>
          <TabsTrigger value="DEBIT" className="h-10 px-4 text-xs">
            Deductions
          </TabsTrigger>
          <TabsTrigger value="approved" className="h-10 px-4 text-xs">
            Approved
          </TabsTrigger>
          <TabsTrigger value="rejected" className="h-10 px-4 text-xs">
            Rejected
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex items-center gap-2 flex-1">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search rider or ID..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-11 rounded-xl border-muted-foreground/20 text-base"
          />
        </div>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="h-11 w-40 text-sm rounded-xl"
        />
        <Input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="h-11 w-40 text-sm rounded-xl"
        />
        {(search || startDate || endDate) && (
          <Button
            variant="ghost"
            size="default"
            className="h-11 text-sm text-muted-foreground"
            onClick={() => {
              onSearchChange('');
              onStartDateChange('');
              onEndDateChange('');
            }}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
