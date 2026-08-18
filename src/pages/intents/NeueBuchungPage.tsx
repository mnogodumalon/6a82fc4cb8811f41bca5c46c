/**
 * Neue Buchung — 3-Schritt-Wizard.
 * Steps: 1) Besitzer wählen oder neu anlegen → 2) Hund wählen oder neu anlegen →
 *        3) Buchungsdetails (Zeitraum, Platz, Preis) erfassen & Buchung anlegen.
 * Reads: besitzer, hunde. Writes: besitzer (createBesitzerEntry), hunde (createHundeEntry),
 *        buchungen (createBuchungenEntry).
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IconDog, IconUser, IconCalendar, IconCheck } from '@tabler/icons-react';
import { differenceInDays, parseISO } from 'date-fns';

const PLATZ_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];
const GESCHLECHT_OPTIONS = LOOKUP_OPTIONS['hunde']?.['geschlecht'] ?? [];

export default function NeueBuchungPage() {
  const data = useDashboardData();
  const { besitzer, hunde, loading, error, fetchAll } = data;

  // Wizard state
  const [step, setStep] = useState(1);
  const [selectedBesitzerId, setSelectedBesitzerId] = useState<string | null>(null);
  const [selectedHundId, setSelectedHundId] = useState<string | null>(null);
  const [buchungErfolgreich, setBuchungErfolgreich] = useState(false);

  // Step 1: Besitzer neu anlegen
  const [showCreateBesitzer, setShowCreateBesitzer] = useState(false);
  const [neuVorname, setNeuVorname] = useState('');
  const [neuNachname, setNeuNachname] = useState('');
  const [neuTelefon, setNeuTelefon] = useState('');
  const [neuEmail, setNeuEmail] = useState('');
  const [besitzerSaving, setBesitzerSaving] = useState(false);

  // Step 2: Hund neu anlegen
  const [showCreateHund, setShowCreateHund] = useState(false);
  const [hundName, setHundName] = useState('');
  const [hundRasse, setHundRasse] = useState('');
  const [hundGeschlecht, setHundGeschlecht] = useState('none');
  const [hundGeburtsdatum, setHundGeburtsdatum] = useState('');
  const [hundSaving, setHundSaving] = useState(false);

  // Step 3: Buchungsdetails
  const [anreise, setAnreise] = useState('');
  const [abreise, setAbreise] = useState('');
  const [platzKey, setPlatzKey] = useState('none');
  const [preisGesamt, setPreisGesamt] = useState('');
  const [interneNotizen, setInterneNotizen] = useState('');
  const [buchungSaving, setBuchungSaving] = useState(false);
  const [buchungError, setBuchungError] = useState<string | null>(null);

  // --- Step 1: Besitzer anlegen ---
  const handleCreateBesitzer = async () => {
    if (!neuVorname.trim() || !neuNachname.trim()) return;
    setBesitzerSaving(true);
    try {
      const result = await LivingAppsService.createBesitzerEntry({
        vorname: neuVorname.trim(),
        nachname: neuNachname.trim(),
        telefon: neuTelefon.trim() || undefined,
        email: neuEmail.trim() || undefined,
      });
      await fetchAll();
      setShowCreateBesitzer(false);
      setNeuVorname('');
      setNeuNachname('');
      setNeuTelefon('');
      setNeuEmail('');
      setSelectedBesitzerId(result.record_id);
      setStep(2);
    } finally {
      setBesitzerSaving(false);
    }
  };

  // --- Step 2: Hund anlegen ---
  const handleCreateHund = async () => {
    if (!hundName.trim() || !selectedBesitzerId) return;
    setHundSaving(true);
    try {
      const result = await LivingAppsService.createHundeEntry({
        name: hundName.trim(),
        rasse: hundRasse.trim() || undefined,
        geschlecht: hundGeschlecht !== 'none' ? hundGeschlecht : undefined,
        geburtsdatum: hundGeburtsdatum || undefined,
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
      });
      await fetchAll();
      setShowCreateHund(false);
      setHundName('');
      setHundRasse('');
      setHundGeschlecht('none');
      setHundGeburtsdatum('');
      setSelectedHundId(result.record_id);
      setStep(3);
    } finally {
      setHundSaving(false);
    }
  };

  // --- Step 3: Buchung anlegen ---
  const handleCreateBuchung = async () => {
    if (!selectedBesitzerId || !selectedHundId || !anreise || !abreise || platzKey === 'none') return;
    setBuchungSaving(true);
    setBuchungError(null);
    try {
      await LivingAppsService.createBuchungenEntry({
        hund: createRecordUrl(APP_IDS.HUNDE, selectedHundId),
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
        anreise,
        abreise,
        platz: platzKey,
        preis_gesamt: preisGesamt ? parseFloat(preisGesamt) : undefined,
        interne_notizen: interneNotizen.trim() || undefined,
        status: 'geplant',
      });
      setBuchungErfolgreich(true);
    } catch {
      setBuchungError(tx('Buchung konnte nicht angelegt werden. Bitte erneut versuchen.'));
    } finally {
      setBuchungSaving(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedBesitzerId(null);
    setSelectedHundId(null);
    setBuchungErfolgreich(false);
    setAnreise('');
    setAbreise('');
    setPlatzKey('none');
    setPreisGesamt('');
    setInterneNotizen('');
    setBuchungError(null);
    setShowCreateBesitzer(false);
    setShowCreateHund(false);
  };

  // Filtered hunde for step 2
  const hundeDesBesitzers = selectedBesitzerId
    ? hunde.filter(h => extractRecordId(h.fields.besitzer) === selectedBesitzerId)
    : [];

  // Besitzer display name
  const gewahlterBesitzer = selectedBesitzerId
    ? besitzer.find(b => b.record_id === selectedBesitzerId)
    : null;
  const gewahlterHund = selectedHundId
    ? hunde.find(h => h.record_id === selectedHundId)
    : null;

  // Nächte berechnen
  const naechte =
    anreise && abreise
      ? Math.max(0, differenceInDays(parseISO(abreise), parseISO(anreise)))
      : 0;

  // Success screen
  if (buchungErfolgreich) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-emerald-100 p-4">
            <IconCheck size={40} className="text-emerald-600" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">{tx('Buchung erfolgreich angelegt!')}</h2>
          <p className="text-muted-foreground">
            {gewahlterHund?.fields.name ?? tx('Hund')}
            {' — '}
            {gewahlterBesitzer
              ? `${gewahlterBesitzer.fields.vorname ?? ''} ${gewahlterBesitzer.fields.nachname ?? ''}`.trim()
              : ''}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={handleReset} variant="default">
            {tx('Neue Buchung anlegen')}
          </Button>
          <a href="#/">
            <Button variant="outline">{tx('Zurück zum Dashboard')}</Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <IntentWizardShell
      title={tx('Neue Buchung')}
      subtitle={tx('Buchung in 3 Schritten anlegen')}
      steps={[
        { label: tx('Besitzer') },
        { label: tx('Hund') },
        { label: tx('Details') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Schritt 1: Besitzer wählen ── */}
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
          onCreateNew={() => setShowCreateBesitzer(true)}
          createDialog={showCreateBesitzer && (
            <div className="rounded-2xl border bg-card p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">{tx('Neuer Besitzer')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="b-vorname">{tx('Vorname')} *</Label>
                  <Input
                    id="b-vorname"
                    value={neuVorname}
                    onChange={e => setNeuVorname(e.target.value)}
                    placeholder={tx('Vorname')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="b-nachname">{tx('Nachname')} *</Label>
                  <Input
                    id="b-nachname"
                    value={neuNachname}
                    onChange={e => setNeuNachname(e.target.value)}
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
                    value={neuTelefon}
                    onChange={e => setNeuTelefon(e.target.value)}
                    placeholder={tx('Telefonnummer')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="b-email">{tx('E-Mail')}</Label>
                  <Input
                    id="b-email"
                    type="email"
                    value={neuEmail}
                    onChange={e => setNeuEmail(e.target.value)}
                    placeholder={tx('E-Mail-Adresse')}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  disabled={!neuVorname.trim() || !neuNachname.trim() || besitzerSaving}
                  onClick={handleCreateBesitzer}
                >
                  {besitzerSaving ? tx('Wird angelegt …') : tx('Anlegen & weiter')}
                </Button>
                <Button variant="outline" onClick={() => setShowCreateBesitzer(false)}>
                  {tx('Abbrechen')}
                </Button>
              </div>
            </div>
          )}
          emptyText={tx('Kein Besitzer gefunden')}
        />
      )}

      {/* ── Schritt 2: Hund wählen ── */}
      {step === 2 && (
        selectedBesitzerId ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconUser size={16} className="shrink-0" />
              <span>
                {tx('Besitzer')}:{' '}
                <span className="font-medium text-foreground">
                  {gewahlterBesitzer
                    ? `${gewahlterBesitzer.fields.vorname ?? ''} ${gewahlterBesitzer.fields.nachname ?? ''}`.trim()
                    : selectedBesitzerId}
                </span>
              </span>
              <button
                className="ml-auto text-xs underline text-muted-foreground"
                onClick={() => { setSelectedBesitzerId(null); setStep(1); }}
              >
                {tx('Ändern')}
              </button>
            </div>
            <EntitySelectStep
              items={hundeDesBesitzers.map(h => ({
                id: h.record_id,
                title: h.fields.name ?? h.record_id,
                subtitle: [h.fields.rasse, h.fields.geschlecht?.label].filter(Boolean).join(' · '),
                icon: <IconDog size={20} className="text-primary" />,
              }))}
              onSelect={(id) => {
                setSelectedHundId(id);
                setStep(3);
              }}
              searchPlaceholder={tx('Hund suchen …')}
              createLabel={tx('Neuen Hund anlegen')}
              onCreateNew={() => setShowCreateHund(true)}
              createDialog={showCreateHund && (
                <div className="rounded-2xl border bg-card p-4 space-y-3">
                  <p className="text-sm font-medium text-foreground">{tx('Neuer Hund')}</p>
                  <div className="space-y-1">
                    <Label htmlFor="h-name">{tx('Name')} *</Label>
                    <Input
                      id="h-name"
                      value={hundName}
                      onChange={e => setHundName(e.target.value)}
                      placeholder={tx('Name des Hundes')}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="h-rasse">{tx('Rasse')}</Label>
                    <Input
                      id="h-rasse"
                      value={hundRasse}
                      onChange={e => setHundRasse(e.target.value)}
                      placeholder={tx('z.B. Labrador, Mischling')}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>{tx('Geschlecht')}</Label>
                      <Select value={hundGeschlecht} onValueChange={setHundGeschlecht}>
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
                      <Label htmlFor="h-geburtsdatum">{tx('Geburtsdatum')}</Label>
                      <Input
                        id="h-geburtsdatum"
                        type="date"
                        value={hundGeburtsdatum}
                        onChange={e => setHundGeburtsdatum(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button
                      disabled={!hundName.trim() || hundSaving}
                      onClick={handleCreateHund}
                    >
                      {hundSaving ? tx('Wird angelegt …') : tx('Anlegen & weiter')}
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateHund(false)}>
                      {tx('Abbrechen')}
                    </Button>
                  </div>
                </div>
              )}
              emptyText={tx('Noch kein Hund für diesen Besitzer — einfach einen anlegen')}
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

      {/* ── Schritt 3: Buchungsdetails ── */}
      {step === 3 && (
        selectedBesitzerId && selectedHundId ? (
          <div className="space-y-6">
            {/* Zusammenfassung der Vorauswahl */}
            <div className="rounded-2xl border bg-secondary/40 p-4 flex flex-col sm:flex-row gap-3 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <IconUser size={16} className="shrink-0 text-muted-foreground" />
                <span className="truncate font-medium">
                  {gewahlterBesitzer
                    ? `${gewahlterBesitzer.fields.vorname ?? ''} ${gewahlterBesitzer.fields.nachname ?? ''}`.trim()
                    : selectedBesitzerId}
                </span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <IconDog size={16} className="shrink-0 text-muted-foreground" />
                <span className="truncate font-medium">
                  {gewahlterHund?.fields.name ?? selectedHundId}
                  {gewahlterHund?.fields.rasse ? ` · ${gewahlterHund.fields.rasse}` : ''}
                </span>
              </div>
            </div>

            {/* Formular */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              {naechte > 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconCalendar size={16} className="shrink-0" />
                  <span>{naechte} {naechte === 1 ? tx('Nacht') : tx('Nächte')}</span>
                </div>
              )}

              <div className="space-y-1">
                <Label>{tx('Platz')} *</Label>
                <Select value={platzKey} onValueChange={setPlatzKey}>
                  <SelectTrigger>
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
                  placeholder={tx('z.B. 150.00')}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="notizen">{tx('Interne Notizen')}</Label>
                <textarea
                  id="notizen"
                  className="w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  value={interneNotizen}
                  onChange={e => setInterneNotizen(e.target.value)}
                  placeholder={tx('Besonderheiten, Hinweise …')}
                />
              </div>
            </div>

            {buchungError && (
              <p className="text-sm text-destructive">{buchungError}</p>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                disabled={!anreise || !abreise || platzKey === 'none' || buchungSaving}
                onClick={handleCreateBuchung}
                className="sm:w-auto w-full"
              >
                {buchungSaving ? tx('Buchung wird angelegt …') : tx('Buchung anlegen')}
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="sm:w-auto w-full"
              >
                {tx('Zurück')}
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
