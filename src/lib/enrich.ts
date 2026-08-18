import type { EnrichedBuchungen, EnrichedHunde, EnrichedPfotenPortraets } from '@/types/enriched';
import type { Besitzer, Buchungen, Hunde, PfotenPortraets } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface HundeMaps {
  besitzerMap: Map<string, Besitzer>;
}

export function enrichHunde(
  hunde: Hunde[],
  maps: HundeMaps
): EnrichedHunde[] {
  return hunde.map(r => ({
    ...r,
    besitzerName: resolveDisplay(r.fields.besitzer, maps.besitzerMap, 'vorname', 'nachname'),
  }));
}

interface BuchungenMaps {
  hundeMap: Map<string, Hunde>;
  besitzerMap: Map<string, Besitzer>;
}

export function enrichBuchungen(
  buchungen: Buchungen[],
  maps: BuchungenMaps
): EnrichedBuchungen[] {
  return buchungen.map(r => ({
    ...r,
    hundName: resolveDisplay(r.fields.hund, maps.hundeMap, 'name'),
    besitzerName: resolveDisplay(r.fields.besitzer, maps.besitzerMap, 'vorname', 'nachname'),
  }));
}

interface PfotenPortraetsMaps {
  hundeMap: Map<string, Hunde>;
  besitzerMap: Map<string, Besitzer>;
  buchungenMap: Map<string, Buchungen>;
}

export function enrichPfotenPortraets(
  pfotenPortraets: PfotenPortraets[],
  maps: PfotenPortraetsMaps
): EnrichedPfotenPortraets[] {
  return pfotenPortraets.map(r => ({
    ...r,
    hundName: resolveDisplay(r.fields.hund, maps.hundeMap, 'name'),
    besitzerName: resolveDisplay(r.fields.besitzer, maps.besitzerMap, 'vorname', 'nachname'),
    buchungName: resolveDisplay(r.fields.buchung, maps.buchungenMap, 'interne_notizen'),
  }));
}
