/**
 * Neue Aufenthaltsbuchung — 3-Schritt-Wizard.
 * Steps: 1) Besitzer auswählen oder neu anlegen →
 *        2) Hund auswählen (gefiltert nach Besitzer) oder neu anlegen →
 *        3) Zeitraum & Platz festlegen → Buchung speichern.
 * Reads: besitzer, hunde. Writes: besitzer (createBesitzerEntry),
 *        hunde (createHundeEntry), buchungen (createBuchungenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState } from 'react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { IconUser, IconDog, IconCalendar, IconCheck, IconPlus } from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { tx } from '@/i18n';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const PLATZ_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];
const GESCHLECHT_OPTIONS = LOOKUP_OPTIONS['hunde']?.['geschlecht'] ?? [];

export default function NeueBuchungPage() {
  const data = useDashboardData();
  const { besitzer, hunde, loading, error, fetchAll } = data;

  // Wizard step
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

  // Step 3 — Buchungsdetails
  const [anreise, setAnreise] = useState('');
  const [abreise, setAbreise] = useState('');
  const [platzKey, setPlatzKey] = useState('none');
  const [preisGesamt, setPreisGesamt] = useState('');
  const [interneNotizen, setInterneNotizen] = useState('');
  const [buchungSaving, setBuchungSaving] = useState(false);
  const [buchungError, setBuchungError] = useState('');

  // Success
  const [successBuchungId, setSuccessBuchungId] = useState<string | null>(null);

  // ---------------------------------------------------------------
  // Step 1 handlers
  // ---------------------------------------------------------------
  const handleSelectBesitzer = (id: string) => {
    setSelectedBesitzerId(id);
    setSelectedHundId(null);
    setStep(2);
  };

  const handleCreateBesitzer = async () => {
    if (!bVorname.trim() || !bNachname.trim() || !bTelefon.trim()) return;
    setBSaving(true);
    setBError('');
    try {
      const created = await LivingAppsService.createBesitzerEntry({
        vorname: bVorname.trim(),
        nachname: bNachname.trim(),
        telefon: bTelefon.trim(),
        email: bEmail.trim() || undefined,
      });
      await fetchAll();
      setShowCreateBesitzer(false);
      setBVorname('');
      setBNachname('');
      setBTelefon('');
      setBEmail('');
      setSelectedBesitzerId(created.record_id);
      setSelectedHundId(null);
      setStep(2);
    } catch {
      setBError(tx('Fehler beim Anlegen des Besitzers. Bitte erneut versuchen.'));
    } finally {
      setBSaving(false);
    }
  };

  // ---------------------------------------------------------------
  // Step 2 handlers
  // ---------------------------------------------------------------
  const filteredHunde = selectedBesitzerId
    ? hunde.filter(h => extractRecordId(h.fields.besitzer) === selectedBesitzerId)
    : [];

  const handleSelectHund = (id: string) => {
    setSelectedHundId(id);
    setStep(3);
  };

  const handleCreateHund = async () => {
    if (!hName.trim() || !selectedBesitzerId) return;
    setHSaving(true);
    setHError('');
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
    } catch {
      setHError(tx('Fehler beim Anlegen des Hundes. Bitte erneut versuchen.'));
    } finally {
      setHSaving(false);
    }
  };

  // ---------------------------------------------------------------
  // Step 3 handlers
  // ---------------------------------------------------------------
  const naechteDiff =
    anreise && abreise
      ? differenceInDays(parseISO(abreise), parseISO(anreise))
      : null;

  const handleCreateBuchung = async () => {
    if (!selectedBesitzerId || !selectedHundId || !anreise || !abreise || platzKey === 'none') return;
    setBuchungSaving(true);
    setBuchungError('');
    try {
      const created = await LivingAppsService.createBuchungenEntry({
        hund: createRecordUrl(APP_IDS.HUNDE, selectedHundId),
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
        anreise,
        abreise,
        platz: platzKey,
        preis_gesamt: preisGesamt ? parseFloat(preisGesamt) : undefined,
        status: 'geplant',
        zahlungsstatus: 'offen',
        interne_notizen: interneNotizen.trim() || undefined,
      });
      await fetchAll();
      setSuccessBuchungId(created.record_id);
      setStep(4);
    } catch {
      setBuchungError(tx('Fehler beim Speichern der Buchung. Bitte erneut versuchen.'));
    } finally {
      setBuchungSaving(false);
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
    setHGewicht('');
    setAnreise('');
    setAbreise('');
    setPlatzKey('none');
    setPreisGesamt('');
    setInterneNotizen('');
    setSuccessBuchungId(null);
    setBuchungError('');
  };

  // ---------------------------------------------------------------
  // Derived display data
  // ---------------------------------------------------------------
  const selectedBesitzer = selectedBesitzerId
    ? besitzer.find(b => b.record_id === selectedBesitzerId)
    : null;
  const selectedHund = selectedHundId
    ? hunde.find(h => h.record_id === selectedHundId)
    : null;
  const selectedPlatzLabel =
    PLATZ_OPTIONS.find(p => p.key === platzKey)?.label ?? platzKey;

  // ---------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------
  return (
    <IntentWizardShell
      title={tx('Neue Buchung anlegen')}
      subtitle={tx('In 3 Schritten zur fertigen Aufenthaltsbuchung')}
      steps={[
        { label: tx('Besitzer') },
        { label: tx('Hund') },
        { label: tx('Buchung') },
        { label: tx('Fertig') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ============================================================
          SCHRITT 1 — Besitzer auswählen oder neu anlegen
      ============================================================ */}
      {step === 1 && (
        <EntitySelectStep
          items={besitzer.map(b => ({
            id: b.record_id,
            title: `${b.fields.vorname ?? ''} ${b.fields.nachname ?? ''}`.trim() || b.record_id,
            subtitle: [b.fields.telefon, b.fields.email].filter(Boolean).join(' · '),
            icon: <IconUser size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectBesitzer}
          searchPlaceholder={tx('Name oder Telefon suchen …')}
          createLabel={tx('Neuen Besitzer anlegen')}
          onCreateNew={() => { setShowCreateBesitzer(true); setBError(''); }}
          emptyText={tx('Noch kein Besitzer gefunden.')}
          emptyIcon={<IconUser size={32} className="text-muted-foreground" />}
          createDialog={showCreateBesitzer && (
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <p className="text-sm font-medium text-foreground">
                {tx('Neuen Besitzer anlegen')}
              </p>
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
                  <Label htmlFor="b-telefon">{tx('Telefon')} *</Label>
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
              {bError && (
                <p className="text-sm text-destructive">{bError}</p>
              )}
              <div className="flex gap-2 flex-wrap">
                <Button
                  disabled={!bVorname.trim() || !bNachname.trim() || !bTelefon.trim() || bSaving}
                  onClick={handleCreateBesitzer}
                >
                  <IconPlus size={16} className="shrink-0 mr-1" />
                  {bSaving ? tx('Wird angelegt …') : tx('Besitzer anlegen')}
                </Button>
                <Button variant="ghost" onClick={() => setShowCreateBesitzer(false)}>
                  {tx('Abbrechen')}
                </Button>
              </div>
            </div>
          )}
        />
      )}

      {/* ============================================================
          SCHRITT 2 — Hund auswählen oder neu anlegen
      ============================================================ */}
      {step === 2 && (
        selectedBesitzerId ? (
          <div className="space-y-4">
            {/* Gewählter Besitzer als Kontext */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-sm text-muted-foreground">
              <IconUser size={16} className="shrink-0 text-primary" />
              <span>
                {tx('Besitzer')}: <span className="font-medium text-foreground">
                  {selectedBesitzer
                    ? `${selectedBesitzer.fields.vorname ?? ''} ${selectedBesitzer.fields.nachname ?? ''}`.trim()
                    : selectedBesitzerId}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-xs h-6 px-2"
                onClick={() => { setSelectedBesitzerId(null); setStep(1); }}
              >
                {tx('Ändern')}
              </Button>
            </div>

            <EntitySelectStep
              items={filteredHunde.map(h => ({
                id: h.record_id,
                title: h.fields.name ?? h.record_id,
                subtitle: [
                  h.fields.rasse,
                  h.fields.geschlecht?.label,
                  h.fields.gewicht_kg != null ? `${h.fields.gewicht_kg} kg` : undefined,
                ].filter(Boolean).join(' · '),
                icon: <IconDog size={20} className="text-primary" />,
              }))}
              onSelect={handleSelectHund}
              searchPlaceholder={tx('Hund suchen …')}
              createLabel={tx('Neuen Hund anlegen')}
              onCreateNew={() => { setShowCreateHund(true); setHError(''); }}
              emptyText={filteredHunde.length === 0
                ? tx('Noch kein Hund für diesen Besitzer. Lege jetzt einen an.')
                : tx('Kein Hund gefunden.')}
              emptyIcon={<IconDog size={32} className="text-muted-foreground" />}
              createDialog={showCreateHund && (
                <div className="rounded-2xl border bg-card p-5 space-y-4">
                  <p className="text-sm font-medium text-foreground">
                    {tx('Neuen Hund anlegen')}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="h-name">{tx('Name')} *</Label>
                      <Input
                        id="h-name"
                        value={hName}
                        onChange={e => setHName(e.target.value)}
                        placeholder={tx('Name des Hundes')}
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
                  {hError && (
                    <p className="text-sm text-destructive">{hError}</p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      disabled={!hName.trim() || hSaving}
                      onClick={handleCreateHund}
                    >
                      <IconPlus size={16} className="shrink-0 mr-1" />
                      {hSaving ? tx('Wird angelegt …') : tx('Hund anlegen')}
                    </Button>
                    <Button variant="ghost" onClick={() => setShowCreateHund(false)}>
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

      {/* ============================================================
          SCHRITT 3 — Zeitraum & Platz festlegen
      ============================================================ */}
      {step === 3 && (
        selectedBesitzerId && selectedHundId ? (
          <div className="space-y-6">
            {/* Kontext-Chips */}
            <div className="flex flex-wrap gap-2 text-sm">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary text-muted-foreground">
                <IconUser size={14} className="shrink-0 text-primary" />
                <span className="font-medium text-foreground">
                  {selectedBesitzer
                    ? `${selectedBesitzer.fields.vorname ?? ''} ${selectedBesitzer.fields.nachname ?? ''}`.trim()
                    : selectedBesitzerId}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1 text-xs ml-1"
                  onClick={() => { setSelectedBesitzerId(null); setSelectedHundId(null); setStep(1); }}
                >
                  {tx('Ändern')}
                </Button>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary text-muted-foreground">
                <IconDog size={14} className="shrink-0 text-primary" />
                <span className="font-medium text-foreground">
                  {selectedHund?.fields.name ?? selectedHundId}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1 text-xs ml-1"
                  onClick={() => { setSelectedHundId(null); setStep(2); }}
                >
                  {tx('Ändern')}
                </Button>
              </div>
            </div>

            {/* Buchungsformular */}
            <div className="rounded-2xl border bg-card p-5 space-y-5">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <IconCalendar size={18} className="shrink-0 text-primary" />
                {tx('Aufenthaltsdaten')}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="buch-anreise">{tx('Anreise')} *</Label>
                  <Input
                    id="buch-anreise"
                    type="date"
                    value={anreise}
                    onChange={e => setAnreise(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="buch-abreise">{tx('Abreise')} *</Label>
                  <Input
                    id="buch-abreise"
                    type="date"
                    value={abreise}
                    min={anreise || undefined}
                    onChange={e => setAbreise(e.target.value)}
                  />
                </div>
              </div>

              {/* Aufenthaltsdauer-Hinweis */}
              {naechteDiff !== null && naechteDiff > 0 && (
                <p className="text-sm text-muted-foreground">
                  {tx('Aufenthalt')}: <span className="font-medium text-foreground">
                    {naechteDiff} {naechteDiff === 1 ? tx('Nacht') : tx('Nächte')}
                  </span>
                  {' '}({format(parseISO(anreise), 'dd.MM.')} – {format(parseISO(abreise), 'dd.MM.yyyy')})
                </p>
              )}
              {naechteDiff !== null && naechteDiff <= 0 && abreise && anreise && (
                <p className="text-sm text-destructive">
                  {tx('Abreise muss nach der Anreise liegen.')}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="buch-platz">{tx('Platz')} *</Label>
                  <Select value={platzKey} onValueChange={setPlatzKey}>
                    <SelectTrigger id="buch-platz">
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
                  <Label htmlFor="buch-preis">{tx('Gesamtpreis (€)')}</Label>
                  <Input
                    id="buch-preis"
                    type="number"
                    min="0"
                    step="0.01"
                    value={preisGesamt}
                    onChange={e => setPreisGesamt(e.target.value)}
                    placeholder={tx('z. B. 350')}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="buch-notizen">{tx('Interne Notizen')}</Label>
                <Textarea
                  id="buch-notizen"
                  value={interneNotizen}
                  onChange={e => setInterneNotizen(e.target.value)}
                  placeholder={tx('Besonderheiten, Hinweise für das Team …')}
                  rows={3}
                />
              </div>

              {/* Status-Info */}
              <p className="text-xs text-muted-foreground">
                {tx('Status wird automatisch auf „Geplant" und Zahlungsstatus auf „Offen" gesetzt.')}
              </p>
            </div>

            {buchungError && (
              <p className="text-sm text-destructive px-1">{buchungError}</p>
            )}

            <div className="flex gap-3 flex-wrap">
              <Button
                disabled={
                  !anreise || !abreise || platzKey === 'none' ||
                  (naechteDiff !== null && naechteDiff <= 0) ||
                  buchungSaving
                }
                onClick={handleCreateBuchung}
                size="lg"
              >
                <IconCheck size={18} className="shrink-0 mr-1.5" />
                {buchungSaving ? tx('Buchung wird gespeichert …') : tx('Buchung speichern')}
              </Button>
              <Button variant="ghost" onClick={() => setStep(2)}>
                {tx('Zurück')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Auswahl aus den vorherigen Schritten.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              {tx('Neu starten')}
            </Button>
          </div>
        )
      )}

      {/* ============================================================
          SCHRITT 4 — Fertig
      ============================================================ */}
      {step === 4 && (
        successBuchungId ? (
          <div className="flex flex-col items-center text-center py-12 space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <IconCheck size={36} className="text-emerald-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">
                {tx('Buchung gespeichert!')}
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                {selectedBesitzer && selectedHund ? (
                  tx(tx`Die Buchung für ${selectedHund.fields.name ?? tx('den Hund')} von ${selectedBesitzer.fields.vorname ?? ''} ${selectedBesitzer.fields.nachname ?? ''} wurde erfolgreich angelegt.`)
                ) : (
                  tx('Die Buchung wurde erfolgreich angelegt.')
                )}
              </p>
              {anreise && abreise && platzKey !== 'none' && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{selectedPlatzLabel}</span>
                  {' · '}
                  {format(parseISO(anreise), 'dd.MM.')} – {format(parseISO(abreise), 'dd.MM.yyyy')}
                  {naechteDiff !== null && naechteDiff > 0 && (
                    <> ({naechteDiff} {naechteDiff === 1 ? tx('Nacht') : tx('Nächte')})</>
                  )}
                </p>
              )}
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              <Button onClick={handleReset}>
                <IconPlus size={16} className="shrink-0 mr-1" />
                {tx('Neue Buchung anlegen')}
              </Button>
              <a href="#/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
                {tx('Zurück zum Dashboard')}
              </a>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht eine gespeicherte Buchung aus Schritt 3.')}
            </p>
            <Button variant="outline" onClick={() => setStep(3)}>
              {tx('Zurück zu Schritt 3')}
            </Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
