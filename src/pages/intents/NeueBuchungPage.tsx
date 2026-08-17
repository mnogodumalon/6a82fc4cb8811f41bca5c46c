/**
 * Neue Buchung — 3-Schritt-Wizard.
 * Steps: 1) Besitzer wählen/anlegen → 2) Hund wählen/anlegen → 3) Zeitraum & Platz bestätigen.
 * Reads: besitzer, hunde. Writes: besitzer (createBesitzerEntry), hunde (createHundeEntry),
 *        buchungen (createBuchungenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { tx } from '@/i18n';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { IconDog, IconUser, IconCalendar, IconCheck } from '@tabler/icons-react';
import { differenceInDays } from 'date-fns';

const PLATZ_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];
const GESCHLECHT_OPTIONS = LOOKUP_OPTIONS['hunde']?.['geschlecht'] ?? [];

export default function NeueBuchungPage() {
  const { besitzer, hunde, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);

  // Step 1 — Besitzer
  const [selectedBesitzerId, setSelectedBesitzerId] = useState<string | null>(null);
  const [showCreateBesitzer, setShowCreateBesitzer] = useState(false);
  const [bVorname, setBVorname] = useState('');
  const [bNachname, setBNachname] = useState('');
  const [bTelefon, setBTelefon] = useState('');
  const [bEmail, setBEmail] = useState('');
  const [bCreating, setBCreating] = useState(false);

  // Step 2 — Hund
  const [selectedHundId, setSelectedHundId] = useState<string | null>(null);
  const [showCreateHund, setShowCreateHund] = useState(false);
  const [hName, setHName] = useState('');
  const [hRasse, setHRasse] = useState('');
  const [hGeschlecht, setHGeschlecht] = useState('none');
  const [hGewicht, setHGewicht] = useState('');
  const [hCreating, setHCreating] = useState(false);

  // Step 3 — Buchung
  const [anreise, setAnreise] = useState('');
  const [abreise, setAbreise] = useState('');
  const [platz, setPlatz] = useState('none');
  const [preisGesamt, setPreisGesamt] = useState('');
  const [interneNotizen, setInterneNotizen] = useState('');
  const [buchungCreating, setBuchungCreating] = useState(false);
  const [buchungError, setBuchungError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Derived
  const hundeDesBesitzers = hunde.filter(
    h => extractRecordId(h.fields.besitzer) === selectedBesitzerId
  );

  const selectedBesitzer = besitzer.find(b => b.record_id === selectedBesitzerId);
  const selectedHund = hunde.find(h => h.record_id === selectedHundId);

  const nachteCount =
    anreise && abreise ? differenceInDays(new Date(abreise), new Date(anreise)) : 0;

  // Step 1: Besitzer anlegen
  const handleCreateBesitzer = async () => {
    if (!bVorname.trim() || !bNachname.trim()) return;
    setBCreating(true);
    try {
      const created = await LivingAppsService.createBesitzerEntry({
        vorname: bVorname.trim(),
        nachname: bNachname.trim(),
        telefon: bTelefon.trim() || undefined,
        email: bEmail.trim() || undefined,
      });
      await fetchAll();
      setShowCreateBesitzer(false);
      setBVorname('');
      setBNachname('');
      setBTelefon('');
      setBEmail('');
      setSelectedBesitzerId(created.record_id);
      setStep(2);
    } finally {
      setBCreating(false);
    }
  };

  // Step 2: Hund anlegen
  const handleCreateHund = async () => {
    if (!hName.trim() || !selectedBesitzerId) return;
    setHCreating(true);
    try {
      const created = await LivingAppsService.createHundeEntry({
        name: hName.trim(),
        rasse: hRasse.trim() || undefined,
        geschlecht: hGeschlecht !== 'none' ? hGeschlecht : undefined,
        gewicht_kg: hGewicht ? parseFloat(hGewicht) : undefined,
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
      });
      await fetchAll();
      setShowCreateHund(false);
      setHName('');
      setHRasse('');
      setHGeschlecht('none');
      setHGewicht('');
      setSelectedHundId(created.record_id);
      setStep(3);
    } finally {
      setHCreating(false);
    }
  };

  // Step 3: Buchung anlegen
  const handleCreateBuchung = async () => {
    if (!selectedBesitzerId || !selectedHundId || !anreise || !abreise || platz === 'none') return;
    setBuchungCreating(true);
    setBuchungError(null);
    try {
      await LivingAppsService.createBuchungenEntry({
        hund: createRecordUrl(APP_IDS.HUNDE, selectedHundId),
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
        anreise,
        abreise,
        platz: platz,
        status: 'geplant',
        preis_gesamt: preisGesamt ? parseFloat(preisGesamt) : undefined,
        interne_notizen: interneNotizen.trim() || undefined,
      });
      await fetchAll();
      setSuccess(true);
    } catch {
      setBuchungError(tx('Buchung konnte nicht gespeichert werden. Bitte erneut versuchen.'));
    } finally {
      setBuchungCreating(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedBesitzerId(null);
    setSelectedHundId(null);
    setShowCreateBesitzer(false);
    setShowCreateHund(false);
    setAnreise('');
    setAbreise('');
    setPlatz('none');
    setPreisGesamt('');
    setInterneNotizen('');
    setBuchungError(null);
    setSuccess(false);
  };

  if (success) {
    return (
      <IntentWizardShell
        title={tx('Neue Buchung')}
        subtitle={tx('Buchung wurde erfolgreich angelegt')}
        steps={[
          { label: tx('Besitzer') },
          { label: tx('Hund') },
          { label: tx('Zeitraum') },
        ]}
        currentStep={3}
        onStepChange={setStep}
        loading={loading}
        error={error}
        onRetry={fetchAll}
      >
        <div className="flex flex-col items-center py-16 space-y-6 text-center">
          <div className="rounded-full bg-emerald-100 p-5">
            <IconCheck size={48} className="text-emerald-600" stroke={1.5} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">{tx('Buchung angelegt!')}</h2>
            <p className="text-sm text-muted-foreground">
              {selectedBesitzer
                ? tx`${selectedBesitzer.fields.vorname ?? ''} ${selectedBesitzer.fields.nachname ?? ''} — ${selectedHund?.fields.name ?? ''}`
                : tx('Die Buchung wurde erfolgreich gespeichert.')}
            </p>
            {anreise && abreise && (
              <p className="text-sm text-muted-foreground">
                {anreise} {tx('bis')} {abreise}
                {nachteCount > 0 && (
                  <> · {tx`${nachteCount} Nächte`}</>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button onClick={handleReset} variant="outline">
              {tx('Neue Buchung anlegen')}
            </Button>
            <a href="#/">
              <Button>{tx('Zurück zum Dashboard')}</Button>
            </a>
          </div>
        </div>
      </IntentWizardShell>
    );
  }

  return (
    <IntentWizardShell
      title={tx('Neue Buchung')}
      subtitle={tx('In 3 Schritten zur fertigen Buchung')}
      steps={[
        { label: tx('Besitzer') },
        { label: tx('Hund') },
        { label: tx('Zeitraum') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1 — Besitzer wählen */}
      {step === 1 && (
        <EntitySelectStep
          items={besitzer.map(b => ({
            id: b.record_id,
            title: [b.fields.vorname, b.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt'),
            subtitle: [b.fields.telefon, b.fields.email].filter(Boolean).join(' · '),
            icon: <IconUser size={20} className="text-primary" />,
          }))}
          onSelect={(id) => {
            setSelectedBesitzerId(id);
            setSelectedHundId(null);
            setStep(2);
          }}
          searchPlaceholder={tx('Besitzer suchen …')}
          createLabel={tx('Neuen Besitzer anlegen')}
          onCreateNew={() => setShowCreateBesitzer(true)}
          emptyText={tx('Noch keine Besitzer vorhanden')}
          emptyIcon={<IconUser size={32} className="text-muted-foreground" />}
          createDialog={showCreateBesitzer && (
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">{tx('Neuen Besitzer anlegen')}</p>
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
                    placeholder={tx('Telefonnummer')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="b-email">{tx('E-Mail')}</Label>
                  <Input
                    id="b-email"
                    type="email"
                    value={bEmail}
                    onChange={e => setBEmail(e.target.value)}
                    placeholder={tx('E-Mail-Adresse')}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  disabled={!bVorname.trim() || !bNachname.trim() || bCreating}
                  onClick={handleCreateBesitzer}
                >
                  {bCreating ? tx('Wird angelegt …') : tx('Anlegen & weiter')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateBesitzer(false)}
                  disabled={bCreating}
                >
                  {tx('Abbrechen')}
                </Button>
              </div>
            </div>
          )}
        />
      )}

      {/* Step 2 — Hund wählen */}
      {step === 2 && (
        selectedBesitzerId ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground pb-1">
              <IconUser size={16} className="shrink-0" />
              <span>
                {tx('Besitzer')}: <strong className="text-foreground">
                  {[selectedBesitzer?.fields.vorname, selectedBesitzer?.fields.nachname].filter(Boolean).join(' ')}
                </strong>
              </span>
            </div>
            <EntitySelectStep
              items={hundeDesBesitzers.map(h => ({
                id: h.record_id,
                title: h.fields.name ?? tx('Unbekannt'),
                subtitle: [
                  h.fields.rasse,
                  h.fields.geschlecht?.label,
                  h.fields.gewicht_kg ? `${h.fields.gewicht_kg} kg` : undefined,
                ].filter(Boolean).join(' · '),
                icon: <IconDog size={20} className="text-primary" />,
              }))}
              onSelect={(id) => {
                setSelectedHundId(id);
                setStep(3);
              }}
              searchPlaceholder={tx('Hund suchen …')}
              createLabel={tx('Neuen Hund anlegen')}
              onCreateNew={() => setShowCreateHund(true)}
              emptyText={
                hundeDesBesitzers.length === 0
                  ? tx('Noch kein Hund für diesen Besitzer eingetragen')
                  : tx('Kein Hund gefunden')
              }
              emptyIcon={<IconDog size={32} className="text-muted-foreground" />}
              createDialog={showCreateHund && (
                <div className="rounded-2xl border bg-card p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">{tx('Neuen Hund anlegen')}</p>
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
                      <Label htmlFor="h-geschlecht">{tx('Geschlecht')}</Label>
                      <Select value={hGeschlecht} onValueChange={setHGeschlecht}>
                        <SelectTrigger id="h-geschlecht">
                          <SelectValue placeholder={tx('Bitte wählen')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{tx('Nicht angegeben')}</SelectItem>
                          {GESCHLECHT_OPTIONS.map(opt => (
                            <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
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
                  <div className="flex gap-2 pt-1">
                    <Button
                      disabled={!hName.trim() || hCreating}
                      onClick={handleCreateHund}
                    >
                      {hCreating ? tx('Wird angelegt …') : tx('Anlegen & weiter')}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowCreateHund(false)}
                      disabled={hCreating}
                    >
                      {tx('Abbrechen')}
                    </Button>
                  </div>
                </div>
              )}
            />
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => { setStep(1); setSelectedBesitzerId(null); }}
            >
              {tx('← Anderen Besitzer wählen')}
            </Button>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">{tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}</p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}

      {/* Step 3 — Zeitraum & Platz */}
      {step === 3 && (
        selectedBesitzerId && selectedHundId ? (
          <div className="space-y-6">
            {/* Kontext-Header */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <IconUser size={14} className="shrink-0" />
                <strong className="text-foreground">
                  {[selectedBesitzer?.fields.vorname, selectedBesitzer?.fields.nachname].filter(Boolean).join(' ')}
                </strong>
              </span>
              <span className="flex items-center gap-1">
                <IconDog size={14} className="shrink-0" />
                <strong className="text-foreground">{selectedHund?.fields.name}</strong>
                {selectedHund?.fields.rasse && (
                  <span className="text-muted-foreground">· {selectedHund.fields.rasse}</span>
                )}
              </span>
            </div>

            <div className="rounded-2xl border bg-card p-5 space-y-5">
              <div className="flex items-center gap-2">
                <IconCalendar size={18} className="text-primary shrink-0" />
                <h3 className="font-medium text-foreground">{tx('Zeitraum & Platz')}</h3>
              </div>

              {/* Zeitraum */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="anreise">{tx('Anreise')} *</Label>
                  <Input
                    id="anreise"
                    type="date"
                    value={anreise}
                    onChange={e => setAnreise(e.target.value)}
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

              {/* Nächte-Anzeige */}
              {nachteCount > 0 && (
                <p className="text-sm text-primary font-medium">
                  {tx`${nachteCount} Nächte`}
                </p>
              )}

              {/* Platz */}
              <div className="space-y-1">
                <Label htmlFor="platz">{tx('Platz')} *</Label>
                <Select value={platz} onValueChange={setPlatz}>
                  <SelectTrigger id="platz">
                    <SelectValue placeholder={tx('Platz wählen')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{tx('Bitte wählen')}</SelectItem>
                    {PLATZ_OPTIONS.map(opt => (
                      <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Preis */}
              <div className="space-y-1">
                <Label htmlFor="preis">{tx('Preis gesamt (€)')}</Label>
                <Input
                  id="preis"
                  type="number"
                  min="0"
                  step="0.01"
                  value={preisGesamt}
                  onChange={e => setPreisGesamt(e.target.value)}
                  placeholder={tx('z. B. 250.00')}
                />
              </div>

              {/* Notizen */}
              <div className="space-y-1">
                <Label htmlFor="notizen">{tx('Interne Notizen')}</Label>
                <textarea
                  id="notizen"
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  value={interneNotizen}
                  onChange={e => setInterneNotizen(e.target.value)}
                  placeholder={tx('Besondere Hinweise, Wünsche …')}
                />
              </div>

              {buchungError && (
                <p className="text-sm text-destructive">{buchungError}</p>
              )}

              <div className="flex flex-wrap gap-3 pt-1">
                <Button
                  disabled={!anreise || !abreise || platz === 'none' || buchungCreating}
                  onClick={handleCreateBuchung}
                >
                  {buchungCreating ? tx('Buchung wird angelegt …') : tx('Buchung anlegen')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  disabled={buchungCreating}
                >
                  {tx('← Anderen Hund wählen')}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">{tx('Dieser Schritt braucht die Auswahl aus Schritt 1 und 2.')}</p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
