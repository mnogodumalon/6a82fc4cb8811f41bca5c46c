/**
 * Neue Buchung — 3-Schritt-Wizard.
 * Steps: 1) Besitzer wählen oder neu anlegen → 2) Hund wählen oder neu anlegen (gefiltert auf gewählten Besitzer)
 *        → 3) Zeitraum & Platz festlegen → Buchung anlegen.
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { IconUser, IconDog, IconCalendar, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { differenceInDays, parseISO } from 'date-fns';

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
  const [bSaving, setBSaving] = useState(false);
  const [bError, setBError] = useState('');

  // Step 2 — Hund
  const [selectedHundId, setSelectedHundId] = useState<string | null>(null);
  const [showCreateHund, setShowCreateHund] = useState(false);
  const [hName, setHName] = useState('');
  const [hRasse, setHRasse] = useState('');
  const [hGeschlecht, setHGeschlecht] = useState('none');
  const [hGewicht, setHGewicht] = useState('');
  const [hSaving, setHSaving] = useState(false);
  const [hError, setHError] = useState('');

  // Step 3 — Zeitraum & Platz
  const [anreise, setAnreise] = useState('');
  const [abreise, setAbreise] = useState('');
  const [platz, setPlatz] = useState('none');
  const [preisGesamt, setPreisGesamt] = useState('');
  const [interneNotizen, setInterneNotizen] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSelectBesitzer = (id: string) => {
    setSelectedBesitzerId(id);
    setSelectedHundId(null);
    setStep(2);
  };

  const handleCreateBesitzer = async () => {
    if (!bVorname.trim() || !bNachname.trim()) return;
    setBSaving(true);
    setBError('');
    try {
      const result = await LivingAppsService.createBesitzerEntry({
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
      setSelectedBesitzerId(result.record_id);
      setSelectedHundId(null);
      setStep(2);
    } catch {
      setBError(tx('Fehler beim Anlegen des Besitzers. Bitte erneut versuchen.'));
    } finally {
      setBSaving(false);
    }
  };

  const handleSelectHund = (id: string) => {
    setSelectedHundId(id);
    setStep(3);
  };

  const handleCreateHund = async () => {
    if (!hName.trim() || !selectedBesitzerId) return;
    setHSaving(true);
    setHError('');
    try {
      const payload: Parameters<typeof LivingAppsService.createHundeEntry>[0] = {
        name: hName.trim(),
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
      };
      if (hRasse.trim()) payload.rasse = hRasse.trim();
      if (hGeschlecht && hGeschlecht !== 'none') payload.geschlecht = hGeschlecht;
      if (hGewicht) payload.gewicht_kg = parseFloat(hGewicht);
      const result = await LivingAppsService.createHundeEntry(payload);
      await fetchAll();
      setShowCreateHund(false);
      setHName('');
      setHRasse('');
      setHGeschlecht('none');
      setHGewicht('');
      setSelectedHundId(result.record_id);
      setStep(3);
    } catch {
      setHError(tx('Fehler beim Anlegen des Hundes. Bitte erneut versuchen.'));
    } finally {
      setHSaving(false);
    }
  };

  const handleCreateBuchung = async () => {
    if (!selectedBesitzerId || !selectedHundId || !anreise || !abreise || platz === 'none') return;
    setSaving(true);
    setSaveError('');
    try {
      await LivingAppsService.createBuchungenEntry({
        hund: createRecordUrl(APP_IDS.HUNDE, selectedHundId),
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
        anreise,
        abreise,
        platz,
        status: 'geplant',
        preis_gesamt: preisGesamt ? parseFloat(preisGesamt) : undefined,
        interne_notizen: interneNotizen.trim() || undefined,
      });
      setSuccess(true);
    } catch {
      setSaveError(tx('Fehler beim Anlegen der Buchung. Bitte erneut versuchen.'));
    } finally {
      setSaving(false);
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
    setBError('');
    setHName('');
    setHRasse('');
    setHGeschlecht('none');
    setHGewicht('');
    setHError('');
    setAnreise('');
    setAbreise('');
    setPlatz('none');
    setPreisGesamt('');
    setInterneNotizen('');
    setSaveError('');
    setSuccess(false);
  };

  const selectedBesitzer = besitzer.find(b => b.record_id === selectedBesitzerId);
  const selectedHund = hunde.find(h => h.record_id === selectedHundId);
  const hundeForBesitzer = selectedBesitzerId
    ? hunde.filter(h => extractRecordId(h.fields.besitzer) === selectedBesitzerId)
    : [];

  const nachtCount =
    anreise && abreise
      ? Math.max(0, differenceInDays(parseISO(abreise), parseISO(anreise)))
      : 0;

  const step3Valid =
    !!anreise && !!abreise && platz !== 'none' && nachtCount > 0;

  if (success) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full bg-emerald-100 p-4">
            <IconCheck size={40} className="text-emerald-600" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          {tx('Buchung erfolgreich angelegt!')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {selectedHund?.fields.name && selectedBesitzer
            ? tx`${selectedHund.fields.name} (${selectedBesitzer.fields.vorname ?? ''} ${selectedBesitzer.fields.nachname ?? ''}) ist für ${String(nachtCount)} ${nachtCount === 1 ? tx('Nacht') : tx('Nächte')} gebucht.`
            : tx('Die Buchung wurde erfolgreich gespeichert.')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={handleReset}>
            {tx('Neue Buchung anlegen')}
          </Button>
          <Button variant="outline" asChild>
            <a href="#/">{tx('Zurück zum Dashboard')}</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <IntentWizardShell
      title={tx('Neue Buchung')}
      subtitle={tx('Besitzer, Hund und Zeitraum in drei Schritten erfassen')}
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
      {/* ── Step 1: Besitzer wählen ── */}
      {step === 1 && (
        <EntitySelectStep
          items={besitzer.map(b => ({
            id: b.record_id,
            title: [b.fields.vorname, b.fields.nachname].filter(Boolean).join(' ') || b.record_id,
            subtitle: [b.fields.telefon, b.fields.email].filter(Boolean).join(' · ') || undefined,
            icon: <IconUser size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectBesitzer}
          searchPlaceholder={tx('Besitzer suchen …')}
          createLabel={tx('Neuen Besitzer anlegen')}
          onCreateNew={() => { setShowCreateBesitzer(true); setBError(''); }}
          emptyText={tx('Noch keine Besitzer. Lege den ersten an.')}
          emptyIcon={<IconUser size={32} className="text-muted-foreground" />}
          createDialog={showCreateBesitzer && (
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <p className="text-sm font-medium text-foreground">{tx('Neuen Besitzer anlegen')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{tx('Vorname')} *</Label>
                  <Input
                    value={bVorname}
                    onChange={e => setBVorname(e.target.value)}
                    placeholder={tx('Vorname')}
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{tx('Nachname')} *</Label>
                  <Input
                    value={bNachname}
                    onChange={e => setBNachname(e.target.value)}
                    placeholder={tx('Nachname')}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{tx('Telefon')}</Label>
                  <Input
                    type="tel"
                    value={bTelefon}
                    onChange={e => setBTelefon(e.target.value)}
                    placeholder={tx('Telefonnummer')}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{tx('E-Mail')}</Label>
                  <Input
                    type="email"
                    value={bEmail}
                    onChange={e => setBEmail(e.target.value)}
                    placeholder={tx('E-Mail-Adresse')}
                  />
                </div>
              </div>
              {bError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <IconAlertCircle size={14} className="shrink-0" />
                  {bError}
                </p>
              )}
              <div className="flex gap-2 flex-wrap">
                <Button
                  disabled={!bVorname.trim() || !bNachname.trim() || bSaving}
                  onClick={handleCreateBesitzer}
                >
                  {bSaving ? tx('Speichern …') : tx('Anlegen & auswählen')}
                </Button>
                <Button variant="outline" onClick={() => { setShowCreateBesitzer(false); setBError(''); }}>
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
              <div className="flex items-center gap-2 px-1">
                <IconUser size={14} className="text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">
                  {tx('Besitzer')}: <span className="text-foreground font-medium">
                    {[selectedBesitzer.fields.vorname, selectedBesitzer.fields.nachname].filter(Boolean).join(' ')}
                  </span>
                </span>
                <Button variant="ghost" size="sm" className="ml-auto text-xs h-7" onClick={() => setStep(1)}>
                  {tx('Ändern')}
                </Button>
              </div>
            )}
            <EntitySelectStep
              items={hundeForBesitzer.map(h => ({
                id: h.record_id,
                title: h.fields.name ?? h.record_id,
                subtitle: [h.fields.rasse, h.fields.geschlecht?.label].filter(Boolean).join(' · ') || undefined,
                icon: <IconDog size={20} className="text-primary" />,
              }))}
              onSelect={handleSelectHund}
              searchPlaceholder={tx('Hund suchen …')}
              createLabel={tx('Neuen Hund anlegen')}
              onCreateNew={() => { setShowCreateHund(true); setHError(''); }}
              emptyText={
                hundeForBesitzer.length === 0
                  ? tx('Noch keine Hunde für diesen Besitzer. Lege den ersten an.')
                  : tx('Kein Hund gefunden.')
              }
              emptyIcon={<IconDog size={32} className="text-muted-foreground" />}
              createDialog={showCreateHund && (
                <div className="rounded-2xl border bg-card p-5 space-y-4">
                  <p className="text-sm font-medium text-foreground">{tx('Neuen Hund anlegen')}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{tx('Name')} *</Label>
                      <Input
                        value={hName}
                        onChange={e => setHName(e.target.value)}
                        placeholder={tx('Hundename')}
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{tx('Rasse')}</Label>
                      <Input
                        value={hRasse}
                        onChange={e => setHRasse(e.target.value)}
                        placeholder={tx('Rasse (optional)')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{tx('Geschlecht')}</Label>
                      <Select value={hGeschlecht} onValueChange={setHGeschlecht}>
                        <SelectTrigger>
                          <SelectValue placeholder={tx('Geschlecht wählen')} />
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
                      <Label className="text-xs text-muted-foreground">{tx('Gewicht (kg)')}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={hGewicht}
                        onChange={e => setHGewicht(e.target.value)}
                        placeholder={tx('z.B. 12.5')}
                      />
                    </div>
                  </div>
                  {hError && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <IconAlertCircle size={14} className="shrink-0" />
                      {hError}
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      disabled={!hName.trim() || hSaving}
                      onClick={handleCreateHund}
                    >
                      {hSaving ? tx('Speichern …') : tx('Anlegen & auswählen')}
                    </Button>
                    <Button variant="outline" onClick={() => { setShowCreateHund(false); setHError(''); }}>
                      {tx('Abbrechen')}
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

      {/* ── Step 3: Zeitraum & Platz ── */}
      {step === 3 && (
        selectedBesitzerId && selectedHundId ? (
          <div className="space-y-6 max-w-xl">
            {/* Context bar */}
            <div className="rounded-xl border bg-secondary/40 px-4 py-3 flex flex-wrap gap-3 text-sm">
              <span className="flex items-center gap-1 text-muted-foreground">
                <IconUser size={14} className="shrink-0" />
                {[selectedBesitzer?.fields.vorname, selectedBesitzer?.fields.nachname].filter(Boolean).join(' ')}
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span className="flex items-center gap-1 text-muted-foreground">
                <IconDog size={14} className="shrink-0" />
                {selectedHund?.fields.name}
              </span>
              <Button variant="ghost" size="sm" className="ml-auto text-xs h-7" onClick={() => setStep(2)}>
                {tx('Ändern')}
              </Button>
            </div>

            {/* Date range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1">
                  <IconCalendar size={14} className="shrink-0 text-muted-foreground" />
                  {tx('Anreise')} *
                </Label>
                <Input
                  type="date"
                  value={anreise}
                  onChange={e => {
                    setAnreise(e.target.value);
                    if (abreise && e.target.value >= abreise) setAbreise('');
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1">
                  <IconCalendar size={14} className="shrink-0 text-muted-foreground" />
                  {tx('Abreise')} *
                </Label>
                <Input
                  type="date"
                  value={abreise}
                  min={anreise || undefined}
                  onChange={e => setAbreise(e.target.value)}
                />
              </div>
            </div>

            {/* Night count info */}
            {nachtCount > 0 && (
              <p className="text-sm text-muted-foreground -mt-2">
                {tx`${String(nachtCount)} ${nachtCount === 1 ? tx('Nacht') : tx('Nächte')}`}
              </p>
            )}

            {/* Platz */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{tx('Platz')} *</Label>
              <Select value={platz} onValueChange={setPlatz}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder={tx('Platz wählen')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tx('Bitte wählen …')}</SelectItem>
                  {PLATZ_OPTIONS.map(o => (
                    <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Optional fields */}
            <div className="space-y-4 border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {tx('Optional')}
              </p>
              <div className="space-y-1.5">
                <Label className="text-sm">{tx('Preis gesamt (€)')}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={preisGesamt}
                  onChange={e => setPreisGesamt(e.target.value)}
                  placeholder={tx('z.B. 280.00')}
                  className="w-full sm:w-48"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{tx('Interne Notizen')}</Label>
                <Textarea
                  value={interneNotizen}
                  onChange={e => setInterneNotizen(e.target.value)}
                  placeholder={tx('Hinweise für die Betreuung …')}
                  rows={3}
                />
              </div>
            </div>

            {/* Error */}
            {saveError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <IconAlertCircle size={14} className="shrink-0" />
                {saveError}
              </p>
            )}

            {/* Submit */}
            <div className="flex gap-3 flex-wrap">
              <Button
                disabled={!step3Valid || saving}
                onClick={handleCreateBuchung}
                size="lg"
              >
                {saving ? tx('Buchung wird angelegt …') : tx('Buchung anlegen')}
              </Button>
              <Button variant="outline" size="lg" asChild>
                <a href="#/">{tx('Abbrechen')}</a>
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
