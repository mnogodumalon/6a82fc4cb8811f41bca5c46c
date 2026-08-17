/**
 * Neue Hundepension-Buchung — 3-Schritt-Wizard.
 * Steps: 1) Besitzer wählen oder neu erstellen →
 *        2) Hund wählen oder neu anlegen (gefiltert nach Besitzer) →
 *        3) Zeitraum & Platz festlegen → Buchung anlegen.
 * Reads: besitzer, hunde. Writes: besitzer (createBesitzerEntry),
 *        hunde (createHundeEntry), buchungen (createBuchungenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
 */
import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { LOOKUP_OPTIONS, APP_IDS } from '@/types/app';
import { tx } from '@/i18n';
import { differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconDog, IconUser, IconCalendar, IconCheck, IconAlertCircle } from '@tabler/icons-react';

const PLATZ_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];
const STATUS_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['status'] ?? [];
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
  const [bError, setBError] = useState<string | null>(null);

  // Step 2 — Hund
  const [selectedHundId, setSelectedHundId] = useState<string | null>(null);
  const [showCreateHund, setShowCreateHund] = useState(false);
  const [hName, setHName] = useState('');
  const [hRasse, setHRasse] = useState('');
  const [hGeschlecht, setHGeschlecht] = useState('none');
  const [hSaving, setHSaving] = useState(false);
  const [hError, setHError] = useState<string | null>(null);

  // Step 3 — Zeitraum & Platz
  const [anreise, setAnreise] = useState('');
  const [abreise, setAbreise] = useState('');
  const [platzKey, setPlatzKey] = useState('none');
  const [statusKey, setStatusKey] = useState(STATUS_OPTIONS[0]?.key ?? 'geplant');
  const [preisGesamt, setPreisGesamt] = useState('');
  const [interneNotizen, setInterneNotizen] = useState('');
  const [buchungSaving, setBuchungSaving] = useState(false);
  const [buchungError, setBuchungError] = useState<string | null>(null);
  const [buchungDone, setBuchungDone] = useState(false);
  const [createdBuchungId, setCreatedBuchungId] = useState<string | null>(null);

  // --- Step 1: Besitzer-Auswahl ---
  const handleSelectBesitzer = (id: string) => {
    setSelectedBesitzerId(id);
    setSelectedHundId(null);
    setStep(2);
  };

  const handleCreateBesitzer = async () => {
    if (!bVorname.trim() || !bNachname.trim()) return;
    setBSaving(true);
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
      setSelectedBesitzerId(created.record_id);
      setSelectedHundId(null);
      setStep(2);
    } catch {
      setBError(tx('Besitzer konnte nicht angelegt werden. Bitte erneut versuchen.'));
    } finally {
      setBSaving(false);
    }
  };

  // --- Step 2: Hund-Auswahl ---
  const hundeDesBesitzers = selectedBesitzerId
    ? hunde.filter(h => {
        const rid = extractRecordId(h.fields.besitzer);
        return rid === selectedBesitzerId;
      })
    : [];

  const handleSelectHund = (id: string) => {
    setSelectedHundId(id);
    setStep(3);
  };

  const handleCreateHund = async () => {
    if (!hName.trim() || !selectedBesitzerId) return;
    setHSaving(true);
    setHError(null);
    try {
      const created = await LivingAppsService.createHundeEntry({
        name: hName.trim(),
        rasse: hRasse.trim() || undefined,
        geschlecht: hGeschlecht !== 'none' ? hGeschlecht : undefined,
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
      });
      await fetchAll();
      setShowCreateHund(false);
      setHName('');
      setHRasse('');
      setHGeschlecht('none');
      setSelectedHundId(created.record_id);
      setStep(3);
    } catch {
      setHError(tx('Hund konnte nicht angelegt werden. Bitte erneut versuchen.'));
    } finally {
      setHSaving(false);
    }
  };

  // --- Step 3: Buchung erstellen ---
  const naechteBis = anreise && abreise
    ? differenceInDays(new Date(abreise), new Date(anreise))
    : 0;

  const handleCreateBuchung = async () => {
    if (!selectedBesitzerId || !selectedHundId || !anreise || !abreise || platzKey === 'none') return;
    // idempotency: nur anlegen wenn noch kein record_id gespeichert
    if (createdBuchungId) return;
    setBuchungSaving(true);
    setBuchungError(null);
    try {
      const created = await LivingAppsService.createBuchungenEntry({
        hund: createRecordUrl(APP_IDS.HUNDE, selectedHundId),
        besitzer: createRecordUrl(APP_IDS.BESITZER, selectedBesitzerId),
        anreise,
        abreise,
        platz: platzKey,
        status: statusKey,
        preis_gesamt: preisGesamt ? parseFloat(preisGesamt) : undefined,
        interne_notizen: interneNotizen.trim() || undefined,
      });
      setCreatedBuchungId(created.record_id);
      setBuchungDone(true);
      await fetchAll();
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
    setShowCreateBesitzer(false);
    setShowCreateHund(false);
    setBVorname(''); setBNachname(''); setBTelefon(''); setBEmail('');
    setHName(''); setHRasse(''); setHGeschlecht('none');
    setAnreise(''); setAbreise(''); setPlatzKey('none');
    setStatusKey(STATUS_OPTIONS[0]?.key ?? 'geplant');
    setPreisGesamt(''); setInterneNotizen('');
    setBuchungDone(false);
    setCreatedBuchungId(null);
    setBuchungError(null);
  };

  // Besitzer-Anzeigename für Zusammenfassung
  const selectedBesitzer = besitzer.find(b => b.record_id === selectedBesitzerId);
  const besitzerName = selectedBesitzer
    ? `${selectedBesitzer.fields.vorname ?? ''} ${selectedBesitzer.fields.nachname ?? ''}`.trim()
    : '';

  const selectedHund = hunde.find(h => h.record_id === selectedHundId);
  const hundName = selectedHund?.fields.name ?? '';

  const selectedPlatzLabel = PLATZ_OPTIONS.find(p => p.key === platzKey)?.label ?? platzKey;
  const selectedStatusLabel = STATUS_OPTIONS.find(s => s.key === statusKey)?.label ?? statusKey;

  return (
    <IntentWizardShell
      title={tx('Neue Buchung anlegen')}
      subtitle={tx('Besitzer, Hund und Zeitraum in drei Schritten erfassen')}
      steps={[
        { label: tx('Besitzer') },
        { label: tx('Hund') },
        { label: tx('Buchung') },
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
          onSelect={handleSelectBesitzer}
          searchPlaceholder={tx('Nach Name oder Telefon suchen …')}
          createLabel={tx('Neuen Besitzer anlegen')}
          onCreateNew={() => { setShowCreateBesitzer(true); }}
          createDialog={showCreateBesitzer ? (
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <h3 className="font-semibold text-sm">{tx('Neuen Besitzer erfassen')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="b-vorname">{tx('Vorname')} *</Label>
                  <Input
                    id="b-vorname"
                    value={bVorname}
                    onChange={e => setBVorname(e.target.value)}
                    placeholder={tx('Max')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="b-nachname">{tx('Nachname')} *</Label>
                  <Input
                    id="b-nachname"
                    value={bNachname}
                    onChange={e => setBNachname(e.target.value)}
                    placeholder={tx('Mustermann')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="b-telefon">{tx('Telefon')}</Label>
                  <Input
                    id="b-telefon"
                    type="tel"
                    value={bTelefon}
                    onChange={e => setBTelefon(e.target.value)}
                    placeholder={tx('+49 171 …')}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="b-email">{tx('E-Mail')}</Label>
                  <Input
                    id="b-email"
                    type="email"
                    value={bEmail}
                    onChange={e => setBEmail(e.target.value)}
                    placeholder={tx('max@beispiel.de')}
                  />
                </div>
              </div>
              {bError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <IconAlertCircle size={14} className="shrink-0" />
                  {bError}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  disabled={!bVorname.trim() || !bNachname.trim() || bSaving}
                  onClick={handleCreateBesitzer}
                >
                  {bSaving ? tx('Wird angelegt …') : tx('Anlegen & weiter')}
                </Button>
                <Button variant="outline" onClick={() => setShowCreateBesitzer(false)}>
                  {tx('Abbrechen')}
                </Button>
              </div>
            </div>
          ) : null}
          emptyText={tx('Keine Besitzer gefunden')}
          emptyIcon={<IconUser size={32} className="text-muted-foreground" />}
        />
      )}

      {/* ── Step 2: Hund wählen ── */}
      {step === 2 && (
        selectedBesitzerId ? (
          <div className="space-y-4">
            {/* Besitzer-Kontext */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconUser size={14} className="shrink-0" />
              <span>{tx('Besitzer:')} <span className="font-medium text-foreground">{besitzerName}</span></span>
            </div>

            <EntitySelectStep
              items={hundeDesBesitzers.map(h => ({
                id: h.record_id,
                title: h.fields.name ?? h.record_id,
                subtitle: [h.fields.rasse, h.fields.geschlecht?.label].filter(Boolean).join(' · '),
                icon: <IconDog size={20} className="text-primary" />,
              }))}
              onSelect={handleSelectHund}
              searchPlaceholder={tx('Nach Hundename oder Rasse suchen …')}
              createLabel={tx('Neuen Hund anlegen')}
              onCreateNew={() => { setShowCreateHund(true); }}
              createDialog={showCreateHund ? (
                <div className="rounded-2xl border bg-card p-5 space-y-4">
                  <h3 className="font-semibold text-sm">{tx('Neuen Hund erfassen')}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="h-name">{tx('Name')} *</Label>
                      <Input
                        id="h-name"
                        value={hName}
                        onChange={e => setHName(e.target.value)}
                        placeholder={tx('z.B. Bello')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="h-rasse">{tx('Rasse')}</Label>
                      <Input
                        id="h-rasse"
                        value={hRasse}
                        onChange={e => setHRasse(e.target.value)}
                        placeholder={tx('z.B. Golden Retriever')}
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="h-geschlecht">{tx('Geschlecht')}</Label>
                      <Select value={hGeschlecht} onValueChange={setHGeschlecht}>
                        <SelectTrigger id="h-geschlecht" className="w-full">
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
                  {hError && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <IconAlertCircle size={14} className="shrink-0" />
                      {hError}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      disabled={!hName.trim() || hSaving}
                      onClick={handleCreateHund}
                    >
                      {hSaving ? tx('Wird angelegt …') : tx('Anlegen & weiter')}
                    </Button>
                    <Button variant="outline" onClick={() => setShowCreateHund(false)}>
                      {tx('Abbrechen')}
                    </Button>
                  </div>
                </div>
              ) : null}
              emptyText={
                hundeDesBesitzers.length === 0
                  ? tx('Noch kein Hund für diesen Besitzer — bitte anlegen')
                  : tx('Kein Hund gefunden')
              }
              emptyIcon={<IconDog size={32} className="text-muted-foreground" />}
            />

            <div className="pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                {tx('← Zurück zu Schritt 1')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht die Besitzerauswahl aus Schritt 1.')}
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>{tx('Neu starten')}</Button>
          </div>
        )
      )}

      {/* ── Step 3: Zeitraum & Platz ── */}
      {step === 3 && (
        selectedBesitzerId && selectedHundId ? (
          buchungDone ? (
            /* Erfolgszustand */
            <div className="flex flex-col items-center gap-6 py-10 text-center">
              <div className="rounded-full bg-primary/10 p-4">
                <IconCheck size={40} className="text-primary" stroke={1.5} />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">{tx('Buchung angelegt!')}</h2>
                <p className="text-sm text-muted-foreground">
                  {hundName} {tx('für')} {besitzerName} — {anreise} {tx('bis')} {abreise}
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
            <div className="space-y-6 max-w-lg">
              {/* Kontext-Zusammenfassung */}
              <div className="rounded-2xl border bg-secondary/40 p-4 space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <IconUser size={14} className="shrink-0 text-muted-foreground" />
                  <span className="text-muted-foreground">{tx('Besitzer:')} </span>
                  <span className="font-medium">{besitzerName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <IconDog size={14} className="shrink-0 text-muted-foreground" />
                  <span className="text-muted-foreground">{tx('Hund:')} </span>
                  <span className="font-medium">{hundName}</span>
                </div>
              </div>

              {/* Datum */}
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

              {/* Nächte-Info */}
              {naechteBis > 0 && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <IconCalendar size={14} className="shrink-0" />
                  {naechteBis === 1
                    ? tx('1 Nacht')
                    : `${naechteBis} ${tx('Nächte')}`}
                </p>
              )}

              {/* Platz */}
              <div className="space-y-1">
                <Label htmlFor="platz">{tx('Platz')} *</Label>
                <Select value={platzKey} onValueChange={setPlatzKey}>
                  <SelectTrigger id="platz" className="w-full">
                    <SelectValue placeholder={tx('Platz auswählen')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{tx('Bitte wählen')}</SelectItem>
                    {PLATZ_OPTIONS.map(opt => (
                      <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-1">
                <Label htmlFor="status">{tx('Status')} *</Label>
                <Select value={statusKey} onValueChange={setStatusKey}>
                  <SelectTrigger id="status" className="w-full">
                    <SelectValue placeholder={tx('Status auswählen')} />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Preis */}
              <div className="space-y-1">
                <Label htmlFor="preis">{tx('Gesamtpreis (€)')}</Label>
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

              {/* Notizen */}
              <div className="space-y-1">
                <Label htmlFor="notizen">{tx('Interne Notizen')}</Label>
                <Textarea
                  id="notizen"
                  value={interneNotizen}
                  onChange={e => setInterneNotizen(e.target.value)}
                  placeholder={tx('Besonderheiten, Hinweise …')}
                  rows={3}
                />
              </div>

              {/* Zusammenfassung */}
              {anreise && abreise && platzKey !== 'none' && (
                <div className="rounded-2xl border bg-primary/5 p-4 text-sm space-y-1">
                  <p className="font-medium">{tx('Buchungsübersicht')}</p>
                  <p className="text-muted-foreground">
                    {hundName} · {selectedPlatzLabel} · {anreise} → {abreise}
                  </p>
                  <p className="text-muted-foreground">
                    {tx('Status:')} {selectedStatusLabel}
                    {preisGesamt ? ` · ${parseFloat(preisGesamt).toFixed(2)} €` : ''}
                  </p>
                </div>
              )}

              {buchungError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <IconAlertCircle size={14} className="shrink-0" />
                  {buchungError}
                </p>
              )}

              <div className="flex flex-wrap gap-3 pt-2">
                <Button
                  disabled={!anreise || !abreise || platzKey === 'none' || buchungSaving}
                  onClick={handleCreateBuchung}
                >
                  {buchungSaving ? tx('Buchung wird angelegt …') : tx('Buchung anlegen')}
                </Button>
                <Button variant="outline" onClick={() => setStep(2)}>
                  {tx('← Zurück zu Schritt 2')}
                </Button>
              </div>
            </div>
          )
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
