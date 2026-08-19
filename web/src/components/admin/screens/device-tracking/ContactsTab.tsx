'use client';

import { Search, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Contact } from './types';

interface ContactsTabProps {
  contacts: Contact[] | undefined;
  search: string;
  onSearchChange: (v: string) => void;
}

/**
 * R3.7bb split — Contacts sub-tab with phonebook search.
 */
export function ContactsTab({
  contacts,
  search,
  onSearchChange,
}: ContactsTabProps) {
  // P2-9 (2026-08-05 legal/device audit): the name branch lowercased the
  // query but the phone branch compared the raw input — inconsistent. Phones
  // are digits so case rarely matters, but normalize both branches against
  // the same lowercased query so behavior is uniform.
  const q = search.toLowerCase();
  const filtered = (contacts || []).filter(
    (c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search phonebook..."
            className="pl-9 rounded-xl bg-muted/30 border-transparent focus:bg-background h-11"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {filtered.map((contact, i) => (
          <div
            key={i}
            className="p-2.5 rounded-xl border bg-card/50 flex flex-col gap-1 hover:border-primary/30 transition-colors"
          >
            <p className="text-xs font-bold text-foreground/90 truncate">
              {contact.name}
            </p>
            <p className="text-[10px] font-mono tabular-nums text-primary">
              {contact.phone}
            </p>
            {contact.email && (
              <p className="text-[10px] text-muted-foreground truncate">
                {contact.email}
              </p>
            )}
          </div>
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-2xl border border-dashed text-muted-foreground">
          <Users className="w-8 h-8 mb-3 opacity-20" />
          <p className="text-sm font-bold">No contacts found</p>
        </div>
      )}
    </div>
  );
}
