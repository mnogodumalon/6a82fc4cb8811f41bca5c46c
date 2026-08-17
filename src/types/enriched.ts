import type { Buchungen, Hunde, PfotenPortraets } from './app';

export type EnrichedHunde = Hunde & {
  besitzerName: string;
};

export type EnrichedBuchungen = Buchungen & {
  hundName: string;
  besitzerName: string;
};

export type EnrichedPfotenPortraets = PfotenPortraets & {
  hundName: string;
  besitzerName: string;
  buchungName: string;
};
