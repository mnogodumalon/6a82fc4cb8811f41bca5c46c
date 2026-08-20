/**
 * WebsiteDialog — pre-generated create/edit dialog for Website.
 *
 * Props: open, onClose, onSubmit(fields) => Promise<void>, defaultValues?,
 * recordId? (pass when EDITING — enables the attachments section),
 * enablePhotoScan?, enablePhotoLocation?.
 *
 * defaultValues is SHAPE-TOLERANT and its prop type is the EXPORTED
 * WebsiteDialogDefaults — NOT the entity field type: lookup fields accept
 * the bare KEY string (or LookupValue), applookup fields the bare record id
 * (or record URL); the dialog normalizes. Type prefill STATE with the export:
 *  ❌ useState<Partial<Website['fields']>>({ … })   // LookupValue fields reject string prefills (TS2322)
 *  ✓ useState<WebsiteDialogDefaults | undefined>(undefined)
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Website } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId, createRecordUrl, cleanFieldsForApi, uploadFile, getUserProfile } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ComputedContext } from '@/config/form-enhancements/types';
import { applyFieldOrder, flattenFieldOrder, applyDefaults, evalComputed, numberInputProps, clampNumberValue, classifyComputed, extractApplookupRefs, mergeApplookupRefs, resolveApplookupRef } from '@/config/form-enhancements/types';
import { formEnhancements, computedDeps, computedApplookupRefs } from '@/config/form-enhancements/Website';
import { AttachmentsSection } from '@/components/AttachmentsSection';
import { t, appLabel, fieldLabel, lookupLabel, localeTag, CURRENCY } from '@/i18n';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { IconAlertCircle, IconCamera, IconChevronDown, IconCircleCheck, IconClipboard, IconCrosshair, IconFileText, IconLoader2, IconPhotoPlus, IconSparkles, IconUpload, IconX } from '@tabler/icons-react';
import { fileToDataUri, extractFromInput, extractPhotoMeta, reverseGeocode, dataUriToBlob, reverseGeocodeDetailed, geocodeAddress } from '@/lib/ai';
import { GeoMapPicker } from '@/components/GeoMapPicker';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';

/** Widened prefill type for WebsiteDialog.defaultValues — see file header. */
export type WebsiteDialogDefaults = Website['fields'];

interface WebsiteDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (fields: Website['fields']) => Promise<void>;
  /** SHAPE-TOLERANT: lookup fields accept the bare key (string) or the
   *  LookupValue object; applookup fields the bare record id or the full
   *  record URL — the dialog normalizes both. */
  defaultValues?: WebsiteDialogDefaults;
  /** Record id when editing — enables the attachments section. Omit on create. */
  recordId?: string;
  enablePhotoScan?: boolean;
  enablePhotoLocation?: boolean;
}

