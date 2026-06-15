'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Battery, Navigation, Users, Car } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  type: 'vehicle' | 'rider' | 'hub' | 'station';
  status?: 'active' | 'inactive' | 'charging' | 'available';
  label?: string;
  info?: string;
  battery?: number;
}

interface AdminMapProps {
  markers: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  onMarkerClick?: (marker: MapMarker) => void;
  showLegend?: boolean;
  height?: string;
}

export function AdminMap({
  markers,
  center = { lat: 28.6139, lng: 77.209 },
  zoom = 12,
  onMarkerClick,
  showLegend = true,
  height = '400px',
}: AdminMapProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(!apiKey);

  useEffect(() => {
    if (!apiKey) return;

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async`;
    script.async = true;
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);

    return () => {
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, []);

  const getMarkerIcon = (marker: MapMarker) => {
    const colors = {
      vehicle: '#0053C1',
      rider: '#10B981',
      hub: '#F59E0B',
      station: '#8B5CF6',
    };
    return colors[marker.type] || '#64748B';
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'charging':
        return 'bg-blue-500';
      case 'available':
        return 'bg-yellow-500';
      case 'inactive':
        return 'bg-gray-400';
      default:
        return 'bg-gray-400';
    }
  };

  const vehicleMarkers = markers.filter((m) => m.type === 'vehicle');
  const riderMarkers = markers.filter((m) => m.type === 'rider');
  const hubMarkers = markers.filter((m) => m.type === 'hub');
  const stationMarkers = markers.filter((m) => m.type === 'station');

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Live Map View
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Car className="h-3 w-3" />
              {vehicleMarkers.length}
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              {riderMarkers.length}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative bg-slate-100 dark:bg-slate-900" style={{ height }}>
          {!mapLoaded ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-muted-foreground">Loading map...</span>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Google Maps requires API key</p>
                <p className="text-xs opacity-70">Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</p>
              </div>
            </div>
          )}

          {mapLoaded && (
            <div className="absolute inset-0">
              {markers.map((marker) => (
                <div
                  key={marker.id}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                  style={{
                    left: `${(marker.lng - center.lng) / (zoom * 0.01) + 50}%`,
                    top: `${(center.lat - marker.lat) / (zoom * 0.01) + 50}%`,
                  }}
                  onClick={() => {
                    setSelectedMarker(marker);
                    onMarkerClick?.(marker);
                  }}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center shadow-lg',
                      'transition-transform hover:scale-110',
                      getStatusColor(marker.status)
                    )}
                    style={{ backgroundColor: getMarkerIcon(marker) }}
                  >
                    {marker.type === 'vehicle' && <Car className="h-4 w-4 text-white" />}
                    {marker.type === 'rider' && <Users className="h-4 w-4 text-white" />}
                    {marker.type === 'hub' && <MapPin className="h-4 w-4 text-white" />}
                    {marker.type === 'station' && <Battery className="h-4 w-4 text-white" />}
                  </div>
                  {marker.battery !== undefined && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-[8px] text-white font-bold">{marker.battery}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {selectedMarker && (
            <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-72 bg-background rounded-lg shadow-lg p-4 border">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{selectedMarker.label || selectedMarker.id}</div>
                  <div className="text-sm text-muted-foreground">{selectedMarker.info}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedMarker(null)}>
                  ×
                </Button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant={selectedMarker.status === 'active' ? 'default' : 'secondary'}>
                  {selectedMarker.status}
                </Badge>
                {selectedMarker.battery !== undefined && (
                  <div className="flex items-center gap-1 text-sm">
                    <Battery className="h-4 w-4" />
                    {selectedMarker.battery}%
                  </div>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Navigation className="h-3 w-3 mr-1" />
                  Track
                </Button>
                <Button size="sm" className="flex-1">
                  Details
                </Button>
              </div>
            </div>
          )}

          {showLegend && (
            <div className="absolute top-4 left-4 bg-background/90 backdrop-blur rounded-lg p-3 text-xs space-y-2">
              <div className="font-medium">Legend</div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#0053C1]" />
                <span>Vehicles</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#10B981]" />
                <span>Riders</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                <span>Hubs</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#8B5CF6]" />
                <span>Stations</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function MiniMap({ markers, height = '200px' }: { markers: MapMarker[]; height?: string }) {
  const getMarkerIcon = (marker: MapMarker) => {
    const colors = {
      vehicle: '#0053C1',
      rider: '#10B981',
      hub: '#F59E0B',
      station: '#8B5CF6',
    };
    return colors[marker.type] || '#64748B';
  };

  return (
    <div className="rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800" style={{ height }}>
      <div className="w-full h-full flex items-center justify-center relative">
        {markers.map((marker, index) => (
          <div
            key={marker.id}
            className="absolute transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${(index / markers.length) * 80 + 10}%`,
              top: `${(index % 3) * 30 + 20}%`,
            }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ backgroundColor: getMarkerIcon(marker) }}
            >
              {marker.type === 'vehicle' && <Car className="h-3 w-3 text-white" />}
              {marker.type === 'rider' && <Users className="h-3 w-3 text-white" />}
            </div>
          </div>
        ))}
        <div className="text-center text-muted-foreground text-xs">{markers.length} locations</div>
      </div>
    </div>
  );
}
