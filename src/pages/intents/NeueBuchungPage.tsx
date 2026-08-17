/**
 * Neue Buchung — 3-Schritt-Wizard.
 * Steps: 1) Besitzer wählen oder anlegen → 2) Hund wählen oder anlegen → 3) Zeitraum & Platz bestätigen & anlegen.
 * Reads: besitzer, hunde. Writes: besitzer (createBesitzerEntry), hunde (createHundeEntry), buchungen (createBuchungenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { tx } from '@/i18n';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { useDashboardData } from '@/hooks/useDashboardData';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { IconCheck, IconDog, IconUser, IconCalendar } from '@tabler/icons-react';
import { differenceInDays, parseISO } from 'date-fns';

const PLATZ_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];

export default function NeueBuchungPage() {
  const { besitzer, hunde, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);

  // Step 1 state
  const [selectedBesitzerId, setSelectedBesitzerId] = useState<string | null>(null);
  const [showCreateBesitzer, setShowCreateBesitzer] = useState(false);
  const [newVorname, setNewVorname] = useState('');
  const [newNachname, setNewNachname] = useState('');
  const [newTelefon, setNewTelefon] = useState('');
  const [besitzerCreating, setBesitzerCreating] = useState(false);

  // Step 2 state
  const [selectedHundId, setSelectedHundId] = useState<string | null>(null);
  const [showCreateHund, setShowCreateHund] = useState(false);
  const [newHundName, setNewHundName] = useState('');
  const [newHundRasse, setNewHundRasse] = useState('');
  const [hundCreating, setHundCreating] = useState(false);

  // Step 3 state
  const [anreise, setAnreise] = useState('');
  const [abreise, setAbreise] = useState('');
  const [platzKey, setPlatzKey] = useState('none');
  const [preisGesamt, setPreisGesamt] = useState('');
  const [interneNotizen, setInterneNotizen] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Derived data: hunde filtered to selected besitzer
  const filteredHunde = hunde.filter(h => {
    if (!selectedBesitzerId) return false;
    const hundeUrl = h.fields.besitzer ?? '';
    const extractedId = extractRecordId(hundeUrl);
    return extractedId === selectedBesitzerId;
  });

  const selectedBesitzer = besitzer.find(b => b.record_id === selectedBesitzerId);
  const selectedHund = hunde.find(h => h.record_id === selectedHundId);

  const nachtCount =
    anreise && abreise
      ? Math.max(0, differenceInDays(parseISO(abreise), parseISO(anreise)))
      : 0;

  const canSubmit =
    selectedBesitzerId &&
    selectedHundId &&
    anreise &&
    abreise &&
    platzKey !== 'none' &&
    nachtCount > 0;

  // Handlers
  const handleSelectBesitzer = (id: string) => {
    setSelectedBesitzerId(id);
    setSelectedHundId(null);
    setStep(2);
  };

  const handleCreateBesitzer = async () => {
    if (!newVorname || !newNachname) return;
    setBesitzerCreating(true);
    try {
      const result = await LivingAppsService.createBesitzerEntry({
        vorname: newVorname,
        nachname: newNachname,
        telefon: newTelefon || undefined,
      });
      await fetchAll();
      setShowCreateBesitzer(false);
      setNewVorname('');
      setNewNachname('');
      setNewTelefon('');
      setSelectedBesitzerId(result.record_id);
      setSelectedHundId(null);
      setStep(2);
    } finally {
      setBesitzerCreating(false);
    }
  };

  const handleSelectHund = (id: string) => {
    setSelectedHundId(id);
    setStep(3);
  };

  const handleCreateHund = async () => {
    if (!newHundName || !selectedBesitzerId) return;
    setHundCreating(true);
    try {
      const result = await LivingAppsService.createHundeEntry({
        name: newHundName,
        rasse: newHundRasse || undefined,
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
      });
      await fetchAll();
      setShowCreateHund(false);
      setNewHundName('');
      setNewHundRasse('');
      setSelectedHundId(result.record_id);
      setStep(3);
    } finally {
      setHundCreating(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || !selectedBesitzerId || !selectedHundId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.createBuchungenEntry({
        hund: createRecordUrl(APP_IDS.HUNDE, selectedHundId),
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
        anreise,
        abreise,
        platz: platzKey,
        status: 'geplant',
        preis_gesamt: preisGesamt ? parseFloat(preisGesamt) : undefined,
        interne_notizen: interneNotizen || undefined,
      });
      setDone(true);
    } catch {
      setSubmitError(tx('Fehler beim Anlegen der Buchung. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedBesitzerId(null);
    setSelectedHundId(null);
    setShowCreateBesitzer(false);
    setShowCreateHund(false);
    setNewVorname('');
    setNewNachname('');
    setNewTelefon('');
    setNewHundName('');
    setNewHundRasse('');
    setAnreise('');
    setAbreise('');
    setPlatzKey('none');
    setPreisGesamt('');
    setInterneNotizen('');
    setSubmitError(null);
    setDone(false);
  };

  return (
    <IntentWizardShell
      title={tx('Neue Buchung anlegen')}
      subtitle={tx('Besitzer und Hund auswählen, Zeitraum und Platz festlegen')}
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
      {/* Step 1: Besitzer wählen */}
      {step === 1 && (
        <EntitySelectStep
          items={besitzer.map(b => ({
            id: b.record_id,
            title: [b.fields.vorname, b.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt'),
            subtitle: b.fields.telefon ?? undefined,
            icon: <IconUser size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectBesitzer}
          searchPlaceholder={tx('Besitzer suchen …')}
          createLabel={tx('Neuen Besitzer anlegen')}
          onCreateNew={() => setShowCreateBesitzer(true)}
          createDialog={showCreateBesitzer ? (
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <p className="text-sm font-medium">{tx('Neuen Besitzer erfassen')}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="new-vorname">{tx('Vorname')}</Label>
                  <Input
                    id="new-vorname"
                    value={newVorname}
                    onChange={e => setNewVorname(e.target.value)}
                    placeholder={tx('Vorname')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-nachname">{tx('Nachname')}</Label>
                  <Input
                    id="new-nachname"
                    value={newNachname}
                    onChange={e => setNewNachname(e.target.value)}
                    placeholder={tx('Nachname')}
                  />
                </div>
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
              <div className="flex gap-2">
                <Button
                  disabled={!newVorname || !newNachname || besitzerCreating}
                  onClick={handleCreateBesitzer}
                >
                  {besitzerCreating ? tx('Wird angelegt …') : tx('Anlegen & auswählen')}
                </Button>
                <Button variant="outline" onClick={() => setShowCreateBesitzer(false)}>
                  {tx('Abbrechen')}
                </Button>
              </div>
            </div>
          ) : undefined}
          emptyText={tx('Kein Besitzer gefunden')}
        />
      )}

      {/* Step 2: Hund wählen */}
      {step === 2 && (
        selectedBesitzerId ? (
          <div className="space-y-4">
            <div className="rounded-xl border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
              {tx('Besitzer')}: <span className="font-medium text-foreground">
                {[selectedBesitzer?.fields.vorname, selectedBesitzer?.fields.nachname].filter(Boolean).join(' ')}
              </span>
            </div>
            <EntitySelectStep
              items={filteredHunde.map(h => ({
                id: h.record_id,
                title: h.fields.name ?? tx('Unbekannt'),
                subtitle: [h.fields.rasse, h.fields.geschlecht?.label].filter(Boolean).join(' · '),
                icon: <IconDog size={20} className="text-primary" />,
              }))}
              onSelect={handleSelectHund}
              searchPlaceholder={tx('Hund suchen …')}
              createLabel={tx('Neuen Hund anlegen')}
              onCreateNew={() => setShowCreateHund(true)}
              createDialog={showCreateHund ? (
                <div className="rounded-2xl border bg-card p-5 space-y-4">
                  <p className="text-sm font-medium">{tx('Neuen Hund erfassen')}</p>
                  <div className="space-y-1">
                    <Label htmlFor="new-hund-name">{tx('Name des Hundes')}</Label>
                    <Input
                      id="new-hund-name"
                      value={newHundName}
                      onChange={e => setNewHundName(e.target.value)}
                      placeholder={tx('Hundename')}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-hund-rasse">{tx('Rasse')}</Label>
                    <Input
                      id="new-hund-rasse"
                      value={newHundRasse}
                      onChange={e => setNewHundRasse(e.target.value)}
                      placeholder={tx('z. B. Labrador')}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      disabled={!newHundName || hundCreating}
                      onClick={handleCreateHund}
                    >
                      {hundCreating ? tx('Wird angelegt …') : tx('Anlegen & auswählen')}
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateHund(false)}>
                      {tx('Abbrechen')}
                    </Button>
                  </div>
                </div>
              ) : undefined}
              emptyText={tx('Noch kein Hund für diesen Besitzer — lege einen an')}
            />
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">{tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}</p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Zu Schritt 1')}</Button>
          </div>
        )
      )}

      {/* Step 3: Zeitraum & Platz */}
      {step === 3 && (
        selectedBesitzerId && selectedHundId ? (
          done ? (
            <div className="flex flex-col items-center gap-6 py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <IconCheck size={32} className="text-emerald-600" stroke={2} />
              </div>
              <div className="text-center space-y-1">
                <h2 className="text-lg font-semibold">{tx('Buchung angelegt!')}</h2>
                <p className="text-sm text-muted-foreground">
                  {tx('Die Buchung wurde erfolgreich gespeichert.')}
                </p>
              </div>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button onClick={handleReset}>{tx('Neue Buchung anlegen')}</Button>
                <a href="#/">
                  <Button variant="outline">{tx('Zurück zum Dashboard')}</Button>
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary bar */}
              <div className="rounded-xl border bg-secondary/40 px-4 py-3 text-sm space-y-1">
                <div className="flex gap-2 items-center">
                  <IconUser size={14} className="shrink-0 text-muted-foreground" />
                  <span className="font-medium text-foreground">
                    {[selectedBesitzer?.fields.vorname, selectedBesitzer?.fields.nachname].filter(Boolean).join(' ')}
                  </span>
                  {selectedBesitzer?.fields.telefon && (
                    <span className="text-muted-foreground">· {selectedBesitzer.fields.telefon}</span>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <IconDog size={14} className="shrink-0 text-muted-foreground" />
                  <span className="font-medium text-foreground">{selectedHund?.fields.name}</span>
                  {selectedHund?.fields.rasse && (
                    <span className="text-muted-foreground">· {selectedHund.fields.rasse}</span>
                  )}
                </div>
              </div>

              {/* Date range */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="anreise">
                    <span className="flex items-center gap-1.5">
                      <IconCalendar size={14} className="shrink-0" />
                      {tx('Anreise')}
                    </span>
                  </Label>
                  <Input
                    id="anreise"
                    type="date"
                    value={anreise}
                    onChange={e => setAnreise(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="abreise">
                    <span className="flex items-center gap-1.5">
                      <IconCalendar size={14} className="shrink-0" />
                      {tx('Abreise')}
                    </span>
                  </Label>
                  <Input
                    id="abreise"
                    type="date"
                    value={abreise}
                    min={anreise || undefined}
                    onChange={e => setAbreise(e.target.value)}
                  />
                </div>
              </div>

              {nachtCount > 0 && (
                <p className="text-sm text-muted-foreground">
                  {tx(tx`${nachtCount} Nacht${nachtCount !== 1 ? 'nächte' : ''}`)}
                </p>
              )}

              {/* Platz */}
              <div className="space-y-1.5">
                <Label htmlFor="platz">{tx('Platz')}</Label>
                <Select value={platzKey} onValueChange={setPlatzKey}>
                  <SelectTrigger id="platz">
                    <SelectValue placeholder={tx('Platz wählen …')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{tx('Platz wählen …')}</SelectItem>
                    {PLATZ_OPTIONS.map(opt => (
                      <SelectItem key={opt.key} value={opt.key}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Preis */}
              <div className="space-y-1.5">
                <Label htmlFor="preis">{tx('Preis gesamt (€)')}</Label>
                <Input
                  id="preis"
                  type="number"
                  min="0"
                  step="0.01"
                  value={preisGesamt}
                  onChange={e => setPreisGesamt(e.target.value)}
                  placeholder={tx('0,00')}
                />
              </div>

              {/* Notizen */}
              <div className="space-y-1.5">
                <Label htmlFor="notizen">{tx('Interne Notizen')}</Label>
                <Textarea
                  id="notizen"
                  value={interneNotizen}
                  onChange={e => setInterneNotizen(e.target.value)}
                  placeholder={tx('Besondere Hinweise, Allergien, Vorlieben …')}
                  rows={3}
                />
              </div>

              {submitError && (
                <p className="text-sm text-destructive">{submitError}</p>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={!canSubmit || submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? tx('Wird gespeichert …') : tx('Buchung anlegen')}
                </Button>
                <Button variant="outline" onClick={() => setStep(2)}>
                  {tx('Zurück')}
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">{tx('Dieser Schritt braucht die Auswahl aus den vorherigen Schritten.')}</p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