export function WebsiteDialog({ open, onClose, onSubmit, defaultValues, recordId, enablePhotoScan = true, enablePhotoLocation = true }: WebsiteDialogProps) {
  const [fields, setFields] = useState<Partial<Website['fields']>>({});
  const [saving, setSaving] = useState(false);
  const normalizedDefaults = defaultValues as Record<string, unknown> | undefined;
  // Dirty-tracking: in edit-mode the Speichern button is disabled until the
  // user actually changes something. JSON.stringify is good enough for our
  // fields (plain values + LookupValue objects + string arrays).
  const isDirty = useMemo(() => {
    if (!normalizedDefaults) return true;  // create-mode: always allow submit
    try {
      return JSON.stringify(fields) !== JSON.stringify(normalizedDefaults);
    } catch {
      return true;
    }
  }, [fields, normalizedDefaults]);
  const [showErrors, setShowErrors] = useState(false);
  const REQUIRED_FIELDS = ['unternehmensname'] as const;
  const missingRequired = REQUIRED_FIELDS.filter(k => {
    const v = (fields as Record<string, unknown>)[k];
    return v == null || v === '' || (Array.isArray(v) && v.length === 0);
  });
  const [aiOpen, setAiOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [usePersonalInfo, setUsePersonalInfo] = useState(() => {
    try { return localStorage.getItem('ai-use-personal-info') === 'true'; } catch { return false; }
  });
  const [showProfileInfo, setShowProfileInfo] = useState(false);
  const [profileData, setProfileData] = useState<Record<string, unknown> | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [aiText, setAiText] = useState('');

  // Computed-field plumbing. Pure no-op when formEnhancements.computed is {}.
  // The number renderer uses computedValues only as a fallback when the user
  // hasn't typed anything — clearing the input always restores the computation.
  // computedContext exposes applookup list props so { kind: 'applookup', ... }
  // operands can resolve to numeric fields on the target record.
  const computedContext = useMemo<ComputedContext>(() => ({
    lookupLists: {
    },
  }), []);
  const computedValues = useMemo<Record<string, number | null>>(() => {
    let out: Record<string, number | null> = {};
    const entries = Object.entries(formEnhancements.computed);
    for (let i = 0; i < 5; i++) {
      const merged: Record<string, unknown> = { ...(fields as Record<string, unknown>) };
      for (const [k, v] of Object.entries(out)) {
        if (v === null) continue;
        const cur = merged[k];
        if (cur === undefined || cur === null || cur === '') merged[k] = v;
      }
      const next: Record<string, number | null> = {};
      let changed = false;
      for (const [key, spec] of entries) {
        const v = evalComputed(spec, merged, computedContext);
        next[key] = v;
        if (v !== out[key]) changed = true;
      }
      out = next;
      if (!changed) break;
    }
    return out;
  }, [fields, computedContext]);

  useEffect(() => {
    if (open) {
      setFields(applyDefaults(normalizedDefaults ?? {}, formEnhancements.defaults) as Partial<Website['fields']>);
      setPreview(null);
      setScanSuccess(false);
      setAiText('');
      setSubmitError(null);
      setGeoFromPhoto(false);
    }
  }, [open, normalizedDefaults]);
  useEffect(() => {
    try { localStorage.setItem('ai-use-personal-info', String(usePersonalInfo)); } catch {}
  }, [usePersonalInfo]);
  async function handleShowProfileInfo() {
    if (showProfileInfo) { setShowProfileInfo(false); return; }
    setProfileLoading(true);
    try {
      const p = await getUserProfile();
      setProfileData(p);
    } catch {
      setProfileData(null);
    } finally {
      setProfileLoading(false);
      setShowProfileInfo(true);
    }
  }

  // Submit errors surface IN the dialog (it is modal — a banner in the page
  // body would be hidden behind it). A consumer onSubmit that THROWS (the
  // documented "throw to prevent closing" validation pattern) lands here:
  // the dialog stays open, nothing is saved, the message is visible.
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (missingRequired.length > 0) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      // Fill empty number slots from computed values; user-typed values always win.
      // CRITICAL: only backend-mapped keys may be backfilled. Virtual computeds
      // (sub-agent invents `_netto`, `_bestellung_gesamtbetrag` etc. for the
      // "Berechnungen" display) have no backend counterpart — writing them
      // triggers a 422 from the Living-Apps API ("field does not exist").
      const merged = { ...fields };
      for (const [key, val] of Object.entries(computedValues)) {
        if (val === null) continue;
        if (!backendFieldSet.has(key)) continue;
        const cur = (merged as Record<string, unknown>)[key];
        if (cur === undefined || cur === null || cur === '') {
          (merged as Record<string, unknown>)[key] = val;
        }
      }
      const clean = cleanFieldsForApi(merged, 'website');
      await onSubmit(clean as Website['fields']);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error && err.message ? err.message : t('submit_error'));
    } finally {
      setSaving(false);
    }
  }

  const [locating, setLocating] = useState(false);
  const [showCoords, setShowCoords] = useState(false);
  const [geoFromPhoto, setGeoFromPhoto] = useState(false);
  const geoDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  // This entity has a real ADDRESS BLOCK (≥2 components), so a geo pick also
  // fills the separate address fields. The generator resolved which field is
  // which: {"road": "website_strasse", "houseNumber": "website_hausnummer", "postcode": "website_plz", "city": "website_ort"}. The marker is the source of truth, so a
  // move OVERWRITES these fields (info always; components when Nominatim returns them).
  const ADDRESS_FIELD_MAP: Record<string, string | undefined> = {"road": "website_strasse", "houseNumber": "website_hausnummer", "postcode": "website_plz", "city": "website_ort"};
  async function applyGeoAddress(fieldKey: string, lat: number, lng: number) {
    const addr = await reverseGeocodeDetailed(lat, lng);
    setFields(f => {
      const next: any = { ...f, [fieldKey]: { ...((f as any)[fieldKey] ?? {}), lat, long: lng, info: addr.display } };
      if (ADDRESS_FIELD_MAP.road && addr.road) next[ADDRESS_FIELD_MAP.road] = addr.road;
      if (ADDRESS_FIELD_MAP.houseNumber && addr.houseNumber) next[ADDRESS_FIELD_MAP.houseNumber] = addr.houseNumber;
      if (ADDRESS_FIELD_MAP.postcode && addr.postcode) next[ADDRESS_FIELD_MAP.postcode] = addr.postcode;
      if (ADDRESS_FIELD_MAP.city && addr.city) next[ADDRESS_FIELD_MAP.city] = addr.city;
      return next;
    });
  }

  // FORWARD direction (mirror of applyGeoAddress): typing the address fields
  // moves the geo point. The address-component inputs call onAddressFieldChange
  // (instead of plain setFields), which writes the field AND debounce-geocodes
  // the assembled address via Photon. The map below shows the result, draggable.
  const FORWARD_GEO_KEY = 'standort';
  const fwdGeoDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fwdGeoAbortRef = useRef<AbortController | null>(null);
  // The point a forward geocode just wrote — so the picker's programmatic
  // recenter (its moveend → handleMapMove) is recognised as an ECHO and does NOT
  // reverse-geocode back over the address the user is typing. A real drag differs.
  const suppressReverseEchoRef = useRef<{ lat: number; long: number } | null>(null);
  function buildAddrQuery(f: any): string {
    const v = (c?: string) => (c ? String((f as any)[c] ?? '').trim() : '');
    const road = v(ADDRESS_FIELD_MAP.road);
    const house = v(ADDRESS_FIELD_MAP.houseNumber);
    const postcode = v(ADDRESS_FIELD_MAP.postcode);
    const city = v(ADDRESS_FIELD_MAP.city);
    // Need ≥2 of the STRONG components (road/postcode/city) — a lone token would
    // resolve to the wrong place. A house number alone never qualifies.
    if ([road, postcode, city].filter(Boolean).length < 2) return '';
    const street = [road, house].filter(Boolean).join(' ');
    return [street, postcode, city].filter(Boolean).join(', ');
  }
  function scheduleForwardGeocode(q: string) {
    clearTimeout(fwdGeoDebounceRef.current);
    if (!q) return;
    fwdGeoDebounceRef.current = setTimeout(async () => {
      fwdGeoAbortRef.current?.abort();
      const ac = new AbortController();
      fwdGeoAbortRef.current = ac;
      const hit = await geocodeAddress(q, ac.signal);
      if (!hit) return;
      suppressReverseEchoRef.current = { lat: hit.lat, long: hit.long };
      setFields(f => ({ ...f, [FORWARD_GEO_KEY]: { ...((f as any)[FORWARD_GEO_KEY] ?? {}), lat: hit.lat, long: hit.long, info: hit.label } }));
    }, 600);
  }
  function onAddressFieldChange(key: string, value: string) {
    setFields(f => ({ ...f, [key]: value }));
    scheduleForwardGeocode(buildAddrQuery({ ...fields, [key]: value }));
  }
  async function geoLocate(fieldKey: string) {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      await applyGeoAddress(fieldKey, latitude, longitude);
      setGeoFromPhoto(false);
      setLocating(false);
    }, () => { setLocating(false); });
  }
  function handleMapMove(fieldKey: string, lat: number, lng: number) {
    setFields(f => ({ ...f, [fieldKey]: { ...((f as any)[fieldKey] ?? {}), lat, long: lng } }));
    // Skip the reverse round-trip when this move is the ECHO of a forward geocode
    // (the picker recentred itself) — otherwise it would overwrite the address the
    // user just typed. A genuine user DRAG lands away from the echoed point.
    const echo = suppressReverseEchoRef.current;
    if (echo && Math.abs(echo.lat - lat) < 2e-4 && Math.abs(echo.long - lng) < 2e-4) {
      suppressReverseEchoRef.current = null;
      return;
    }
    clearTimeout(geoDebounceRef.current);
    geoDebounceRef.current = setTimeout(async () => {
      await applyGeoAddress(fieldKey, lat, lng);
    }, 600);
  }

  async function handleAiExtract(file?: File) {
    if (!file && !aiText.trim()) return;
    setScanning(true);
    setScanSuccess(false);
    try {
      let uri: string | undefined;
      let gps: { latitude: number; longitude: number } | null = null;
      let geoAddr = '';
      const parts: string[] = [];
      if (file) {
        const [dataUri, meta] = await Promise.all([fileToDataUri(file), extractPhotoMeta(file)]);
        uri = dataUri;
        if (file.type.startsWith('image/')) setPreview(uri);
        gps = enablePhotoLocation ? meta?.gps ?? null : null;
        if (gps) {
          geoAddr = await reverseGeocode(gps.latitude, gps.longitude);
          parts.push(`Location coordinates: ${gps.latitude}, ${gps.longitude}`);
          if (geoAddr) parts.push(`Reverse-geocoded address: ${geoAddr}`);
        }
        if (meta?.dateTime) {
          parts.push(`Date taken: ${meta.dateTime.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')}`);
        }
      }
      const contextParts: string[] = [];
      if (parts.length) {
        contextParts.push(`<photo-metadata>\nThe following metadata was extracted from the photo\'s EXIF data:\n${parts.join('\n')}\n</photo-metadata>`);
      }
      if (usePersonalInfo) {
        try {
          const profile = await getUserProfile();
          contextParts.push(`<user-profile>\nThe following is the logged-in user\'s personal information. Use this to pre-fill relevant fields like name, email, address, company etc. when appropriate:\n${JSON.stringify(profile, null, 2)}\n</user-profile>`);
        } catch (err) {
          console.warn('Failed to fetch user profile:', err);
        }
      }
      const photoContext = contextParts.length ? contextParts.join('\n') : undefined;
      const schema = `{\n  "unternehmensname": string | null, // Unternehmensname\n  "slogan": string | null, // Slogan / Motto\n  "beschreibung": string | null, // Beschreibungstext (Über uns)\n  "leistungen": string | null, // Unsere Leistungen\n  "anzahl_plaetze": number | null, // Anzahl der Plätze\n  "oeffnungszeiten": string | null, // Öffnungszeiten\n  "website_telefon": string | null, // Telefonnummer (öffentlich)\n  "website_email": string | null, // E-Mail-Adresse (öffentlich)\n  "website_url": string | null, // Website-Adresse\n  "website_strasse": string | null, // Straße\n  "website_hausnummer": string | null, // Hausnummer\n  "website_plz": string | null, // Postleitzahl\n  "website_ort": string | null, // Ort\n  "instagram": string | null, // Instagram-Profil (URL)\n  "facebook": string | null, // Facebook-Seite (URL)\n}`;
      const raw = await extractFromInput<Record<string, unknown>>(schema, {
        dataUri: uri,
        userText: aiText.trim() || undefined,
        photoContext,
        intent: DIALOG_INTENT,
      });
      setFields(prev => {
        const merged = { ...prev } as Record<string, unknown>;
        function matchName(name: string, candidates: string[]): boolean {
          const n = name.toLowerCase().trim();
          return candidates.some(c => c.toLowerCase().includes(n) || n.includes(c.toLowerCase()));
        }
        for (const [k, v] of Object.entries(raw)) {
          if (v != null) merged[k] = v;
        }
        return merged as Partial<Website['fields']>;
      });
      // Upload scanned file to file fields
      if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
        try {
          const blob = dataUriToBlob(uri!);
          const fileUrl = await uploadFile(blob, file.name);
          setFields(prev => ({ ...prev, logo: fileUrl }));
          setFields(prev => ({ ...prev, titelbild: fileUrl }));
          setFields(prev => ({ ...prev, galerie_bilder: fileUrl }));
        } catch (uploadErr) {
          console.error('File upload failed:', uploadErr);
        }
      }
      if (gps) {
        setFields(f => ({ ...f, standort: { lat: gps.latitude, long: gps.longitude, info: geoAddr } as any }));
        setGeoFromPhoto(true);
      }
      setAiText('');
      setScanSuccess(true);
      setTimeout(() => setScanSuccess(false), 3000);
    } catch (err) {
      console.error(`${t('scan_error')}:`, err);
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleAiExtract(f);
    e.target.value = '';
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
      handleAiExtract(file);
    }
  }, []);

  const DIALOG_INTENT = defaultValues
    ? t('edit_entity', { entity: appLabel('website') })
    : t('new_entity', { entity: appLabel('website') });

  const fieldBlocks: Record<string, React.ReactNode> = {
    'unternehmensname': (
      <div key="unternehmensname" className="space-y-1.5">
        <Label htmlFor="unternehmensname">{fieldLabel('website', 'unternehmensname')} <span className="text-destructive" aria-hidden="true">*</span></Label>
        <Input
          id="unternehmensname"
          placeholder=""
          value={fields.unternehmensname ?? ''}
          onChange={e => setFields(f => ({ ...f, unternehmensname: e.target.value }))}
          required
        />
        {showErrors && !fields.unternehmensname && (
          <p className="text-xs text-destructive mt-1">{t('required_hint')}</p>
        )}
      </div>
    ),
    'slogan': (
      <div key="slogan" className="space-y-1.5">
        <Label htmlFor="slogan">{fieldLabel('website', 'slogan')}</Label>
        <Input
          id="slogan"
          placeholder=""
          value={fields.slogan ?? ''}
          onChange={e => setFields(f => ({ ...f, slogan: e.target.value }))}
        />
      </div>
    ),
    'beschreibung': (
      <div key="beschreibung" className="space-y-1.5">
        <Label htmlFor="beschreibung">{fieldLabel('website', 'beschreibung')}</Label>
        <Textarea
          id="beschreibung"
          placeholder=""
          value={fields.beschreibung ?? ''}
          onChange={e => setFields(f => ({ ...f, beschreibung: e.target.value }))}
          rows={3}
        />
      </div>
    ),
    'leistungen': (
      <div key="leistungen" className="space-y-1.5">
        <Label htmlFor="leistungen">{fieldLabel('website', 'leistungen')}</Label>
        <Textarea
          id="leistungen"
          placeholder=""
          value={fields.leistungen ?? ''}
          onChange={e => setFields(f => ({ ...f, leistungen: e.target.value }))}
          rows={3}
        />
      </div>
    ),
    'anzahl_plaetze': (
      <div key="anzahl_plaetze" className="space-y-1.5">
        <Label htmlFor="anzahl_plaetze">{fieldLabel('website', 'anzahl_plaetze')}</Label>
        <Input
          id="anzahl_plaetze"
          type="number"
          step="any"
          {...numberInputProps(formEnhancements, 'anzahl_plaetze')}
          placeholder=""
          value={fields.anzahl_plaetze !== undefined ? fields.anzahl_plaetze : (computedValues['anzahl_plaetze'] ?? '')}
          onChange={e => setFields(f => ({ ...f, anzahl_plaetze: clampNumberValue(formEnhancements, 'anzahl_plaetze', e.target.value) }))}
        />
      </div>
    ),
    'oeffnungszeiten': (
      <div key="oeffnungszeiten" className="space-y-1.5">
        <Label htmlFor="oeffnungszeiten">{fieldLabel('website', 'oeffnungszeiten')}</Label>
        <Textarea
          id="oeffnungszeiten"
          placeholder=""
          value={fields.oeffnungszeiten ?? ''}
          onChange={e => setFields(f => ({ ...f, oeffnungszeiten: e.target.value }))}
          rows={3}
        />
      </div>
    ),
    'website_telefon': (
      <div key="website_telefon" className="space-y-1.5">
        <Label htmlFor="website_telefon">{fieldLabel('website', 'website_telefon')}</Label>
        <Input
          id="website_telefon"
          value={fields.website_telefon ?? ''}
          onChange={e => setFields(f => ({ ...f, website_telefon: e.target.value }))}
        />
      </div>
    ),
    'website_email': (
      <div key="website_email" className="space-y-1.5">
        <Label htmlFor="website_email">{fieldLabel('website', 'website_email')}</Label>
        <Input
          id="website_email"
          type="email"
          placeholder=""
          value={fields.website_email ?? ''}
          onChange={e => setFields(f => ({ ...f, website_email: e.target.value }))}
        />
      </div>
    ),
    'website_url': (
      <div key="website_url" className="space-y-1.5">
        <Label htmlFor="website_url">{fieldLabel('website', 'website_url')}</Label>
        <Input
          id="website_url"
          value={fields.website_url ?? ''}
          onChange={e => setFields(f => ({ ...f, website_url: e.target.value }))}
        />
      </div>
    ),
    'website_strasse': (
      <div key="website_strasse" className="space-y-1.5">
        <Label htmlFor="website_strasse">{fieldLabel('website', 'website_strasse')}</Label>
        <Input
          id="website_strasse"
          placeholder=""
          value={fields.website_strasse ?? ''}
          onChange={e => onAddressFieldChange("website_strasse", e.target.value)}
        />
      </div>
    ),
    'website_hausnummer': (
      <div key="website_hausnummer" className="space-y-1.5">
        <Label htmlFor="website_hausnummer">{fieldLabel('website', 'website_hausnummer')}</Label>
        <Input
          id="website_hausnummer"
          placeholder=""
          value={fields.website_hausnummer ?? ''}
          onChange={e => onAddressFieldChange("website_hausnummer", e.target.value)}
        />
      </div>
    ),
    'website_plz': (
      <div key="website_plz" className="space-y-1.5">
        <Label htmlFor="website_plz">{fieldLabel('website', 'website_plz')}</Label>
        <Input
          id="website_plz"
          placeholder=""
          value={fields.website_plz ?? ''}
          onChange={e => onAddressFieldChange("website_plz", e.target.value)}
        />
      </div>
    ),
    'website_ort': (
      <div key="website_ort" className="space-y-1.5">
        <Label htmlFor="website_ort">{fieldLabel('website', 'website_ort')}</Label>
        <Input
          id="website_ort"
          placeholder=""
          value={fields.website_ort ?? ''}
          onChange={e => onAddressFieldChange("website_ort", e.target.value)}
        />
      </div>
    ),
    'standort': (
      <div key="standort" className="space-y-1.5">
        <Label htmlFor="standort">{fieldLabel('website', 'standort')}</Label>
        <div className="space-y-3">
          <Button type="button" variant="outline" className="w-full max-sm:h-11" disabled={locating} onClick={() => geoLocate("standort")}>
            {locating ? <IconLoader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <IconCrosshair className="h-4 w-4 mr-1.5" />}
            {t('fr_use_location')}
          </Button>
          <AddressAutocomplete
            placeholder={t('fr_search_address')}
            onSelect={r => setFields(f => ({ ...f, standort: { lat: r.lat, long: r.long, info: r.label } as any }))}
          />
          {geoFromPhoto && fields.standort && (
            <p className="text-xs text-primary italic">{t('fr_photo_location')}</p>
          )}
          {fields.standort?.info && (
            <p className="text-sm text-muted-foreground break-words whitespace-normal">
              {fields.standort.info}
            </p>
          )}
          {fields.standort?.lat != null && fields.standort?.long != null && (
            <GeoMapPicker
              lat={fields.standort.lat}
              lng={fields.standort.long}
              onChange={(lat, lng) => handleMapMove("standort", lat, lng)}
            />
          )}
          <button type="button" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 py-1 max-sm:py-2 transition-colors" onClick={() => setShowCoords(v => !v)}>
            {showCoords ? t('fr_hide_coords') : t('fr_show_coords')}
            <IconChevronDown className={`h-3 w-3 transition-transform ${showCoords ? "rotate-180" : ""}`} />
          </button>
          {showCoords && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs text-muted-foreground">{t('fr_lat')}</Label>
                <Input type="number" step="any"
                  value={fields.standort?.lat ?? ''}
                  onChange={e => {
                    const v = e.target.value;
                    setFields(f => ({ ...f, standort: { ...(f.standort as any ?? {}), lat: v ? Number(v) : undefined } }));
                  }}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t('fr_long')}</Label>
                <Input type="number" step="any"
                  value={fields.standort?.long ?? ''}
                  onChange={e => {
                    const v = e.target.value;
                    setFields(f => ({ ...f, standort: { ...(f.standort as any ?? {}), long: v ? Number(v) : undefined } }));
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    ),
    'logo': (
      <div key="logo" className="space-y-1.5">
        <Label htmlFor="logo">{fieldLabel('website', 'logo')}</Label>
        {fields.logo ? (
          <div className="flex items-center gap-3 rounded-lg border p-2">
            <div className="relative h-14 w-14 shrink-0 rounded-md bg-muted overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <IconFileText size={20} className="text-muted-foreground" />
              </div>
              <img
                src={fields.logo}
                alt=""
                className="relative h-full w-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate text-foreground">{fields.logo.split("/").pop()}</p>
              <div className="flex gap-2 mt-1">
                <label
                  className="text-xs text-primary hover:underline cursor-pointer"
                >
                  {t('fr_change')}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const fileUrl = await uploadFile(file, file.name);
                        setFields(f => ({ ...f, logo: fileUrl }));
                      } catch (err) { console.error('Upload failed:', err); }
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => setFields(f => ({ ...f, logo: undefined }))}
                >
                  {t('fr_remove')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <label
            className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
          >
            <IconUpload size={20} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t('fr_upload_file')}</span>
            <input
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const fileUrl = await uploadFile(file, file.name);
                  setFields(f => ({ ...f, logo: fileUrl }));
                } catch (err) { console.error('Upload failed:', err); }
              }}
            />
          </label>
        )}
      </div>
    ),
    'titelbild': (
      <div key="titelbild" className="space-y-1.5">
        <Label htmlFor="titelbild">{fieldLabel('website', 'titelbild')}</Label>
        {fields.titelbild ? (
          <div className="flex items-center gap-3 rounded-lg border p-2">
            <div className="relative h-14 w-14 shrink-0 rounded-md bg-muted overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <IconFileText size={20} className="text-muted-foreground" />
              </div>
              <img
                src={fields.titelbild}
                alt=""
                className="relative h-full w-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate text-foreground">{fields.titelbild.split("/").pop()}</p>
              <div className="flex gap-2 mt-1">
                <label
                  className="text-xs text-primary hover:underline cursor-pointer"
                >
                  {t('fr_change')}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const fileUrl = await uploadFile(file, file.name);
                        setFields(f => ({ ...f, titelbild: fileUrl }));
                      } catch (err) { console.error('Upload failed:', err); }
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => setFields(f => ({ ...f, titelbild: undefined }))}
                >
                  {t('fr_remove')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <label
            className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
          >
            <IconUpload size={20} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t('fr_upload_file')}</span>
            <input
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const fileUrl = await uploadFile(file, file.name);
                  setFields(f => ({ ...f, titelbild: fileUrl }));
                } catch (err) { console.error('Upload failed:', err); }
              }}
            />
          </label>
        )}
      </div>
    ),
    'galerie_bilder': (
      <div key="galerie_bilder" className="space-y-1.5">
        <Label htmlFor="galerie_bilder">{fieldLabel('website', 'galerie_bilder')}</Label>
        {fields.galerie_bilder ? (
          <div className="flex items-center gap-3 rounded-lg border p-2">
            <div className="relative h-14 w-14 shrink-0 rounded-md bg-muted overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <IconFileText size={20} className="text-muted-foreground" />
              </div>
              <img
                src={fields.galerie_bilder}
                alt=""
                className="relative h-full w-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate text-foreground">{fields.galerie_bilder.split("/").pop()}</p>
              <div className="flex gap-2 mt-1">
                <label
                  className="text-xs text-primary hover:underline cursor-pointer"
                >
                  {t('fr_change')}
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const fileUrl = await uploadFile(file, file.name);
                        setFields(f => ({ ...f, galerie_bilder: fileUrl }));
                      } catch (err) { console.error('Upload failed:', err); }
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => setFields(f => ({ ...f, galerie_bilder: undefined }))}
                >
                  {t('fr_remove')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <label
            className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
          >
            <IconUpload size={20} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t('fr_upload_file')}</span>
            <input
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const fileUrl = await uploadFile(file, file.name);
                  setFields(f => ({ ...f, galerie_bilder: fileUrl }));
                } catch (err) { console.error('Upload failed:', err); }
              }}
            />
          </label>
        )}
      </div>
    ),
    'instagram': (
      <div key="instagram" className="space-y-1.5">
        <Label htmlFor="instagram">{fieldLabel('website', 'instagram')}</Label>
        <Input
          id="instagram"
          value={fields.instagram ?? ''}
          onChange={e => setFields(f => ({ ...f, instagram: e.target.value }))}
        />
      </div>
    ),
    'facebook': (
      <div key="facebook" className="space-y-1.5">
        <Label htmlFor="facebook">{fieldLabel('website', 'facebook')}</Label>
        <Input
          id="facebook"
          value={fields.facebook ?? ''}
          onChange={e => setFields(f => ({ ...f, facebook: e.target.value }))}
        />
      </div>
    ),
  };
  const orderedFields = applyFieldOrder(Object.keys(fieldBlocks), formEnhancements.fieldOrder);
  const orderedFieldsKey = orderedFields.map((it) => typeof it === 'string' ? it : it.row.join('+')).join(',');

  // Render-Modell für Computed-Felder:
  //
  //   • BACKEND-FELDER mit computed-Eintrag (z.B. gesamtpreis bei einer
  //     Katzenpension) bleiben als normales Eingabe-Feld stehen. Der Number-
  //     Input nutzt den computed-Wert als Vorschlag, der User kann jederzeit
  //     überschreiben (clearing → restore computed).
  //   • VIRTUELLE computed-Keys (Eintrag in formEnhancements.computed, ABER
  //     kein passendes Backend-Feld in orderedFields) erscheinen NICHT als
  //     Input, sondern unten als kompakte 'Berechnungen'-Übersicht oder als
  //     Inline-Hint unter dem letzten beitragenden Input.
  const FIELD_LABELS: Record<string, string> = {"unternehmensname": "Unternehmensname", "slogan": "Slogan / Motto", "beschreibung": "Beschreibungstext (Über uns)", "leistungen": "Unsere Leistungen", "anzahl_plaetze": "Anzahl der Plätze", "oeffnungszeiten": "Öffnungszeiten", "website_telefon": "Telefonnummer (öffentlich)", "website_email": "E-Mail-Adresse (öffentlich)", "website_url": "Website-Adresse", "website_strasse": "Straße", "website_hausnummer": "Hausnummer", "website_plz": "Postleitzahl", "website_ort": "Ort", "standort": "Standort auf der Karte", "logo": "Logo", "titelbild": "Titelbild / Headerbild", "galerie_bilder": "Galeriebilder", "instagram": "Instagram-Profil (URL)", "facebook": "Facebook-Seite (URL)"};
  const CURRENCY_KEYS = new Set<string>([]);
  // Applookup-Referenz-Labels: pro applookup-Feld in dieser Form (ownKey)
  // eine Map { lookupKey: label } für ALLE Felder des Target-Schemas. Wird
  // beim Render-Walk gefiltert auf die in der computed-Formel tatsächlich
  // referenzierten lookupKeys (siehe applookupRefs unten).
  const APPLOOKUP_LABELS: Record<string, Record<string, string>> = {};
  const inputFields = useMemo(() => flattenFieldOrder(orderedFields), [orderedFieldsKey]);
  const backendFieldSet = useMemo(() => new Set(inputFields), [inputFields.join(',')]);
  const virtualComputed = useMemo(
    () => Object.fromEntries(
      Object.entries(formEnhancements.computed).filter(([k]) => !backendFieldSet.has(k)),
    ),
    [backendFieldSet],
  );
  const virtualFormEnhancements = useMemo(
    () => ({ ...formEnhancements, computed: virtualComputed }),
    [virtualComputed],
  );
  const computedLayout = useMemo(
    () => classifyComputed(virtualFormEnhancements, inputFields, computedDeps),
    [virtualFormEnhancements, inputFields.join(',')],
  );
  // Applookup-Referenzen: pro ownKey (Lookup-Feld im Form) die Liste der
  // lookupKeys, die in irgendeiner computed-Formel referenziert werden.
  // MODUS-1: aus dem Spec-Tree extrahiert. MODUS-2: aus dem Build-Time-
  // Export computedApplookupRefs (parse-formulas hat Regex-Pairs gesammelt).
  // Pro (ownKey, lookupKey)-Paar nur einmal; pro ownKey können aber mehrere
  // lookupKeys gleichzeitig auftauchen (z.B. einzelpreis UND karten10_preis
  // beim Yoga-Kurs), und alle werden separat als Inline-Hint gerendert.
  const applookupRefs = useMemo(
    () => mergeApplookupRefs(
      extractApplookupRefs(formEnhancements.computed),
      computedApplookupRefs,
    ),
    [],
  );
  function summaryLabel(k: string): string {
    if (FIELD_LABELS[k]) return FIELD_LABELS[k];
    // Leading underscore(s) als Virtual-Marker abstreifen; Unterstriche zu
    // Leerzeichen, jedes Wort kapitalisieren. Umlaute kommen vom Sub-Agent
    // direkt im Key (z. B. `_buchung_dauer_nächte`) — JS/TS/Vite unterstützen
    // Unicode-Identifier nativ, daher keine ASCII-Transliteration nötig.
    return k.replace(/^_+/, '')
      .split('_')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  function formatSummaryValue(k: string, v: unknown): string {
    if (v === undefined || v === null || v === '' || (typeof v === 'number' && !Number.isFinite(v))) return '—';
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n)) return String(v);
    // Backend-Feld mit €-Label ODER virtueller Computed-Key, dessen Name nach Geld aussieht.
    const looksLikeCurrency = CURRENCY_KEYS.has(k) || /(?:kosten|preis|betrag|gesamt|netto|brutto|summe|mwst|rabatt|anzahlung|umsatz|saldo)/i.test(k);
    if (looksLikeCurrency) {
      return n.toLocaleString(localeTag(), { style: 'currency', currency: CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return n.toLocaleString(localeTag(), { maximumFractionDigits: 2 });
  }

  return (
    <>
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] flex flex-col overflow-hidden p-0 gap-0 max-sm:[&>button]:size-10 max-sm:[&>button]:grid max-sm:[&>button]:place-items-center max-sm:[&>button]:rounded-full max-sm:[&>button]:border max-sm:[&>button]:border-input max-sm:[&>button]:bg-background max-sm:[&>button]:opacity-100 max-sm:[&>button>svg]:size-5">
        <DialogHeader className="px-6 pt-5 pb-3 border-b flex flex-row items-center gap-3 space-y-0">
          <DialogTitle className="flex-1 truncate text-left">{DIALOG_INTENT}</DialogTitle>
          {enablePhotoScan && (
            <button
              type="button"
              onClick={() => setAiOpen(o => !o)}
              aria-expanded={aiOpen}
              aria-controls="ai-fill-panel"
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 max-sm:py-2.5 max-sm:px-4 text-xs font-semibold transition-all mr-7 max-sm:mr-12 shadow-sm ${
                aiOpen
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                  : 'bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15 hover:border-primary/50'
              }`}
            >
              <IconSparkles className={`h-3.5 w-3.5 ${aiOpen ? '' : 'text-primary'}`} />
              <span className="hidden sm:inline">{t('smart_fill')}</span>
              <IconChevronDown className={`h-3 w-3 transition-transform ${aiOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </DialogHeader>
        {enablePhotoScan && aiOpen && (
          <div id="ai-fill-panel" className="border-b bg-muted/20 px-6 py-4 space-y-3">
            <p className="text-xs text-muted-foreground">{t('scan_header_sub')}</p>
            <div className="flex items-start gap-2 pl-0.5">
              <Checkbox
                id="ai-use-personal-info"
                checked={usePersonalInfo}
                onCheckedChange={(v) => setUsePersonalInfo(!!v)}
                className="mt-0.5"
              />
              <span className="text-xs text-muted-foreground leading-snug">
                <Label htmlFor="ai-use-personal-info" className="text-xs font-normal text-muted-foreground cursor-pointer inline">
                  {t('useinfo_label')}
                </Label>
                {' '}
                <button type="button" onClick={handleShowProfileInfo} className="text-xs text-primary hover:underline whitespace-nowrap">
                  {profileLoading ? t('useinfo_loading') : `(${t('useinfo_more')})`}
                </button>
              </span>
            </div>
            {showProfileInfo && (
              <div className="rounded-md border bg-muted/50 p-2 text-xs max-h-40 overflow-y-auto">
                <p className="font-medium mb-1">{t('profile_preamble')}</p>
                {profileData ? Object.values(profileData).map((v, i) => (
                  <span key={i}>{i > 0 && ", "}{typeof v === "object" ? JSON.stringify(v) : String(v)}</span>
                )) : (
                  <span className="text-muted-foreground">{t('useinfo_error')}</span>
                )}
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileSelect} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !scanning && fileInputRef.current?.click()}
              className={`
                relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer
                ${scanning
                  ? 'border-primary/40 bg-primary/5'
                  : scanSuccess
                    ? 'border-green-500/40 bg-green-50/50 dark:bg-green-950/20'
                    : dragOver
                      ? 'border-primary bg-primary/10 scale-[1.01]'
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                }
              `}
            >
              {scanning ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <IconLoader2 className="h-7 w-7 text-primary animate-spin" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">{t('scan_analyzing')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('scan_analyzing_sub')}</p>
                  </div>
                </div>
              ) : scanSuccess ? (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <IconCircleCheck className="h-7 w-7 text-green-600 dark:text-green-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">{t('scan_success')}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t('scan_success_sub')}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <div className="h-14 w-14 rounded-full bg-primary/8 flex items-center justify-center">
                    <IconPhotoPlus className="h-7 w-7 text-primary/70" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">{t('scan_upload')}</p>
                  </div>
                </div>
              )}

              {preview && !scanning && (
                <div className="absolute top-2 right-2">
                  <div className="relative group">
                    <img src={preview} alt="" className="h-10 w-10 rounded-md object-cover border shadow-sm" />
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setPreview(null); }}
                      className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-muted-foreground/80 text-white flex items-center justify-center"
                    >
                      <IconX className="h-2.5 w-2.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); cameraInputRef.current?.click(); }}>
                <IconCamera className="h-3.5 w-3.5 mr-1" />{t('scan_camera_btn')}
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <IconUpload className="h-3.5 w-3.5 mr-1" />{t('scan_file_btn')}
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-10 text-xs" disabled={scanning}
                onClick={e => {
                  e.stopPropagation();
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'application/pdf,.pdf';
                    fileInputRef.current.click();
                    setTimeout(() => { if (fileInputRef.current) fileInputRef.current.accept = 'image/*,application/pdf'; }, 100);
                  }
                }}>
                <IconFileText className="h-3.5 w-3.5 mr-1" />{t('scan_doc_btn')}
              </Button>
            </div>

            <div className="relative">
              <Textarea
                placeholder={t('scan_text_placeholder')}
                value={aiText}
                onChange={e => {
                  setAiText(e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = Math.min(Math.max(el.scrollHeight, 56), 96) + 'px';
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && aiText.trim() && !scanning) {
                    e.preventDefault();
                    handleAiExtract();
                  }
                }}
                disabled={scanning}
                rows={2}
                className="pr-12 resize-none text-sm overflow-y-auto"
              />
              <button
                type="button"
                className="absolute right-2 top-2 h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                disabled={scanning}
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) setAiText(prev => prev ? prev + '\n' + text : text);
                  } catch {}
                }}
                title={t('paste')}
              >
                <IconClipboard className="h-4 w-4" />
              </button>
            </div>
            {aiText.trim() && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-9 text-xs"
                disabled={scanning}
                onClick={() => handleAiExtract()}
              >
                <IconSparkles className="h-3.5 w-3.5 mr-1.5" />{t('scan_text_analyze')}
              </Button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col min-h-0 min-w-0 max-sm:[&_input]:h-11">
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4 space-y-4 min-w-0">
            {(() => {
              const renderField = (k: string) => {
                const inlineHints = computedLayout.anchors[k] ?? [];
                const refs = applookupRefs[k] ?? [];
                return (
                  <div key={k} className="space-y-1.5 min-w-0">
                    {fieldBlocks[k]}
                    {refs.map(({ lookupKey }) => {
                      // Show the live numeric value the formula will pull from
                      // the selected lookup target (e.g. "Monatspreis: 34,90 €"
                      // under the Tarif combobox). Hidden while no lookup is
                      // selected or the target field is non-numeric.
                      const v = resolveApplookupRef(k, lookupKey, fields as Record<string, unknown>, computedContext);
                      if (v === null) return null;
                      const lbl = APPLOOKUP_LABELS[k]?.[lookupKey] ?? lookupKey;
                      const text = formatSummaryValue(lookupKey, v);
                      return (
                        <div key={`alh-${k}-${lookupKey}`} className="flex items-center gap-1.5 pl-3 text-xs text-muted-foreground">
                          <span className="text-primary/70">→</span>
                          <span>{lbl}</span>
                          <span className="ml-auto font-medium tabular-nums text-foreground">{text}</span>
                        </div>
                      );
                    })}
                    {inlineHints.map((cKey) => {
                      const v = computedValues[cKey];
                      const text = formatSummaryValue(cKey, v);
                      if (text === '—') return null;
                      return (
                        <div key={cKey} className="flex items-center gap-1.5 pl-3 text-xs text-muted-foreground">
                          <span className="text-primary/70">→</span>
                          <span>{summaryLabel(cKey)}</span>
                          <span className="ml-auto font-medium tabular-nums text-foreground">{text}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              };
              return orderedFields.map((item, idx) => {
                if (typeof item === 'string') return renderField(item);
                const cols = item.cols ?? `repeat(${item.row.length}, minmax(0, 1fr))`;
                return (
                  <div key={`row-${idx}`} className="grid gap-3" style={{ gridTemplateColumns: cols }}>
                    {item.row.map(renderField)}
                  </div>
                );
              });
            })()}
            {(computedLayout.aggregates.length > 0 || computedLayout.finalTotal) && (
              <div className="mt-6 pt-4 border-t border-border space-y-1.5">
                {computedLayout.aggregates.length > 0 && (
                  <dl className="space-y-1.5 pb-2">
                    {computedLayout.aggregates.map((k) => {
                      const userVal = (fields as Record<string, unknown>)[k];
                      const computed = computedValues[k];
                      const v = userVal !== undefined && userVal !== null && userVal !== '' ? userVal : computed;
                      return (
                        <div key={k} className="flex justify-between items-baseline gap-3">
                          <dt className="text-sm text-muted-foreground truncate">{summaryLabel(k)}</dt>
                          <dd className="text-sm font-medium tabular-nums whitespace-nowrap">{formatSummaryValue(k, v)}</dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
                {computedLayout.finalTotal && (() => {
                  const k = computedLayout.finalTotal;
                  const userVal = (fields as Record<string, unknown>)[k];
                  const computed = computedValues[k];
                  const v = userVal !== undefined && userVal !== null && userVal !== '' ? userVal : computed;
                  // Innere Border nur wenn aggregates existieren — sonst hätten wir
                  // zwei direkt aufeinanderfolgende Striche (Outer + Inner) mit nur
                  // einer Aggregat-Zeile dazwischen → zu viel visuelles Rauschen.
                  const sep = computedLayout.aggregates.length > 0 ? 'pt-3 border-t border-border' : 'pt-1';
                  return (
                    <div className={`flex justify-between items-baseline gap-3 ${sep}`}>
                      <span className="text-base font-semibold text-foreground">{summaryLabel(k)}</span>
                      <span className="text-lg font-bold tabular-nums whitespace-nowrap text-foreground">{formatSummaryValue(k, v)}</span>
                    </div>
                  );
                })()}
              </div>
            )}
            {showErrors && missingRequired.length > 0 && (
              <p className="text-xs text-destructive flex items-center gap-1.5" role="alert">
                <IconAlertCircle className="h-3.5 w-3.5 shrink-0" />
                {t('missing_required')}
              </p>
            )}
            {recordId && (
              <div className="pt-2 border-t border-border">
                <AttachmentsSection appId={APP_IDS.WEBSITE} recordId={recordId} />
              </div>
            )}
          </div>
          {submitError && (
            <div className="flex items-start gap-2 border-t border-destructive/20 bg-destructive/10 px-6 py-2.5 text-sm text-destructive" role="alert">
              <IconAlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">{submitError}</span>
            </div>
          )}
          <DialogFooter className="sticky bottom-0 border-t bg-background/95 backdrop-blur px-6 py-3 gap-2 max-sm:flex-row">
            <Button type="button" variant="outline" onClick={onClose} className="max-sm:h-12 max-sm:flex-1 max-sm:text-base">{t('cancel')}</Button>
            <Button
              type="submit"
              className="max-sm:h-12 max-sm:flex-1 max-sm:text-base"
              disabled={saving || !isDirty || (showErrors && missingRequired.length > 0)}
            >
              {saving ? t('saving') : defaultValues ? t('save') : t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}