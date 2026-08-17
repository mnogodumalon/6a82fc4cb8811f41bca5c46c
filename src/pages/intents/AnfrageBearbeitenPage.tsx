/**
 * Anfrage bearbeiten — 2-Schritt-Wizard.
 * Steps: 1) Offene Buchungsanfrage wählen → 2) Anfrage bestätigen oder ablehnen.
 * Reads: buchungsanfragen (gefiltert: anfrage_status = 'offen').
 * Writes: buchungsanfragen (updateBuchungsanfragenEntry — Status auf 'bestaetigt' oder 'abgelehnt').
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge.
 */

import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService } from '@/services/livingAppsService';
import { LOOKUP_OPTIONS } from '@/types/app';
import type { Buchungsanfragen } from '@/types/app';
import { formatDate } from '@/lib/formatters';
import { tx } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { IconDog, IconCheck, IconX, IconInfoCircle, IconCalendar, IconPhone, IconMail } from '@tabler/icons-react';

const PLATZ_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];

export default function AnfrageBearbeitenPage() {
  const { buchungsanfragen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedAnfrage, setSelectedAnfrage] = useState<Buchungsanfragen | null>(null);
  const [platzKey, setPlatzKey] = useState('');
  const [preisGesamt, setPreisGesamt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successType, setSuccessType] = useState<'bestaetigt' | 'abgelehnt' | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const offeneAnfragen = buchungsanfragen.filter(
    (a) => a.fields.anfrage_status?.key === 'offen'
  );

  const handleSelectAnfrage = (id: string) => {
    const anfrage = buchungsanfragen.find((a) => a.record_id === id) ?? null;
    setSelectedAnfrage(anfrage);
    setPlatzKey('');
    setPreisGesamt('');
    setSuccessType(null);
    setSubmitError(null);
    setStep(2);
  };

  const handleBestaetigen = async () => {
    if (!selectedAnfrage) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
        anfrage_status: 'bestaetigt',
      });
      await fetchAll();
      setSuccessType('bestaetigt');
    } catch {
      setSubmitError(tx('Fehler beim Bestätigen. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAblehnen = async () => {
    if (!selectedAnfrage) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
        anfrage_status: 'abgelehnt',
      });
      await fetchAll();
      setSuccessType('abgelehnt');
    } catch {
      setSubmitError(tx('Fehler beim Ablehnen. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedAnfrage(null);
    setPlatzKey('');
    setPreisGesamt('');
    setSuccessType(null);
    setSubmitError(null);
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Buchungsanfrage bearbeiten')}
      subtitle={tx('Offene Anfragen prüfen, bestätigen oder ablehnen')}
      steps={[{ label: tx('Anfrage wählen') }, { label: tx('Entscheiden') }]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1 — Offene Anfrage wählen */}
      {step === 1 && (
        <EntitySelectStep
          items={offeneAnfragen.map((a) => ({
            id: a.record_id,
            title: `${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim() || tx('Unbekannt'),
            subtitle: [
              a.fields.hund_name ? `${tx('Hund')}: ${a.fields.hund_name}` : null,
              a.fields.wunsch_anreise ? `${formatDate(a.fields.wunsch_anreise)} – ${formatDate(a.fields.wunsch_abreise ?? '')}` : null,
              a.fields.hund_groesse?.label ?? null,
            ]
              .filter(Boolean)
              .join(' · '),
            status: a.fields.anfrage_status
              ? { key: a.fields.anfrage_status.key, label: a.fields.anfrage_status.label }
              : undefined,
            icon: <IconDog size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectAnfrage}
          searchPlaceholder={tx('Anfrage suchen …')}
          emptyText={tx('Keine offenen Anfragen vorhanden')}
          emptyIcon={<IconDog size={40} className="text-muted-foreground" />}
        />
      )}

      {/* Step 2 — Entscheiden */}
      {step === 2 && (
        selectedAnfrage ? (
          successType ? (
            /* Erfolgsansicht */
            <div className="flex flex-col items-center gap-6 py-10 text-center">
              {successType === 'bestaetigt' ? (
                <>
                  <div className="rounded-full bg-green-100 p-4">
                    <IconCheck size={40} className="text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      {tx('Anfrage bestätigt')}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                      {tx('Die Anfrage wurde auf „Bestätigt" gesetzt. Lege jetzt im Flow „Neue Buchung" die eigentliche Buchung an und verknüpfe dort Hund und Besitzer.')}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button onClick={handleReset} variant="outline">
                      {tx('Weitere Anfrage bearbeiten')}
                    </Button>
                    <a href="#/">
                      <Button>{tx('Zurück zum Dashboard')}</Button>
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <div className="rounded-full bg-red-100 p-4">
                    <IconX size={40} className="text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      {tx('Anfrage abgelehnt')}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {tx('Die Anfrage wurde als abgelehnt markiert.')}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button onClick={handleReset} variant="outline">
                      {tx('Weitere Anfrage bearbeiten')}
                    </Button>
                    <a href="#/">
                      <Button>{tx('Zurück zum Dashboard')}</Button>
                    </a>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Zusammenfassung der Anfrage */}
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-base font-semibold text-foreground">
                    {`${selectedAnfrage.fields.anfrage_vorname ?? ''} ${selectedAnfrage.fields.anfrage_nachname ?? ''}`.trim()}
                  </h2>
                  <StatusBadge
                    statusKey={selectedAnfrage.fields.anfrage_status?.key}
                    label={selectedAnfrage.fields.anfrage_status?.label}
                  />
                </div>

                {/* Kontaktdaten */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedAnfrage.fields.anfrage_email && (
                    <div className="flex items-center gap-2 text-sm">
                      <IconMail size={16} className="shrink-0 text-muted-foreground" />
                      <span className="truncate">{selectedAnfrage.fields.anfrage_email}</span>
                    </div>
                  )}
                  {selectedAnfrage.fields.anfrage_telefon && (
                    <div className="flex items-center gap-2 text-sm">
                      <IconPhone size={16} className="shrink-0 text-muted-foreground" />
                      <span>{selectedAnfrage.fields.anfrage_telefon}</span>
                    </div>
                  )}
                </div>

                {/* Hundeinfos */}
                <div className="rounded-xl bg-secondary p-3 space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {tx('Hund')}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    {selectedAnfrage.fields.hund_name && (
                      <span>
                        <span className="text-muted-foreground">{tx('Name')}: </span>
                        <span className="font-medium">{selectedAnfrage.fields.hund_name}</span>
                      </span>
                    )}
                    {selectedAnfrage.fields.hund_rasse && (
                      <span>
                        <span className="text-muted-foreground">{tx('Rasse')}: </span>
                        <span>{selectedAnfrage.fields.hund_rasse}</span>
                      </span>
                    )}
                    {selectedAnfrage.fields.hund_groesse && (
                      <span>
                        <span className="text-muted-foreground">{tx('Größe')}: </span>
                        <span>{selectedAnfrage.fields.hund_groesse.label}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Wunschtermin */}
                <div className="flex items-start gap-2 text-sm">
                  <IconCalendar size={16} className="shrink-0 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="text-muted-foreground">{tx('Wunschtermin')}: </span>
                    <span className="font-medium">
                      {formatDate(selectedAnfrage.fields.wunsch_anreise ?? '')}
                      {selectedAnfrage.fields.wunsch_abreise
                        ? ` – ${formatDate(selectedAnfrage.fields.wunsch_abreise)}`
                        : ''}
                    </span>
                  </div>
                </div>

                {/* Nachricht */}
                {selectedAnfrage.fields.nachricht && (
                  <div className="text-sm">
                    <p className="text-muted-foreground mb-1">{tx('Nachricht')}:</p>
                    <p className="whitespace-pre-wrap text-foreground">{selectedAnfrage.fields.nachricht}</p>
                  </div>
                )}
              </div>

              {/* Hinweis: Buchung muss manuell angelegt werden */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3">
                <IconInfoCircle size={18} className="shrink-0 text-amber-600 mt-0.5" />
                <p className="text-sm text-amber-800">
                  {tx('Nach dem Bestätigen musst du die Buchung manuell über den Flow „Neue Buchung" anlegen und dort Hund und Besitzer verknüpfen — diese Felder sind in Buchungen Pflichtfelder und können hier nicht automatisch befüllt werden.')}
                </p>
              </div>

              {/* Platz- und Preisinformationen (optional, nur zur Vorbereitung) */}
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">
                  {tx('Vormerken (optional)')}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {tx('Diese Angaben werden nicht gespeichert — nutze sie als Gedankenstütze beim Anlegen der Buchung.')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      {tx('Geplanter Platz')}
                    </label>
                    <Select value={platzKey} onValueChange={setPlatzKey}>
                      <SelectTrigger>
                        <SelectValue placeholder={tx('Platz wählen …')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{tx('— kein Platz vorgemerkt —')}</SelectItem>
                        {PLATZ_OPTIONS.map((o) => (
                          <SelectItem key={o.key} value={o.key}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      {tx('Geplanter Preis (€)')}
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={preisGesamt}
                      onChange={(e) => setPreisGesamt(e.target.value)}
                      placeholder={tx('z. B. 250')}
                    />
                  </div>
                </div>
              </div>

              {/* Fehleranzeige */}
              {submitError && (
                <p className="text-sm text-destructive">{submitError}</p>
              )}

              {/* Aktionen */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={submitting}
                  className="sm:mr-auto"
                >
                  {tx('Zurück')}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleAblehnen}
                  disabled={submitting}
                >
                  <IconX size={16} className="shrink-0 mr-1.5" />
                  {tx('Anfrage ablehnen')}
                </Button>
                <Button
                  onClick={handleBestaetigen}
                  disabled={submitting}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <IconCheck size={16} className="shrink-0 mr-1.5" />
                  {tx('Anfrage bestätigen')}
                </Button>
              </div>
            </div>
          )
        ) : (
          /* Fallback: Step 2 ohne Anfrage (z. B. nach Reload) */
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht eine gewählte Anfrage aus Schritt 1.')}
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
