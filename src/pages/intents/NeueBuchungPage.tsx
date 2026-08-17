/**
 * Neue Buchung — 3-Schritt-Wizard.
 * Steps: 1) Besitzer wählen oder neu anlegen → 2) Hund wählen oder neu anlegen
 *        → 3) Zeitraum & Platz festlegen → Buchung anlegen.
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconUser, IconDog, IconCalendar, IconCheck } from '@tabler/icons-react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { tx } from '@/i18n';

const PLATZ_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];
const GESCHLECHT_OPTIONS = LOOKUP_OPTIONS['hunde']?.['geschlecht'] ?? [];

export default function NeueBuchungPage() {
  const { besitzer, hunde, loading, error, fetchAll } = useDashboardData();

  // Step navigation
  const [step, setStep] = useState(1);

  // Step 1 — Besitzer
  const [selectedBesitzerId, setSelectedBesitzerId] = useState<string | null>(null);
  const [showBesitzerCreate, setShowBesitzerCreate] = useState(false);
  const [newVorname, setNewVorname] = useState('');
  const [newNachname, setNewNachname] = useState('');
  const [newTelefon, setNewTelefon] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [besitzerSaving, setBesitzerSaving] = useState(false);

  // Step 2 — Hund
  const [selectedHundId, setSelectedHundId] = useState<string | null>(null);
  const [showHundCreate, setShowHundCreate] = useState(false);
  const [newHundName, setNewHundName] = useState('');
  const [newRasse, setNewRasse] = useState('');
  const [newGeburtsdatum, setNewGeburtsdatum] = useState('');
  const [newGeschlechtKey, setNewGeschlechtKey] = useState('none');
  const [hundSaving, setHundSaving] = useState(false);

  // Step 3 — Zeitraum & Platz
  const [anreise, setAnreise] = useState('');
  const [abreise, setAbreise] = useState('');
  const [platzKey, setPlatzKey] = useState('none');
  const [preisGesamt, setPreisGesamt] = useState('');
  const [interneNotizen, setInterneNotizen] = useState('');
  const [buchungSaving, setBuchungSaving] = useState(false);
  const [buchungError, setBuchungError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Derived: Hunde des gewählten Besitzers
  const besitzerUrl = selectedBesitzerId
    ? createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId)
    : null;

  const hundeDesBesitzers = hunde.filter(h => {
    if (!besitzerUrl) return false;
    return h.fields.besitzer === besitzerUrl;
  });

  // Step 1: Besitzer anlegen
  const handleBesitzerCreate = async () => {
    if (!newVorname.trim() || !newNachname.trim()) return;
    setBesitzerSaving(true);
    try {
      const result = await LivingAppsService.createBesitzerEntry({
        vorname: newVorname.trim(),
        nachname: newNachname.trim(),
        telefon: newTelefon.trim() || undefined,
        email: newEmail.trim() || undefined,
      });
      await fetchAll();
      setSelectedBesitzerId(result.record_id);
      setShowBesitzerCreate(false);
      setNewVorname('');
      setNewNachname('');
      setNewTelefon('');
      setNewEmail('');
      setStep(2);
    } finally {
      setBesitzerSaving(false);
    }
  };

  // Step 2: Hund anlegen
  const handleHundCreate = async () => {
    if (!newHundName.trim() || !selectedBesitzerId) return;
    setHundSaving(true);
    try {
      const fields: Parameters<typeof LivingAppsService.createHundeEntry>[0] = {
        name: newHundName.trim(),
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
      };
      if (newRasse.trim()) fields.rasse = newRasse.trim();
      if (newGeburtsdatum) fields.geburtsdatum = newGeburtsdatum;
      if (newGeschlechtKey && newGeschlechtKey !== 'none') fields.geschlecht = newGeschlechtKey;

      const result = await LivingAppsService.createHundeEntry(fields);
      await fetchAll();
      setSelectedHundId(result.record_id);
      setShowHundCreate(false);
      setNewHundName('');
      setNewRasse('');
      setNewGeburtsdatum('');
      setNewGeschlechtKey('none');
      setStep(3);
    } finally {
      setHundSaving(false);
    }
  };

  // Step 3: Buchung anlegen
  const handleBuchungCreate = async () => {
    if (!selectedBesitzerId || !selectedHundId || !anreise || !abreise || platzKey === 'none') return;
    setBuchungSaving(true);
    setBuchungError(null);
    try {
      const fields: Parameters<typeof LivingAppsService.createBuchungenEntry>[0] = {
        hund: createRecordUrl(APP_IDS.HUNDE, selectedHundId),
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
        anreise,
        abreise,
        platz: platzKey,
        status: 'geplant',
        zahlungsstatus: 'offen',
      };
      if (preisGesamt.trim()) {
        const parsed = parseFloat(preisGesamt.replace(',', '.'));
        if (!isNaN(parsed)) fields.preis_gesamt = parsed;
      }
      if (interneNotizen.trim()) fields.interne_notizen = interneNotizen.trim();

      await LivingAppsService.createBuchungenEntry(fields);
      setDone(true);
    } catch {
      setBuchungError(tx('Buchung konnte nicht angelegt werden. Bitte erneut versuchen.'));
    } finally {
      setBuchungSaving(false);
    }
  };

  // Reset wizard
  const handleReset = () => {
    setStep(1);
    setSelectedBesitzerId(null);
    setSelectedHundId(null);
    setShowBesitzerCreate(false);
    setShowHundCreate(false);
    setAnreise('');
    setAbreise('');
    setPlatzKey('none');
    setPreisGesamt('');
    setInterneNotizen('');
    setBuchungError(null);
    setDone(false);
  };

  const selectedBesitzer = besitzer.find(b => b.record_id === selectedBesitzerId);
  const selectedHund = hunde.find(h => h.record_id === selectedHundId);

  // Success screen
  if (done) {
    return (
      <IntentWizardShell
        title={tx('Neue Buchung')}
        subtitle={tx('Buchung erfolgreich anlegen')}
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
        <div className="flex flex-col items-center justify-center py-16 space-y-6 text-center">
          <div className="rounded-full bg-emerald-100 p-5">
            <IconCheck size={48} className="text-emerald-600" stroke={1.5} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">{tx('Buchung angelegt!')}</h2>
            <p className="text-sm text-muted-foreground">
              {selectedHund?.fields.name && selectedBesitzer
                ? tx(tx`${selectedHund.fields.name} von ${selectedBesitzer.fields.vorname ?? ''} ${selectedBesitzer.fields.nachname ?? ''} wurde erfolgreich gebucht.`)
                : tx('Die Buchung wurde erfolgreich angelegt.')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button onClick={handleReset} variant="outline">
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
      subtitle={tx('Besitzer, Hund und Zeitraum in 3 Schritten erfassen')}
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
      {/* ── Step 1: Besitzer wählen ── */}
      {step === 1 && (
        <EntitySelectStep
          items={besitzer.map(b => ({
            id: b.record_id,
            title: `${b.fields.vorname ?? ''} ${b.fields.nachname ?? ''}`.trim() || b.record_id,
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
          onCreateNew={() => setShowBesitzerCreate(true)}
          emptyText={tx('Noch kein Besitzer erfasst. Jetzt neu anlegen.')}
          emptyIcon={<IconUser size={40} className="text-muted-foreground" />}
          createDialog={showBesitzerCreate && (
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <h3 className="font-medium text-foreground">{tx('Neuen Besitzer anlegen')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="new-vorname">{tx('Vorname')} *</Label>
                  <Input
                    id="new-vorname"
                    value={newVorname}
                    onChange={e => setNewVorname(e.target.value)}
                    placeholder={tx('Vorname')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-nachname">{tx('Nachname')} *</Label>
                  <Input
                    id="new-nachname"
                    value={newNachname}
                    onChange={e => setNewNachname(e.target.value)}
                    placeholder={tx('Nachname')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-telefon">{tx('Telefon')}</Label>
                  <Input
                    id="new-telefon"
                    type="tel"
                    value={newTelefon}
                    onChange={e => setNewTelefon(e.target.value)}
                    placeholder={tx('Telefonnummer')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-email">{tx('E-Mail')}</Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    placeholder={tx('E-Mail-Adresse')}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  disabled={!newVorname.trim() || !newNachname.trim() || besitzerSaving}
                  onClick={handleBesitzerCreate}
                >
                  {besitzerSaving ? tx('Wird angelegt …') : tx('Anlegen & weiter')}
                </Button>
                <Button variant="outline" onClick={() => setShowBesitzerCreate(false)}>
                  {tx('Abbrechen')}
                </Button>
              </div>
            </div>
          )}
        />
      )}

      {/* ── Step 2: Hund wählen ── */}
      {step === 2 && (
        selectedBesitzerId ? (
          <div className="space-y-4">
            {selectedBesitzer && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground px-1">
                <IconUser size={16} className="shrink-0" />
                <span>
                  {tx('Besitzer:')} <span className="font-medium text-foreground">
                    {selectedBesitzer.fields.vorname} {selectedBesitzer.fields.nachname}
                  </span>
                </span>
                <button
                  className="ml-auto text-xs underline text-primary"
                  onClick={() => { setSelectedBesitzerId(null); setSelectedHundId(null); setStep(1); }}
                >
                  {tx('Ändern')}
                </button>
              </div>
            )}
            <EntitySelectStep
              items={hundeDesBesitzers.map(h => ({
                id: h.record_id,
                title: h.fields.name ?? h.record_id,
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
              emptyText={
                hundeDesBesitzers.length === 0
                  ? tx('Noch kein Hund für diesen Besitzer erfasst.')
                  : tx('Kein passender Hund gefunden.')
              }
              emptyIcon={<IconDog size={40} className="text-muted-foreground" />}
              createDialog={showHundCreate && (
                <div className="rounded-2xl border bg-card p-5 space-y-4">
                  <h3 className="font-medium text-foreground">{tx('Neuen Hund anlegen')}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="new-hund-name">{tx('Name')} *</Label>
                      <Input
                        id="new-hund-name"
                        value={newHundName}
                        onChange={e => setNewHundName(e.target.value)}
                        placeholder={tx('Name des Hundes')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="new-rasse">{tx('Rasse')}</Label>
                      <Input
                        id="new-rasse"
                        value={newRasse}
                        onChange={e => setNewRasse(e.target.value)}
                        placeholder={tx('z. B. Labrador')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="new-geburtsdatum">{tx('Geburtsdatum')}</Label>
                      <Input
                        id="new-geburtsdatum"
                        type="date"
                        value={newGeburtsdatum}
                        onChange={e => setNewGeburtsdatum(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="new-geschlecht">{tx('Geschlecht')}</Label>
                      <Select value={newGeschlechtKey} onValueChange={setNewGeschlechtKey}>
                        <SelectTrigger id="new-geschlecht">
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
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      disabled={!newHundName.trim() || hundSaving}
                      onClick={handleHundCreate}
                    >
                      {hundSaving ? tx('Wird angelegt …') : tx('Anlegen & weiter')}
                    </Button>
                    <Button variant="outline" onClick={() => setShowHundCreate(false)}>
                      {tx('Abbrechen')}
                    </Button>
                  </div>
                </div>
              )}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              {tx('Bitte zuerst einen Besitzer auswählen.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              {tx('Zurück zu Schritt 1')}
            </Button>
          </div>
        )
      )}

      {/* ── Step 3: Zeitraum & Platz ── */}
      {step === 3 && (
        selectedBesitzerId && selectedHundId ? (
          <div className="space-y-6">
            {/* Zusammenfassung der Auswahl */}
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground px-1">
              {selectedBesitzer && (
                <div className="flex items-center gap-1.5">
                  <IconUser size={15} className="shrink-0" />
                  <span className="font-medium text-foreground">
                    {selectedBesitzer.fields.vorname} {selectedBesitzer.fields.nachname}
                  </span>
                  <button className="text-xs underline text-primary" onClick={() => setStep(1)}>
                    {tx('Ändern')}
                  </button>
                </div>
              )}
              {selectedHund && (
                <div className="flex items-center gap-1.5">
                  <IconDog size={15} className="shrink-0" />
                  <span className="font-medium text-foreground">{selectedHund.fields.name}</span>
                  {selectedHund.fields.rasse && (
                    <span className="text-muted-foreground">({selectedHund.fields.rasse})</span>
                  )}
                  <button className="text-xs underline text-primary" onClick={() => setStep(2)}>
                    {tx('Ändern')}
                  </button>
                </div>
              )}
            </div>

            {/* Formular */}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <h3 className="font-medium text-foreground flex items-center gap-2">
                <IconCalendar size={18} className="text-primary shrink-0" />
                {tx('Zeitraum & Platz')}
              </h3>

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
                    onChange={e => setAbreise(e.target.value)}
                    min={anreise || undefined}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="platz">{tx('Platz')} *</Label>
                  <Select value={platzKey} onValueChange={setPlatzKey}>
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

                <div className="space-y-1">
                  <Label htmlFor="preis">{tx('Preis gesamt (€)')}</Label>
                  <Input
                    id="preis"
                    type="number"
                    min="0"
                    step="0.01"
                    value={preisGesamt}
                    onChange={e => setPreisGesamt(e.target.value)}
                    placeholder={tx('z. B. 250')}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="notizen">{tx('Interne Notizen')}</Label>
                <Textarea
                  id="notizen"
                  value={interneNotizen}
                  onChange={e => setInterneNotizen(e.target.value)}
                  placeholder={tx('Besondere Hinweise, Absprachen …')}
                  rows={3}
                />
              </div>

              {buchungError && (
                <p className="text-sm text-destructive">{buchungError}</p>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  disabled={!anreise || !abreise || platzKey === 'none' || buchungSaving}
                  onClick={handleBuchungCreate}
                  className="sm:w-auto w-full"
                >
                  {buchungSaving ? tx('Buchung wird angelegt …') : tx('Buchung anlegen')}
                </Button>
                <Button variant="outline" onClick={() => setStep(2)} className="sm:w-auto w-full">
                  {tx('Zurück')}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center">
            <p className="text-sm text-muted-foreground">
              {tx('Bitte zuerst Besitzer und Hund auswählen.')}
            </p>
            <Button variant="outline" onClick={() => setStep(selectedBesitzerId ? 2 : 1)}>
              {tx('Neu starten')}
            </Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
