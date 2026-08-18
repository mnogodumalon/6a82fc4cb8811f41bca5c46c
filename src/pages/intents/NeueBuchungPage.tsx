/**
 * Neue Hundepension-Buchung — 3-Schritt-Wizard.
 * Steps: 1) Besitzer wählen oder neu anlegen → 2) Hund wählen oder neu anlegen
 *        (gefiltert auf den gewählten Besitzer) → 3) Buchungsdetails eingeben & speichern.
 * Reads: besitzer, hunde. Writes: besitzer (createBesitzerEntry), hunde (createHundeEntry),
 *        buchungen (createBuchungenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { differenceInDays } from 'date-fns';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { useDashboardData } from '@/hooks/useDashboardData';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { tx } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  IconUser,
  IconDog,
  IconCalendar,
  IconCheck,
  IconAlertCircle,
} from '@tabler/icons-react';

const PLATZ_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];
const GESCHLECHT_OPTIONS = LOOKUP_OPTIONS['hunde']?.['geschlecht'] ?? [];
const IMPFSTATUS_OPTIONS = LOOKUP_OPTIONS['hunde']?.['impfstatus'] ?? [];

export default function NeueBuchungPage() {
  const data = useDashboardData();
  const { besitzer, hunde, loading, error, fetchAll } = data;

  const [searchParams, setSearchParams] = useSearchParams();
  const initialStep = Math.min(Math.max(parseInt(searchParams.get('step') ?? '1', 10), 1), 3);

  const [step, setStep] = useState(initialStep);

  // Schritt 1 — Besitzer
  const [besitzerId, setBesitzerId] = useState<string | null>(null);
  const [showCreateBesitzer, setShowCreateBesitzer] = useState(false);
  const [bVorname, setBVorname] = useState('');
  const [bNachname, setBNachname] = useState('');
  const [bTelefon, setBTelefon] = useState('');
  const [bEmail, setBEmail] = useState('');
  const [bCreating, setBCreating] = useState(false);
  const [bError, setBError] = useState<string | null>(null);

  // Schritt 2 — Hund
  const [hundId, setHundId] = useState<string | null>(null);
  const [showCreateHund, setShowCreateHund] = useState(false);
  const [hName, setHName] = useState('');
  const [hRasse, setHRasse] = useState('');
  const [hGeschlecht, setHGeschlecht] = useState('none');
  const [hImpfstatus, setHImpfstatus] = useState('none');
  const [hCreating, setHCreating] = useState(false);
  const [hError, setHError] = useState<string | null>(null);

  // Schritt 3 — Buchungsdetails
  const [anreise, setAnreise] = useState('');
  const [abreise, setAbreise] = useState('');
  const [platzKey, setPlatzKey] = useState('none');
  const [preisGesamt, setPreisGesamt] = useState('');
  const [interneNotizen, setInterneNotizen] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successBuchungId, setSuccessBuchungId] = useState<string | null>(null);

  const handleStepChange = (s: number) => {
    setStep(s);
    setSearchParams({ step: String(s) });
  };

  // Schritt 1: Besitzer anlegen
  const handleCreateBesitzer = async () => {
    if (!bVorname.trim() || !bNachname.trim()) return;
    setBCreating(true);
    setBError(null);
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
      setBesitzerId(created.record_id);
      handleStepChange(2);
    } catch {
      setBError(tx('Fehler beim Anlegen des Besitzers. Bitte erneut versuchen.'));
    } finally {
      setBCreating(false);
    }
  };

  // Schritt 2: Hund anlegen
  const handleCreateHund = async () => {
    if (!hName.trim() || !besitzerId) return;
    setHCreating(true);
    setHError(null);
    try {
      const payload: Parameters<typeof LivingAppsService.createHundeEntry>[0] = {
        name: hName.trim(),
        rasse: hRasse.trim() || undefined,
        besitzer: createRecordUrl(APP_IDS.BESITZER, besitzerId),
      };
      if (hGeschlecht !== 'none') payload.geschlecht = hGeschlecht;
      if (hImpfstatus !== 'none') payload.impfstatus = hImpfstatus;
      const created = await LivingAppsService.createHundeEntry(payload);
      await fetchAll();
      setShowCreateHund(false);
      setHName('');
      setHRasse('');
      setHGeschlecht('none');
      setHImpfstatus('none');
      setHundId(created.record_id);
      handleStepChange(3);
    } catch {
      setHError(tx('Fehler beim Anlegen des Hundes. Bitte erneut versuchen.'));
    } finally {
      setHCreating(false);
    }
  };

  // Schritt 3: Buchung speichern
  const handleSubmit = async () => {
    if (!besitzerId || !hundId || !anreise || !abreise || platzKey === 'none') return;
    if (successBuchungId) return; // Idempotenz: nicht doppelt anlegen
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Parameters<typeof LivingAppsService.createBuchungenEntry>[0] = {
        hund: createRecordUrl(APP_IDS.HUNDE, hundId),
        besitzer: createRecordUrl(APP_IDS.BESITZER, besitzerId),
        anreise,
        abreise,
        platz: platzKey,
        status: 'geplant',
        zahlungsstatus: 'offen',
      };
      if (preisGesamt.trim()) {
        const parsed = parseFloat(preisGesamt.replace(',', '.'));
        if (!isNaN(parsed)) payload.preis_gesamt = parsed;
      }
      if (interneNotizen.trim()) payload.interne_notizen = interneNotizen.trim();
      const created = await LivingAppsService.createBuchungenEntry(payload);
      await fetchAll();
      setSuccessBuchungId(created.record_id);
    } catch {
      setSubmitError(tx('Fehler beim Speichern der Buchung. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setBesitzerId(null);
    setHundId(null);
    setShowCreateBesitzer(false);
    setShowCreateHund(false);
    setBVorname(''); setBNachname(''); setBTelefon(''); setBEmail('');
    setHName(''); setHRasse(''); setHGeschlecht('none'); setHImpfstatus('none');
    setAnreise(''); setAbreise(''); setPlatzKey('none'); setPreisGesamt('');
    setInterneNotizen('');
    setSubmitError(null);
    setSuccessBuchungId(null);
    setBError(null);
    setHError(null);
    handleStepChange(1);
  };

  // Übernachtungen berechnen
  const naechte =
    anreise && abreise
      ? Math.max(0, differenceInDays(new Date(abreise), new Date(anreise)))
      : 0;

  // Gefundener Besitzer für Anzeige
  const selectedBesitzer = besitzerId
    ? besitzer.find(b => b.record_id === besitzerId)
    : null;

  // Gefilterte Hunde: nur die des gewählten Besitzers
  const filteredHunde = besitzerId
    ? hunde.filter(h => extractRecordId(h.fields.besitzer) === besitzerId)
    : [];

  // Gewählter Hund für Anzeige
  const selectedHund = hundId ? hunde.find(h => h.record_id === hundId) : null;

  return (
    <IntentWizardShell
      title={tx('Neue Buchung anlegen')}
      subtitle={tx('Besitzer und Hund wählen, dann Zeitraum und Platz festlegen')}
      steps={[
        { label: tx('Besitzer') },
        { label: tx('Hund') },
        { label: tx('Buchungsdetails') },
      ]}
      currentStep={step}
      onStepChange={handleStepChange}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Schritt 1: Besitzer ─────────────────────────────────────────── */}
      {step === 1 && (
        <EntitySelectStep
          items={besitzer.map(b => ({
            id: b.record_id,
            title: [b.fields.vorname, b.fields.nachname].filter(Boolean).join(' ') || b.record_id,
            subtitle: [b.fields.telefon, b.fields.email].filter(Boolean).join(' · ') || undefined,
            icon: <IconUser size={20} className="text-primary" />,
          }))}
          onSelect={(id) => {
            setBesitzerId(id);
            setHundId(null); // Hund-Auswahl zurücksetzen wenn Besitzer wechselt
            handleStepChange(2);
          }}
          searchPlaceholder={tx('Besitzer suchen …')}
          createLabel={tx('Neuen Besitzer anlegen')}
          onCreateNew={() => setShowCreateBesitzer(true)}
          createDialog={showCreateBesitzer ? (
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">{tx('Neuen Besitzer anlegen')}</p>
              {bError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <IconAlertCircle size={16} className="shrink-0" />
                  {bError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="b-vorname">{tx('Vorname')} *</Label>
                  <Input
                    id="b-vorname"
                    value={bVorname}
                    onChange={e => setBVorname(e.target.value)}
                    placeholder={tx('Vorname')}
                    autoFocus
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
                    placeholder={tx('z. B. 0171 1234567')}
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
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={!bVorname.trim() || !bNachname.trim() || bCreating}
                  onClick={handleCreateBesitzer}
                >
                  {bCreating ? tx('Wird angelegt …') : tx('Anlegen & weiter')}
                </Button>
                <Button variant="outline" onClick={() => { setShowCreateBesitzer(false); setBError(null); }}>
                  {tx('Abbrechen')}
                </Button>
              </div>
            </div>
          ) : undefined}
          emptyText={tx('Kein Besitzer gefunden')}
        />
      )}

      {/* ── Schritt 2: Hund ─────────────────────────────────────────────── */}
      {step === 2 && (
        besitzerId ? (
          <div className="space-y-4">
            {selectedBesitzer && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary rounded-xl px-4 py-2">
                <IconUser size={16} className="shrink-0 text-primary" />
                <span>
                  {tx('Besitzer')}:{' '}
                  <strong className="text-foreground">
                    {[selectedBesitzer.fields.vorname, selectedBesitzer.fields.nachname].filter(Boolean).join(' ')}
                  </strong>
                </span>
              </div>
            )}
            <EntitySelectStep
              items={filteredHunde.map(h => ({
                id: h.record_id,
                title: h.fields.name ?? h.record_id,
                subtitle: [h.fields.rasse, h.fields.impfstatus?.label]
                  .filter(Boolean).join(' · ') || undefined,
                icon: <IconDog size={20} className="text-primary" />,
              }))}
              onSelect={(id) => {
                setHundId(id);
                handleStepChange(3);
              }}
              searchPlaceholder={tx('Hund suchen …')}
              createLabel={tx('Neuen Hund anlegen')}
              onCreateNew={() => setShowCreateHund(true)}
              emptyText={tx('Noch kein Hund für diesen Besitzer erfasst')}
              createDialog={showCreateHund ? (
                <div className="rounded-2xl border bg-card p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">{tx('Neuen Hund anlegen')}</p>
                  {hError && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <IconAlertCircle size={16} className="shrink-0" />
                      {hError}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="h-name">{tx('Name')} *</Label>
                      <Input
                        id="h-name"
                        value={hName}
                        onChange={e => setHName(e.target.value)}
                        placeholder={tx('Name des Hundes')}
                        autoFocus
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
                    <div className="space-y-1">
                      <Label htmlFor="h-geschlecht">{tx('Geschlecht')}</Label>
                      <Select value={hGeschlecht} onValueChange={setHGeschlecht}>
                        <SelectTrigger id="h-geschlecht">
                          <SelectValue placeholder={tx('Bitte wählen')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{tx('Nicht angegeben')}</SelectItem>
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
                          <SelectValue placeholder={tx('Bitte wählen')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{tx('Nicht angegeben')}</SelectItem>
                          {IMPFSTATUS_OPTIONS.map(o => (
                            <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={!hName.trim() || hCreating}
                      onClick={handleCreateHund}
                    >
                      {hCreating ? tx('Wird angelegt …') : tx('Anlegen & weiter')}
                    </Button>
                    <Button variant="outline" onClick={() => { setShowCreateHund(false); setHError(null); }}>
                      {tx('Abbrechen')}
                    </Button>
                  </div>
                </div>
              ) : undefined}
            />
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Auswahl aus Schritt 1.')}
            </p>
            <Button variant="outline" onClick={() => handleStepChange(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}

      {/* ── Schritt 3: Buchungsdetails ───────────────────────────────────── */}
      {step === 3 && (
        besitzerId && hundId ? (
          successBuchungId ? (
            /* Erfolgsansicht */
            <div className="flex flex-col items-center text-center py-12 space-y-4">
              <div className="rounded-full bg-emerald-100 p-4">
                <IconCheck size={36} className="text-emerald-600" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">{tx('Buchung erfolgreich angelegt!')}</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                {tx('Die Buchung wurde gespeichert. Du kannst jetzt eine weitere Buchung anlegen oder zum Dashboard zurückkehren.')}
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Button onClick={handleReset}>{tx('Neue Buchung anlegen')}</Button>
                <Button variant="outline" asChild>
                  <a href="#/">{tx('Zurück zum Dashboard')}</a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-lg mx-auto">
              {/* Kontext-Chips */}
              <div className="flex flex-wrap gap-2">
                {selectedBesitzer && (
                  <span className="flex items-center gap-1.5 text-xs bg-secondary text-foreground rounded-full px-3 py-1">
                    <IconUser size={14} className="shrink-0 text-primary" />
                    {[selectedBesitzer.fields.vorname, selectedBesitzer.fields.nachname].filter(Boolean).join(' ')}
                  </span>
                )}
                {selectedHund && (
                  <span className="flex items-center gap-1.5 text-xs bg-secondary text-foreground rounded-full px-3 py-1">
                    <IconDog size={14} className="shrink-0 text-primary" />
                    {selectedHund.fields.name}
                    {selectedHund.fields.rasse ? ` · ${selectedHund.fields.rasse}` : ''}
                  </span>
                )}
              </div>

              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="anreise">
                      <span className="flex items-center gap-1.5">
                        <IconCalendar size={14} className="shrink-0" />
                        {tx('Anreise')} *
                      </span>
                    </Label>
                    <Input
                      id="anreise"
                      type="date"
                      value={anreise}
                      onChange={e => {
                        setAnreise(e.target.value);
                        if (abreise && e.target.value > abreise) setAbreise('');
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="abreise">
                      <span className="flex items-center gap-1.5">
                        <IconCalendar size={14} className="shrink-0" />
                        {tx('Abreise')} *
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

                {naechte > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {naechte === 1
                      ? tx('1 Übernachtung')
                      : `${naechte} ${tx('Übernachtungen')}`}
                  </p>
                )}

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
                  <Label htmlFor="preis">{tx('Gesamtpreis (€)')}</Label>
                  <Input
                    id="preis"
                    type="number"
                    min="0"
                    step="0.01"
                    value={preisGesamt}
                    onChange={e => setPreisGesamt(e.target.value)}
                    placeholder={tx('z. B. 280')}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="notizen">{tx('Interne Notizen')}</Label>
                  <Textarea
                    id="notizen"
                    value={interneNotizen}
                    onChange={e => setInterneNotizen(e.target.value)}
                    placeholder={tx('Besonderheiten, Fütterungszeiten, …')}
                    rows={3}
                  />
                </div>
              </div>

              {submitError && (
                <div className="flex items-center gap-2 text-sm text-destructive rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2">
                  <IconAlertCircle size={16} className="shrink-0" />
                  {submitError}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={!anreise || !abreise || platzKey === 'none' || submitting}
                  onClick={handleSubmit}
                  className="flex-1 sm:flex-none"
                >
                  {submitting ? tx('Wird gespeichert …') : tx('Buchung anlegen')}
                </Button>
                <Button variant="outline" onClick={() => handleStepChange(2)}>
                  {tx('Zurück')}
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Auswahl aus Schritt 1 und 2.')}
            </p>
            <Button variant="outline" onClick={() => handleStepChange(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
