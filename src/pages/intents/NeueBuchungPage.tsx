/**
 * Neue Buchung — 3-Schritt-Wizard für Hundepension-Buchungen.
 * Steps: 1) Besitzer wählen oder neu erstellen →
 *        2) Hund des Besitzers wählen oder neu erstellen →
 *        3) Zeitraum & Platz festlegen → Buchung anlegen.
 * Reads: besitzer, hunde. Writes: besitzer (createBesitzerEntry),
 *        hunde (createHundeEntry), buchungen (createBuchungenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { tx } from '@/i18n';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { useDashboardData } from '@/hooks/useDashboardData';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconUser, IconDog, IconCalendar, IconCheck, IconPlus } from '@tabler/icons-react';
import { differenceInDays } from 'date-fns';

const PLATZ_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];
const GESCHLECHT_OPTIONS = LOOKUP_OPTIONS['hunde']?.['geschlecht'] ?? [];
const IMPFSTATUS_OPTIONS = LOOKUP_OPTIONS['hunde']?.['impfstatus'] ?? [];

export default function NeueBuchungPage() {
  const { besitzer, hunde, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);

  // Step 1 — Besitzer
  const [selectedBesitzerId, setSelectedBesitzerId] = useState<string | null>(null);
  const [showBesitzerCreate, setShowBesitzerCreate] = useState(false);
  const [bVorname, setBVorname] = useState('');
  const [bNachname, setBNachname] = useState('');
  const [bTelefon, setBTelefon] = useState('');
  const [bEmail, setBEmail] = useState('');
  const [bCreating, setBCreating] = useState(false);

  // Step 2 — Hund
  const [selectedHundId, setSelectedHundId] = useState<string | null>(null);
  const [showHundCreate, setShowHundCreate] = useState(false);
  const [hName, setHName] = useState('');
  const [hRasse, setHRasse] = useState('');
  const [hGeschlecht, setHGeschlecht] = useState('none');
  const [hGewicht, setHGewicht] = useState('');
  const [hKastriert, setHKastriert] = useState(false);
  const [hImpfstatus, setHImpfstatus] = useState('none');
  const [hCreating, setHCreating] = useState(false);

  // Step 3 — Buchungsdetails
  const [anreise, setAnreise] = useState('');
  const [abreise, setAbreise] = useState('');
  const [platz, setPlatz] = useState('none');
  const [preisGesamt, setPreisGesamt] = useState('');
  const [interneNotizen, setInterneNotizen] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedBuchungId, setSavedBuchungId] = useState<string | null>(null);

  // ——— Step 1: Besitzer anlegen ———
  const handleCreateBesitzer = async () => {
    if (!bVorname.trim() || !bNachname.trim()) return;
    setBCreating(true);
    try {
      const result = await LivingAppsService.createBesitzerEntry({
        vorname: bVorname.trim(),
        nachname: bNachname.trim(),
        telefon: bTelefon.trim() || undefined,
        email: bEmail.trim() || undefined,
      });
      await fetchAll();
      setShowBesitzerCreate(false);
      setBVorname(''); setBNachname(''); setBTelefon(''); setBEmail('');
      setSelectedBesitzerId(result.record_id);
      setStep(2);
    } finally {
      setBCreating(false);
    }
  };

  // ——— Step 2: Hund anlegen ———
  const handleCreateHund = async () => {
    if (!hName.trim() || !selectedBesitzerId) return;
    setHCreating(true);
    try {
      const result = await LivingAppsService.createHundeEntry({
        name: hName.trim(),
        rasse: hRasse.trim() || undefined,
        geschlecht: hGeschlecht !== 'none' ? hGeschlecht : undefined,
        gewicht_kg: hGewicht ? parseFloat(hGewicht) : undefined,
        kastriert: hKastriert,
        impfstatus: hImpfstatus !== 'none' ? hImpfstatus : undefined,
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
      });
      await fetchAll();
      setShowHundCreate(false);
      setHName(''); setHRasse(''); setHGeschlecht('none');
      setHGewicht(''); setHKastriert(false); setHImpfstatus('none');
      setSelectedHundId(result.record_id);
      setStep(3);
    } finally {
      setHCreating(false);
    }
  };

  // ——— Step 3: Buchung anlegen ———
  const handleSaveBuchung = async () => {
    if (!selectedBesitzerId || !selectedHundId || !anreise || !abreise || platz === 'none') return;

    // Idempotency guard — don't create twice on retry
    if (savedBuchungId) {
      window.location.hash = '/';
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const result = await LivingAppsService.createBuchungenEntry({
        hund: createRecordUrl(APP_IDS.HUNDE, selectedHundId),
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
        anreise,
        abreise,
        platz,
        status: 'geplant',
        zahlungsstatus: 'offen',
        preis_gesamt: preisGesamt ? parseFloat(preisGesamt) : undefined,
        interne_notizen: interneNotizen.trim() || undefined,
      });
      setSavedBuchungId(result.record_id);
    } catch {
      setSaveError(tx('Die Buchung konnte nicht gespeichert werden. Bitte erneut versuchen.'));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedBesitzerId(null);
    setSelectedHundId(null);
    setAnreise(''); setAbreise(''); setPlatz('none');
    setPreisGesamt(''); setInterneNotizen('');
    setSavedBuchungId(null); setSaveError(null);
    setShowBesitzerCreate(false); setShowHundCreate(false);
  };

  // Derived values
  const selectedBesitzer = besitzer.find(b => b.record_id === selectedBesitzerId);
  const hundeDesBesitzers = hunde.filter(h =>
    selectedBesitzerId && extractRecordId(h.fields.besitzer) === selectedBesitzerId
  );
  const selectedHund = hunde.find(h => h.record_id === selectedHundId);

  const nachteCount = anreise && abreise
    ? Math.max(0, differenceInDays(new Date(abreise), new Date(anreise)))
    : 0;

  const canSave = !!selectedBesitzerId && !!selectedHundId && !!anreise && !!abreise && platz !== 'none' && !saving;

  // ——— SUCCESS STATE ———
  if (savedBuchungId) {
    return (
      <IntentWizardShell
        title={tx('Neue Buchung')}
        subtitle={tx('Hundepension-Buchung anlegen')}
        steps={[
          { label: tx('Besitzer') },
          { label: tx('Hund') },
          { label: tx('Zeitraum & Platz') },
        ]}
        currentStep={3}
        onStepChange={setStep}
        loading={loading}
        error={error}
        onRetry={fetchAll}
      >
        <div className="flex flex-col items-center justify-center py-16 space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <IconCheck size={32} className="text-emerald-600" stroke={2} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">{tx('Buchung erfolgreich angelegt!')}</h2>
            <p className="text-sm text-muted-foreground">
              {selectedHund?.fields.name ?? tx('Der Hund')}
              {' '}{tx('wurde für')} {nachteCount} {nachteCount === 1 ? tx('Nacht') : tx('Nächte')} {tx('gebucht.')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleReset} variant="outline">
              <IconPlus size={16} className="shrink-0 mr-2" />
              {tx('Neue Buchung anlegen')}
            </Button>
            <Button asChild>
              <a href="#/">{tx('Zurück zum Dashboard')}</a>
            </Button>
          </div>
        </div>
      </IntentWizardShell>
    );
  }

  return (
    <IntentWizardShell
      title={tx('Neue Buchung')}
      subtitle={tx('Hundepension-Buchung anlegen')}
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
      {/* ——— STEP 1: BESITZER WÄHLEN ——— */}
      {step === 1 && (
        <EntitySelectStep
          items={besitzer.map(b => ({
            id: b.record_id,
            title: [b.fields.vorname, b.fields.nachname].filter(Boolean).join(' ') || tx('Unbenannt'),
            subtitle: b.fields.telefon ?? b.fields.email ?? undefined,
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
          emptyText={tx('Kein Besitzer gefunden')}
          createDialog={showBesitzerCreate && (
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <h3 className="font-semibold text-foreground">{tx('Neuen Besitzer anlegen')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="b-vorname">{tx('Vorname')} *</Label>
                  <Input
                    id="b-vorname"
                    value={bVorname}
                    onChange={e => setBVorname(e.target.value)}
                    placeholder={tx('Vorname')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="b-nachname">{tx('Nachname')} *</Label>
                  <Input
                    id="b-nachname"
                    value={bNachname}
                    onChange={e => setBNachname(e.target.value)}
                    placeholder={tx('Nachname')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="b-telefon">{tx('Telefon')}</Label>
                  <Input
                    id="b-telefon"
                    type="tel"
                    value={bTelefon}
                    onChange={e => setBTelefon(e.target.value)}
                    placeholder={tx('z. B. 0170 1234567')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="b-email">{tx('E-Mail')}</Label>
                  <Input
                    id="b-email"
                    type="email"
                    value={bEmail}
                    onChange={e => setBEmail(e.target.value)}
                    placeholder={tx('name@beispiel.de')}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowBesitzerCreate(false)}>
                  {tx('Abbrechen')}
                </Button>
                <Button
                  disabled={!bVorname.trim() || !bNachname.trim() || bCreating}
                  onClick={handleCreateBesitzer}
                >
                  {bCreating ? tx('Wird angelegt …') : tx('Anlegen & weiter')}
                </Button>
              </div>
            </div>
          )}
        />
      )}

      {/* ——— STEP 2: HUND WÄHLEN ——— */}
      {step === 2 && (
        selectedBesitzerId ? (
          <div className="space-y-4">
            {/* Context chip */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconUser size={14} className="shrink-0" />
              <span>
                {tx('Besitzer:')} <span className="font-medium text-foreground">
                  {[selectedBesitzer?.fields.vorname, selectedBesitzer?.fields.nachname].filter(Boolean).join(' ')}
                </span>
              </span>
              <button
                className="ml-auto text-xs underline text-primary"
                onClick={() => setStep(1)}
              >
                {tx('Ändern')}
              </button>
            </div>

            <EntitySelectStep
              items={hundeDesBesitzers.map(h => ({
                id: h.record_id,
                title: h.fields.name ?? tx('Unbenannt'),
                subtitle: h.fields.rasse ?? undefined,
                icon: <IconDog size={20} className="text-primary" />,
              }))}
              onSelect={(id) => {
                setSelectedHundId(id);
                setStep(3);
              }}
              searchPlaceholder={tx('Hund suchen …')}
              createLabel={tx('Neuen Hund anlegen')}
              onCreateNew={() => setShowHundCreate(true)}
              emptyText={hundeDesBesitzers.length === 0
                ? tx('Noch kein Hund für diesen Besitzer — bitte anlegen')
                : tx('Kein Hund gefunden')}
              createDialog={showHundCreate && (
                <div className="rounded-2xl border bg-card p-5 space-y-4">
                  <h3 className="font-semibold text-foreground">{tx('Neuen Hund anlegen')}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="h-name">{tx('Name')} *</Label>
                      <Input
                        id="h-name"
                        value={hName}
                        onChange={e => setHName(e.target.value)}
                        placeholder={tx('Hundename')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="h-rasse">{tx('Rasse')}</Label>
                      <Input
                        id="h-rasse"
                        value={hRasse}
                        onChange={e => setHRasse(e.target.value)}
                        placeholder={tx('z. B. Labrador')}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>{tx('Geschlecht')}</Label>
                      <Select value={hGeschlecht} onValueChange={setHGeschlecht}>
                        <SelectTrigger>
                          <SelectValue placeholder={tx('Bitte wählen')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{tx('Keine Angabe')}</SelectItem>
                          {GESCHLECHT_OPTIONS.map(o => (
                            <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="h-gewicht">{tx('Gewicht (kg)')}</Label>
                      <Input
                        id="h-gewicht"
                        type="number"
                        min="0"
                        step="0.1"
                        value={hGewicht}
                        onChange={e => setHGewicht(e.target.value)}
                        placeholder={tx('z. B. 12.5')}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>{tx('Impfstatus')}</Label>
                      <Select value={hImpfstatus} onValueChange={setHImpfstatus}>
                        <SelectTrigger>
                          <SelectValue placeholder={tx('Bitte wählen')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{tx('Keine Angabe')}</SelectItem>
                          {IMPFSTATUS_OPTIONS.map(o => (
                            <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 flex flex-col justify-end">
                      <label className="flex items-center gap-2 cursor-pointer py-2">
                        <input
                          type="checkbox"
                          checked={hKastriert}
                          onChange={e => setHKastriert(e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span className="text-sm font-medium">{tx('Kastriert')}</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <Button variant="outline" onClick={() => setShowHundCreate(false)}>
                      {tx('Abbrechen')}
                    </Button>
                    <Button
                      disabled={!hName.trim() || hCreating}
                      onClick={handleCreateHund}
                    >
                      {hCreating ? tx('Wird angelegt …') : tx('Anlegen & weiter')}
                    </Button>
                  </div>
                </div>
              )}
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

      {/* ——— STEP 3: BUCHUNGSDETAILS ——— */}
      {step === 3 && (
        selectedBesitzerId && selectedHundId ? (
          <div className="space-y-6 max-w-lg mx-auto">
            {/* Context chips */}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <IconUser size={14} className="shrink-0" />
                <span className="font-medium text-foreground">
                  {[selectedBesitzer?.fields.vorname, selectedBesitzer?.fields.nachname].filter(Boolean).join(' ')}
                </span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <IconDog size={14} className="shrink-0" />
                <span className="font-medium text-foreground">
                  {selectedHund?.fields.name ?? '—'}
                </span>
              </span>
              <button
                className="ml-auto text-xs underline text-primary"
                onClick={() => setStep(2)}
              >
                {tx('Ändern')}
              </button>
            </div>

            {/* Zeitraum */}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <IconCalendar size={18} className="text-primary shrink-0" />
                {tx('Zeitraum')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="anreise">{tx('Anreise')} *</Label>
                  <Input
                    id="anreise"
                    type="date"
                    value={anreise}
                    onChange={e => {
                      setAnreise(e.target.value);
                      if (abreise && e.target.value >= abreise) setAbreise('');
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="abreise">{tx('Abreise')} *</Label>
                  <Input
                    id="abreise"
                    type="date"
                    value={abreise}
                    min={anreise || undefined}
                    onChange={e => setAbreise(e.target.value)}
                  />
                </div>
              </div>
              {nachteCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {nachteCount} {nachteCount === 1 ? tx('Nacht') : tx('Nächte')}
                </p>
              )}
            </div>

            {/* Platz */}
            <div className="rounded-2xl border bg-card p-5 space-y-3">
              <Label className="font-semibold text-foreground">{tx('Platz')} *</Label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {PLATZ_OPTIONS.map(o => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setPlatz(o.key)}
                    className={[
                      'rounded-xl border py-3 px-2 text-sm font-medium transition-colors',
                      platz === o.key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground border-border hover:bg-secondary',
                    ].join(' ')}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preis & Notizen */}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <h3 className="font-semibold text-foreground">{tx('Weitere Angaben')}</h3>
              <div className="space-y-1">
                <Label htmlFor="preis">{tx('Gesamtpreis (€)')}</Label>
                <Input
                  id="preis"
                  type="number"
                  min="0"
                  step="0.01"
                  value={preisGesamt}
                  onChange={e => setPreisGesamt(e.target.value)}
                  placeholder={tx('z. B. 280.00')}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="notizen">{tx('Interne Notizen')}</Label>
                <textarea
                  id="notizen"
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  value={interneNotizen}
                  onChange={e => setInterneNotizen(e.target.value)}
                  placeholder={tx('z. B. Hund mag keine lauten Geräusche')}
                />
              </div>
            </div>

            {saveError && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}

            <div className="flex flex-wrap gap-3 justify-end">
              <Button variant="outline" onClick={() => setStep(2)}>
                {tx('Zurück')}
              </Button>
              <Button
                disabled={!canSave}
                onClick={handleSaveBuchung}
              >
                {saving ? tx('Buchung wird angelegt …') : tx('Buchung anlegen')}
              </Button>
            </div>
          </div>
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
