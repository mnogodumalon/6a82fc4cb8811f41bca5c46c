/**
 * Neue Aufenthalts-Buchung — 3-Schritt-Wizard.
 * Steps: 1) Besitzer wählen oder neu erstellen → 2) Hund wählen oder neu erstellen
 *        → 3) Zeitraum & Platz festlegen → Buchung anlegen.
 * Reads: besitzer, hunde. Writes: besitzer (createBesitzerEntry),
 *        hunde (createHundeEntry), buchungen (createBuchungenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { tx } from '@/i18n';
import { IconDog, IconUser, IconCalendar, IconCheck } from '@tabler/icons-react';
import { differenceInDays } from 'date-fns';

const PLATZ_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];
const GESCHLECHT_OPTIONS = LOOKUP_OPTIONS['hunde']?.['geschlecht'] ?? [];

export default function NeueBuchungPage() {
  const { besitzer, hunde, loading, error, fetchAll } = useDashboardData();

  // Wizard state
  const [step, setStep] = useState(1);
  const [selectedBesitzerId, setSelectedBesitzerId] = useState<string | null>(null);
  const [selectedHundId, setSelectedHundId] = useState<string | null>(null);

  // Step 1 — Besitzer mini-form
  const [showBesitzerCreate, setShowBesitzerCreate] = useState(false);
  const [bVorname, setBVorname] = useState('');
  const [bNachname, setBNachname] = useState('');
  const [bTelefon, setBTelefon] = useState('');
  const [bEmail, setBEmail] = useState('');
  const [bCreating, setBCreating] = useState(false);
  const [bError, setBError] = useState('');

  // Step 2 — Hund mini-form
  const [showHundCreate, setShowHundCreate] = useState(false);
  const [hName, setHName] = useState('');
  const [hRasse, setHRasse] = useState('');
  const [hGeschlecht, setHGeschlecht] = useState('none');
  const [hGewicht, setHGewicht] = useState('');
  const [hCreating, setHCreating] = useState(false);
  const [hError, setHError] = useState('');

  // Step 3 — Buchung fields
  const [anreise, setAnreise] = useState('');
  const [abreise, setAbreise] = useState('');
  const [platzKey, setPlatzKey] = useState('none');
  const [preisGesamt, setPreisGesamt] = useState('');
  const [interneNotizen, setInterneNotizen] = useState('');
  const [buchungCreating, setBuchungCreating] = useState(false);
  const [buchungError, setBuchungError] = useState('');
  const [buchungDone, setBuchungDone] = useState(false);

  // Derived: nights count
  const nächte =
    anreise && abreise
      ? Math.max(0, differenceInDays(new Date(abreise), new Date(anreise)))
      : 0;

  // Filtered hunde for step 2
  const hundeDesBesitzers = hunde.filter(
    (h) => extractRecordId(h.fields.besitzer) === selectedBesitzerId
  );

  // Step 1: create Besitzer
  const handleBesitzerCreate = async () => {
    if (!bVorname.trim() || !bNachname.trim()) return;
    setBCreating(true);
    setBError('');
    try {
      const result = await LivingAppsService.createBesitzerEntry({
        vorname: bVorname.trim(),
        nachname: bNachname.trim(),
        telefon: bTelefon.trim() || undefined,
        email: bEmail.trim() || undefined,
      });
      await fetchAll();
      setShowBesitzerCreate(false);
      setBVorname('');
      setBNachname('');
      setBTelefon('');
      setBEmail('');
      setSelectedBesitzerId(result.record_id);
      setStep(2);
    } catch {
      setBError(tx('Fehler beim Anlegen. Bitte erneut versuchen.'));
    } finally {
      setBCreating(false);
    }
  };

  // Step 2: create Hund
  const handleHundCreate = async () => {
    if (!hName.trim() || !selectedBesitzerId) return;
    setHCreating(true);
    setHError('');
    try {
      const result = await LivingAppsService.createHundeEntry({
        name: hName.trim(),
        rasse: hRasse.trim() || undefined,
        geschlecht: hGeschlecht !== 'none' ? hGeschlecht : undefined,
        gewicht_kg: hGewicht ? parseFloat(hGewicht) : undefined,
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
      });
      await fetchAll();
      setShowHundCreate(false);
      setHName('');
      setHRasse('');
      setHGeschlecht('none');
      setHGewicht('');
      setSelectedHundId(result.record_id);
      setStep(3);
    } catch {
      setHError(tx('Fehler beim Anlegen. Bitte erneut versuchen.'));
    } finally {
      setHCreating(false);
    }
  };

  // Step 3: create Buchung
  const handleBuchungCreate = async () => {
    if (!selectedBesitzerId || !selectedHundId || !anreise || !abreise || platzKey === 'none') return;
    setBuchungCreating(true);
    setBuchungError('');
    try {
      await LivingAppsService.createBuchungenEntry({
        hund: createRecordUrl(APP_IDS.HUNDE, selectedHundId),
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
        anreise,
        abreise,
        platz: platzKey,
        status: 'geplant',
        zahlungsstatus: 'offen',
        preis_gesamt: preisGesamt ? parseFloat(preisGesamt) : undefined,
        interne_notizen: interneNotizen.trim() || undefined,
      });
      setBuchungDone(true);
    } catch {
      setBuchungError(tx('Fehler beim Anlegen der Buchung. Bitte erneut versuchen.'));
    } finally {
      setBuchungCreating(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedBesitzerId(null);
    setSelectedHundId(null);
    setShowBesitzerCreate(false);
    setBVorname(''); setBNachname(''); setBTelefon(''); setBEmail(''); setBError('');
    setShowHundCreate(false);
    setHName(''); setHRasse(''); setHGeschlecht('none'); setHGewicht(''); setHError('');
    setAnreise(''); setAbreise(''); setPlatzKey('none'); setPreisGesamt('');
    setInterneNotizen(''); setBuchungError(''); setBuchungDone(false);
  };

  // Lookup helpers (inside body — locale-aware)
  const selectedBesitzer = besitzer.find((b) => b.record_id === selectedBesitzerId);
  const selectedHund = hunde.find((h) => h.record_id === selectedHundId);

  return (
    <IntentWizardShell
      title={tx('Neue Buchung')}
      subtitle={tx('Aufenthalt in 3 Schritten anlegen')}
      steps={[
        { label: tx('Besitzer') },
        { label: tx('Hund') },
        { label: tx('Zeitraum & Platz') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Step 1: Besitzer wählen ─────────────────────────────────────── */}
      {step === 1 && (
        <EntitySelectStep
          items={besitzer.map((b) => ({
            id: b.record_id,
            title: [b.fields.vorname, b.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannter Besitzer'),
            subtitle: [b.fields.telefon, b.fields.email].filter(Boolean).join(' · ') || undefined,
            icon: <IconUser size={20} className="text-primary" />,
          }))}
          onSelect={(id) => {
            setSelectedBesitzerId(id);
            setSelectedHundId(null);
            setStep(2);
          }}
          searchPlaceholder={tx('Besitzer suchen …')}
          createLabel={tx('Neuen Besitzer anlegen')}
          onCreateNew={() => setShowBesitzerCreate(true)}
          emptyText={tx('Noch keine Besitzer vorhanden')}
          emptyIcon={<IconUser size={40} className="text-muted-foreground" />}
          createDialog={
            showBesitzerCreate ? (
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <p className="text-sm font-medium text-foreground">{tx('Neuen Besitzer anlegen')}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="b-vorname" className="text-xs text-muted-foreground">
                      {tx('Vorname')} *
                    </Label>
                    <Input
                      id="b-vorname"
                      value={bVorname}
                      onChange={(e) => setBVorname(e.target.value)}
                      placeholder={tx('Maria')}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="b-nachname" className="text-xs text-muted-foreground">
                      {tx('Nachname')} *
                    </Label>
                    <Input
                      id="b-nachname"
                      value={bNachname}
                      onChange={(e) => setBNachname(e.target.value)}
                      placeholder={tx('Müller')}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="b-telefon" className="text-xs text-muted-foreground">
                    {tx('Telefon')}
                  </Label>
                  <Input
                    id="b-telefon"
                    type="tel"
                    value={bTelefon}
                    onChange={(e) => setBTelefon(e.target.value)}
                    placeholder="0151 23456789"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="b-email" className="text-xs text-muted-foreground">
                    {tx('E-Mail')}
                  </Label>
                  <Input
                    id="b-email"
                    type="email"
                    value={bEmail}
                    onChange={(e) => setBEmail(e.target.value)}
                    placeholder={tx('maria@example.de')}
                  />
                </div>
                {bError && <p className="text-xs text-destructive">{bError}</p>}
                <div className="flex gap-2">
                  <Button
                    disabled={!bVorname.trim() || !bNachname.trim() || bCreating}
                    onClick={handleBesitzerCreate}
                    className="flex-1"
                  >
                    {bCreating ? tx('Wird angelegt …') : tx('Anlegen & weiter')}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setShowBesitzerCreate(false); setBError(''); }}
                  >
                    {tx('Abbrechen')}
                  </Button>
                </div>
              </div>
            ) : null
          }
        />
      )}

      {/* ── Step 2: Hund wählen ────────────────────────────────────────── */}
      {step === 2 && (
        selectedBesitzerId ? (
          <div className="space-y-4">
            {selectedBesitzer && (
              <div className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2 text-sm">
                <IconUser size={16} className="shrink-0 text-muted-foreground" />
                <span className="text-muted-foreground">{tx('Besitzer:')}</span>
                <span className="font-medium">
                  {[selectedBesitzer.fields.vorname, selectedBesitzer.fields.nachname].filter(Boolean).join(' ')}
                </span>
              </div>
            )}
            <EntitySelectStep
              items={hundeDesBesitzers.map((h) => ({
                id: h.record_id,
                title: h.fields.name ?? tx('Unbekannter Hund'),
                subtitle: h.fields.rasse || undefined,
                icon: <IconDog size={20} className="text-primary" />,
              }))}
              onSelect={(id) => {
                setSelectedHundId(id);
                setStep(3);
              }}
              searchPlaceholder={tx('Hund suchen …')}
              createLabel={tx('Neuen Hund anlegen')}
              onCreateNew={() => setShowHundCreate(true)}
              emptyText={
                hundeDesBesitzers.length === 0
                  ? tx('Noch kein Hund für diesen Besitzer — bitte anlegen.')
                  : tx('Kein Hund gefunden')
              }
              emptyIcon={<IconDog size={40} className="text-muted-foreground" />}
              createDialog={
                showHundCreate ? (
                  <div className="rounded-2xl border bg-card p-5 space-y-4">
                    <p className="text-sm font-medium text-foreground">{tx('Neuen Hund anlegen')}</p>
                    <div className="space-y-1">
                      <Label htmlFor="h-name" className="text-xs text-muted-foreground">
                        {tx('Name')} *
                      </Label>
                      <Input
                        id="h-name"
                        value={hName}
                        onChange={(e) => setHName(e.target.value)}
                        placeholder={tx('Bello')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="h-rasse" className="text-xs text-muted-foreground">
                        {tx('Rasse')}
                      </Label>
                      <Input
                        id="h-rasse"
                        value={hRasse}
                        onChange={(e) => setHRasse(e.target.value)}
                        placeholder={tx('Labrador')}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{tx('Geschlecht')}</Label>
                        <Select value={hGeschlecht} onValueChange={setHGeschlecht}>
                          <SelectTrigger>
                            <SelectValue placeholder={tx('Wählen …')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">{tx('Nicht angegeben')}</SelectItem>
                            {GESCHLECHT_OPTIONS.map((o) => (
                              <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="h-gewicht" className="text-xs text-muted-foreground">
                          {tx('Gewicht (kg)')}
                        </Label>
                        <Input
                          id="h-gewicht"
                          type="number"
                          min="0"
                          step="0.1"
                          value={hGewicht}
                          onChange={(e) => setHGewicht(e.target.value)}
                          placeholder="15"
                        />
                      </div>
                    </div>
                    {hError && <p className="text-xs text-destructive">{hError}</p>}
                    <div className="flex gap-2">
                      <Button
                        disabled={!hName.trim() || hCreating}
                        onClick={handleHundCreate}
                        className="flex-1"
                      >
                        {hCreating ? tx('Wird angelegt …') : tx('Anlegen & weiter')}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => { setShowHundCreate(false); setHError(''); }}
                      >
                        {tx('Abbrechen')}
                      </Button>
                    </div>
                  </div>
                ) : null
              }
            />
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              {tx('Neu starten')}
            </Button>
          </div>
        )
      )}

      {/* ── Step 3: Zeitraum & Platz ───────────────────────────────────── */}
      {step === 3 && (
        selectedBesitzerId && selectedHundId ? (
          buchungDone ? (
            /* Success state */
            <div className="flex flex-col items-center gap-6 py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <IconCheck size={32} className="text-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold">{tx('Buchung angelegt!')}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedHund?.fields.name
                    ? tx`${selectedHund.fields.name} ist erfolgreich eingeplant.`
                    : tx('Der Aufenthalt wurde erfolgreich gespeichert.')}
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-xs">
                <Button onClick={handleReset}>{tx('Neue Buchung anlegen')}</Button>
                <a href="#/" className="w-full">
                  <Button variant="outline" className="w-full">{tx('Zurück zum Dashboard')}</Button>
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Context strip */}
              <div className="flex flex-wrap gap-2">
                {selectedBesitzer && (
                  <div className="flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-1.5 text-sm">
                    <IconUser size={14} className="shrink-0 text-muted-foreground" />
                    <span className="font-medium">
                      {[selectedBesitzer.fields.vorname, selectedBesitzer.fields.nachname].filter(Boolean).join(' ')}
                    </span>
                  </div>
                )}
                {selectedHund && (
                  <div className="flex items-center gap-1.5 rounded-xl bg-secondary px-3 py-1.5 text-sm">
                    <IconDog size={14} className="shrink-0 text-muted-foreground" />
                    <span className="font-medium">{selectedHund.fields.name}</span>
                    {selectedHund.fields.rasse && (
                      <span className="text-muted-foreground">· {selectedHund.fields.rasse}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border bg-card p-5 space-y-5">
                {/* Date range */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="anreise" className="text-xs text-muted-foreground">
                      {tx('Anreise')} *
                    </Label>
                    <div className="relative">
                      <IconCalendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0 pointer-events-none" />
                      <Input
                        id="anreise"
                        type="date"
                        value={anreise}
                        onChange={(e) => setAnreise(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="abreise" className="text-xs text-muted-foreground">
                      {tx('Abreise')} *
                    </Label>
                    <div className="relative">
                      <IconCalendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0 pointer-events-none" />
                      <Input
                        id="abreise"
                        type="date"
                        value={abreise}
                        onChange={(e) => setAbreise(e.target.value)}
                        min={anreise || undefined}
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>

                {/* Night count badge */}
                {nächte > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {tx`${nächte} Nacht${nächte === 1 ? '' : 'nächte'}`}
                    {/* i18n-exempt: plural suffix handled inline */}
                  </p>
                )}

                {/* Platz */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{tx('Platz')} *</Label>
                  <Select value={platzKey} onValueChange={setPlatzKey}>
                    <SelectTrigger>
                      <SelectValue placeholder={tx('Platz wählen …')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tx('Bitte wählen')}</SelectItem>
                      {PLATZ_OPTIONS.map((o) => (
                        <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Preis */}
                <div className="space-y-1">
                  <Label htmlFor="preis" className="text-xs text-muted-foreground">
                    {tx('Gesamtpreis (€)')}
                  </Label>
                  <Input
                    id="preis"
                    type="number"
                    min="0"
                    step="0.01"
                    value={preisGesamt}
                    onChange={(e) => setPreisGesamt(e.target.value)}
                    placeholder="0.00"
                  />
                </div>

                {/* Interne Notizen */}
                <div className="space-y-1">
                  <Label htmlFor="notizen" className="text-xs text-muted-foreground">
                    {tx('Interne Notizen')}
                  </Label>
                  <Textarea
                    id="notizen"
                    value={interneNotizen}
                    onChange={(e) => setInterneNotizen(e.target.value)}
                    placeholder={tx('Besonderheiten, Hinweise …')}
                    rows={3}
                  />
                </div>

                {buchungError && (
                  <p className="text-xs text-destructive">{buchungError}</p>
                )}

                <Button
                  className="w-full"
                  disabled={!anreise || !abreise || platzKey === 'none' || buchungCreating}
                  onClick={handleBuchungCreate}
                >
                  {buchungCreating ? tx('Buchung wird angelegt …') : tx('Buchung anlegen')}
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Auswahl aus Schritt 1 und 2.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              {tx('Neu starten')}
            </Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
