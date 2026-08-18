/**
 * Neue Buchung — 3-Schritt-Wizard.
 * Steps: 1) Besitzer wählen/anlegen → 2) Hund wählen/anlegen (gefiltert auf Besitzer) → 3) Buchungsdetails erfassen & anlegen.
 * Reads: besitzer, hunde. Writes: besitzer (createBesitzerEntry), hunde (createHundeEntry), buchungen (createBuchungenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { tx } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconCheck, IconDog, IconUser } from '@tabler/icons-react';

const PLATZ_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];
const GESCHLECHT_OPTIONS = LOOKUP_OPTIONS['hunde']?.['geschlecht'] ?? [];
const IMPFSTATUS_OPTIONS = LOOKUP_OPTIONS['hunde']?.['impfstatus'] ?? [];

export default function NeueBuchungPage() {
  const data = useDashboardData();
  const { besitzer, hunde, loading, error, fetchAll } = data;

  // Step state
  const [step, setStep] = useState(1);

  // Step 1 — Besitzer
  const [selectedBesitzerId, setSelectedBesitzerId] = useState<string | null>(null);
  const [showCreateBesitzer, setShowCreateBesitzer] = useState(false);
  const [bVorname, setBVorname] = useState('');
  const [bNachname, setBNachname] = useState('');
  const [bTelefon, setBTelefon] = useState('');
  const [bEmail, setBEmail] = useState('');
  const [creatingBesitzer, setCreatingBesitzer] = useState(false);

  // Step 2 — Hund
  const [selectedHundId, setSelectedHundId] = useState<string | null>(null);
  const [showCreateHund, setShowCreateHund] = useState(false);
  const [hName, setHName] = useState('');
  const [hRasse, setHRasse] = useState('');
  const [hGeschlecht, setHGeschlecht] = useState('none');
  const [hImpfstatus, setHImpfstatus] = useState('none');
  const [creatingHund, setCreatingHund] = useState(false);

  // Step 3 — Buchungsdetails
  const [anreise, setAnreise] = useState('');
  const [abreise, setAbreise] = useState('');
  const [platzKey, setPlatzKey] = useState('none');
  const [preisGesamt, setPreisGesamt] = useState('');
  const [interneNotizen, setInterneNotizen] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleCreateBesitzer = async () => {
    if (!bVorname || !bNachname) return;
    setCreatingBesitzer(true);
    try {
      const result = await LivingAppsService.createBesitzerEntry({
        vorname: bVorname,
        nachname: bNachname,
        telefon: bTelefon || undefined,
        email: bEmail || undefined,
      });
      await fetchAll();
      setShowCreateBesitzer(false);
      setBVorname('');
      setBNachname('');
      setBTelefon('');
      setBEmail('');
      setSelectedBesitzerId(result.record_id);
      setStep(2);
    } finally {
      setCreatingBesitzer(false);
    }
  };

  const handleCreateHund = async () => {
    if (!hName || !selectedBesitzerId) return;
    setCreatingHund(true);
    try {
      const result = await LivingAppsService.createHundeEntry({
        name: hName,
        rasse: hRasse || undefined,
        geschlecht: hGeschlecht !== 'none' ? hGeschlecht : undefined,
        impfstatus: hImpfstatus !== 'none' ? hImpfstatus : undefined,
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
      });
      await fetchAll();
      setShowCreateHund(false);
      setHName('');
      setHRasse('');
      setHGeschlecht('none');
      setHImpfstatus('none');
      setSelectedHundId(result.record_id);
      setStep(3);
    } finally {
      setCreatingHund(false);
    }
  };

  const handleSubmitBuchung = async () => {
    if (!selectedBesitzerId || !selectedHundId || !anreise || !abreise || platzKey === 'none') return;
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
        zahlungsstatus: 'offen',
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
    setBVorname('');
    setBNachname('');
    setBTelefon('');
    setBEmail('');
    setHName('');
    setHRasse('');
    setHGeschlecht('none');
    setHImpfstatus('none');
    setAnreise('');
    setAbreise('');
    setPlatzKey('none');
    setPreisGesamt('');
    setInterneNotizen('');
    setSubmitError(null);
    setDone(false);
  };

  // Filtered dogs for step 2
  const filteredHunde = selectedBesitzerId
    ? hunde.filter(h => extractRecordId(h.fields.besitzer) === selectedBesitzerId)
    : [];

  const selectedBesitzer = besitzer.find(b => b.record_id === selectedBesitzerId);
  const selectedHund = hunde.find(h => h.record_id === selectedHundId);

  if (done) {
    return (
      <IntentWizardShell
        title={tx('Neue Buchung')}
        subtitle={tx('Buchung erfolgreich angelegt')}
        steps={[
          { label: tx('Besitzer wählen') },
          { label: tx('Hund wählen') },
          { label: tx('Buchung anlegen') },
        ]}
        currentStep={3}
        onStepChange={setStep}
        loading={false}
      >
        <div className="flex flex-col items-center justify-center py-16 space-y-6 text-center">
          <div className="rounded-full bg-emerald-100 p-5">
            <IconCheck size={48} className="text-emerald-600" stroke={1.5} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{tx('Buchung erfolgreich angelegt!')}</h2>
            <p className="text-muted-foreground text-sm max-w-sm">
              {tx('Die Buchung wurde gespeichert.')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
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
      subtitle={tx('Besitzer und Hund auswählen, dann Zeitraum und Platz bestimmen')}
      steps={[
        { label: tx('Besitzer wählen') },
        { label: tx('Hund wählen') },
        { label: tx('Buchung anlegen') },
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
            title: [b.fields.vorname, b.fields.nachname].filter(Boolean).join(' ') || b.record_id,
            subtitle: b.fields.telefon ?? b.fields.email ?? undefined,
            icon: <IconUser size={20} className="text-primary" />,
          }))}
          onSelect={(id) => {
            setSelectedBesitzerId(id);
            setSelectedHundId(null);
            setStep(2);
          }}
          createLabel={tx('Neuen Besitzer anlegen')}
          onCreateNew={() => setShowCreateBesitzer(true)}
          searchPlaceholder={tx('Besitzer suchen …')}
          emptyText={tx('Noch kein Besitzer angelegt')}
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
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowCreateBesitzer(false)}>
                  {tx('Abbrechen')}
                </Button>
                <Button
                  disabled={!bVorname || !bNachname || creatingBesitzer}
                  onClick={handleCreateBesitzer}
                >
                  {creatingBesitzer ? tx('Anlegen …') : tx('Anlegen & weiter')}
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
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconUser size={16} className="shrink-0" />
                <span>
                  {tx('Besitzer')}:{' '}
                  <span className="font-medium text-foreground">
                    {[selectedBesitzer.fields.vorname, selectedBesitzer.fields.nachname].filter(Boolean).join(' ')}
                  </span>
                </span>
              </div>
            )}
            <EntitySelectStep
              items={filteredHunde.map(h => ({
                id: h.record_id,
                title: h.fields.name ?? h.record_id,
                subtitle: h.fields.rasse ?? undefined,
                icon: <IconDog size={20} className="text-primary" />,
              }))}
              onSelect={(id) => {
                setSelectedHundId(id);
                setStep(3);
              }}
              createLabel={tx('Neuen Hund anlegen')}
              onCreateNew={() => setShowCreateHund(true)}
              searchPlaceholder={tx('Hund suchen …')}
              emptyText={tx('Noch kein Hund für diesen Besitzer — jetzt anlegen')}
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
                        placeholder={tx('z.B. Labrador')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="h-geschlecht">{tx('Geschlecht')}</Label>
                      <Select value={hGeschlecht} onValueChange={setHGeschlecht}>
                        <SelectTrigger id="h-geschlecht">
                          <SelectValue placeholder={tx('Geschlecht wählen')} />
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
                      <Label htmlFor="h-impfstatus">{tx('Impfstatus')}</Label>
                      <Select value={hImpfstatus} onValueChange={setHImpfstatus}>
                        <SelectTrigger id="h-impfstatus">
                          <SelectValue placeholder={tx('Impfstatus wählen')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{tx('Keine Angabe')}</SelectItem>
                          {IMPFSTATUS_OPTIONS.map(o => (
                            <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setShowCreateHund(false)}>
                      {tx('Abbrechen')}
                    </Button>
                    <Button
                      disabled={!hName || creatingHund}
                      onClick={handleCreateHund}
                    >
                      {creatingHund ? tx('Anlegen …') : tx('Anlegen & weiter')}
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
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}

      {/* ── Step 3: Buchungsdetails ── */}
      {step === 3 && (
        selectedBesitzerId && selectedHundId ? (
          <div className="space-y-6">
            {/* Kontext-Anzeige */}
            <div className="rounded-xl border bg-secondary/40 p-3 flex flex-wrap gap-4 text-sm">
              {selectedBesitzer && (
                <div className="flex items-center gap-1.5">
                  <IconUser size={16} className="shrink-0 text-muted-foreground" />
                  <span className="text-muted-foreground">{tx('Besitzer')}:</span>
                  <span className="font-medium">
                    {[selectedBesitzer.fields.vorname, selectedBesitzer.fields.nachname].filter(Boolean).join(' ')}
                  </span>
                </div>
              )}
              {selectedHund && (
                <div className="flex items-center gap-1.5">
                  <IconDog size={16} className="shrink-0 text-muted-foreground" />
                  <span className="text-muted-foreground">{tx('Hund')}:</span>
                  <span className="font-medium">{selectedHund.fields.name}</span>
                  {selectedHund.fields.rasse && (
                    <span className="text-muted-foreground">({selectedHund.fields.rasse})</span>
                  )}
                </div>
              )}
            </div>

            {/* Buchungsformular */}
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
                    {PLATZ_OPTIONS.map(o => (
                      <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
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
                  placeholder="0,00"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="notizen">{tx('Interne Notizen')}</Label>
              <Textarea
                id="notizen"
                value={interneNotizen}
                onChange={e => setInterneNotizen(e.target.value)}
                placeholder={tx('Hinweise zur Buchung …')}
                rows={3}
              />
            </div>

            {submitError && (
              <p className="text-sm text-destructive">{submitError}</p>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <Button variant="outline" onClick={() => setStep(2)}>
                {tx('Zurück')}
              </Button>
              <Button
                disabled={!anreise || !abreise || platzKey === 'none' || submitting}
                onClick={handleSubmitBuchung}
              >
                {submitting ? tx('Buchung anlegen …') : tx('Buchung anlegen')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Auswahl aus Schritt 1 und 2.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
