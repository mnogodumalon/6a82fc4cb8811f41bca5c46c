/**
 * Anfrage bestätigen — 3-Schritt-Wizard.
 * Steps: 1) Offene Buchungsanfrage wählen → 2) Details prüfen und entscheiden (ablehnen oder weiter) → 3) Buchung anlegen und bestätigen.
 * Reads: buchungsanfragen. Writes: buchungsanfragen (updateBuchungsanfragenEntry), buchungen (createBuchungenEntry).
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge.
 */

import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { useDashboardData } from '@/hooks/useDashboardData';
import { LivingAppsService } from '@/services/livingAppsService';
import type { Buchungsanfragen } from '@/types/app';
import { LOOKUP_OPTIONS } from '@/types/app';
import { formatDate } from '@/lib/formatters';
import { tx } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconDog, IconCalendar, IconUser, IconPhone, IconMail, IconAlertCircle, IconCheck, IconX } from '@tabler/icons-react';

const PLATZ_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];

export default function AnfrageBestaetigenPage() {
  const { buchungsanfragen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedAnfrage, setSelectedAnfrage] = useState<Buchungsanfragen | null>(null);

  // Schritt 3: Buchungsfelder
  const [anreise, setAnreise] = useState('');
  const [abreise, setAbreise] = useState('');
  const [platzKey, setPlatzKey] = useState('');
  const [preisGesamt, setPreisGesamt] = useState('');
  const [interneNotizen, setInterneNotizen] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // Idempotency guard: store created buchung id so retries don't duplicate
  const [createdBuchungId, setCreatedBuchungId] = useState<string | null>(null);

  // Filter: nur offene Anfragen
  const offeneAnfragen = buchungsanfragen.filter(
    a => !a.fields.anfrage_status || a.fields.anfrage_status.key === 'offen'
  );

  const handleSelectAnfrage = (id: string) => {
    const found = offeneAnfragen.find(a => a.record_id === id) ?? null;
    setSelectedAnfrage(found);
    if (found) {
      setAnreise(found.fields.wunsch_anreise ?? '');
      setAbreise(found.fields.wunsch_abreise ?? '');
      setPlatzKey('');
      setPreisGesamt('');
      setInterneNotizen('');
      setSubmitError(null);
      setCreatedBuchungId(null);
      setDone(false);
      setStep(2);
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
      setSelectedAnfrage(null);
      setStep(1);
    } catch {
      setSubmitError(tx('Fehler beim Ablehnen. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBestaetigen = async () => {
    if (!selectedAnfrage || !anreise || !abreise || !platzKey) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Idempotency: only create the buchung if we don't have one yet
      let buchungId = createdBuchungId;
      if (!buchungId) {
        const anfrage = selectedAnfrage.fields;
        const notizTeile = [
          tx`Anfrage von ${anfrage.anfrage_vorname ?? ''} ${anfrage.anfrage_nachname ?? ''}`,
          tx`Hund: ${anfrage.hund_name ?? '—'}`,
        ];
        if (interneNotizen) notizTeile.push(interneNotizen);
        const interne_notizen = notizTeile.join('. ');

        const result = await LivingAppsService.createBuchungenEntry({
          anreise,
          abreise,
          platz: platzKey,
          status: 'geplant',
          preis_gesamt: preisGesamt ? parseFloat(preisGesamt) : undefined,
          interne_notizen,
        });
        buchungId = result.record_id;
        setCreatedBuchungId(buchungId);
      }

      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
        anfrage_status: 'bestaetigt',
      });
      await fetchAll();
      setDone(true);
    } catch {
      setSubmitError(tx('Fehler beim Anlegen der Buchung. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedAnfrage(null);
    setAnreise('');
    setAbreise('');
    setPlatzKey('');
    setPreisGesamt('');
    setInterneNotizen('');
    setSubmitError(null);
    setCreatedBuchungId(null);
    setDone(false);
    setStep(1);
  };

  return (
    <IntentWizardShell
      title={tx('Anfrage bestätigen')}
      subtitle={tx('Buchungsanfrage prüfen und direkt eine Buchung anlegen')}
      steps={[
        { label: tx('Anfrage wählen') },
        { label: tx('Prüfen & entscheiden') },
        { label: tx('Buchung anlegen') },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── Schritt 1: Anfrage wählen ── */}
      {step === 1 && (
        <EntitySelectStep
          items={offeneAnfragen.map(a => ({
            id: a.record_id,
            title: `${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim() || tx('Unbekannte Person'),
            subtitle: [
              a.fields.hund_name ? `${tx('Hund')}: ${a.fields.hund_name}` : null,
              a.fields.wunsch_anreise ? `${formatDate(a.fields.wunsch_anreise)} – ${a.fields.wunsch_abreise ? formatDate(a.fields.wunsch_abreise) : '?'}` : null,
              a.fields.hund_groesse?.label ?? null,
            ].filter(Boolean).join(' · '),
            status: a.fields.anfrage_status
              ? { key: a.fields.anfrage_status.key, label: a.fields.anfrage_status.label }
              : undefined,
            stats: [
              a.fields.hund_name ? { label: tx('Hund'), value: a.fields.hund_name } : null,
              a.fields.anfrage_email ? { label: tx('E-Mail'), value: a.fields.anfrage_email } : null,
            ].filter((s): s is { label: string; value: string } => s !== null),
            icon: <IconDog size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectAnfrage}
          searchPlaceholder={tx('Nach Name oder Hund suchen …')}
          emptyText={tx('Keine offenen Anfragen vorhanden.')}
          emptyIcon={<IconDog size={40} className="text-muted-foreground" />}
        />
      )}

      {/* ── Schritt 2: Prüfen und entscheiden ── */}
      {step === 2 && (
        selectedAnfrage ? (
          <div className="space-y-6">
            {/* Anfragedetails */}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">
                  {tx('Anfragedetails')}
                </h2>
                <StatusBadge
                  statusKey={selectedAnfrage.fields.anfrage_status?.key}
                  label={selectedAnfrage.fields.anfrage_status?.label}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Person */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {tx('Kontakt')}
                  </p>
                  <div className="flex items-start gap-2">
                    <IconUser size={16} className="shrink-0 text-muted-foreground mt-0.5" />
                    <span className="text-sm text-foreground">
                      {[selectedAnfrage.fields.anfrage_vorname, selectedAnfrage.fields.anfrage_nachname].filter(Boolean).join(' ') || '—'}
                    </span>
                  </div>
                  {selectedAnfrage.fields.anfrage_telefon && (
                    <div className="flex items-start gap-2">
                      <IconPhone size={16} className="shrink-0 text-muted-foreground mt-0.5" />
                      <span className="text-sm text-foreground">{selectedAnfrage.fields.anfrage_telefon}</span>
                    </div>
                  )}
                  {selectedAnfrage.fields.anfrage_email && (
                    <div className="flex items-start gap-2">
                      <IconMail size={16} className="shrink-0 text-muted-foreground mt-0.5" />
                      <span className="text-sm text-foreground break-all">{selectedAnfrage.fields.anfrage_email}</span>
                    </div>
                  )}
                </div>

                {/* Hund */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {tx('Hund')}
                  </p>
                  <div className="flex items-start gap-2">
                    <IconDog size={16} className="shrink-0 text-muted-foreground mt-0.5" />
                    <span className="text-sm text-foreground">
                      {selectedAnfrage.fields.hund_name ?? '—'}
                    </span>
                  </div>
                  {selectedAnfrage.fields.hund_rasse && (
                    <p className="text-sm text-muted-foreground pl-6">{selectedAnfrage.fields.hund_rasse}</p>
                  )}
                  {selectedAnfrage.fields.hund_groesse && (
                    <p className="text-sm text-muted-foreground pl-6">{selectedAnfrage.fields.hund_groesse.label}</p>
                  )}
                </div>

                {/* Zeitraum */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {tx('Gewünschter Zeitraum')}
                  </p>
                  <div className="flex items-start gap-2">
                    <IconCalendar size={16} className="shrink-0 text-muted-foreground mt-0.5" />
                    <span className="text-sm text-foreground">
                      {selectedAnfrage.fields.wunsch_anreise
                        ? formatDate(selectedAnfrage.fields.wunsch_anreise)
                        : '—'}
                      {' – '}
                      {selectedAnfrage.fields.wunsch_abreise
                        ? formatDate(selectedAnfrage.fields.wunsch_abreise)
                        : '—'}
                    </span>
                  </div>
                </div>

                {/* Nachricht */}
                {selectedAnfrage.fields.nachricht && (
                  <div className="sm:col-span-2 space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {tx('Nachricht')}
                    </p>
                    <p className="text-sm text-foreground whitespace-pre-wrap rounded-xl bg-secondary/50 p-3">
                      {selectedAnfrage.fields.nachricht}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Fehlermeldung */}
            {submitError && (
              <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <IconAlertCircle size={16} className="shrink-0" />
                {submitError}
              </div>
            )}

            {/* Aktionen */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="text-muted-foreground"
                onClick={() => setStep(1)}
                disabled={submitting}
              >
                {tx('Zurück')}
              </Button>
              <div className="flex flex-col sm:flex-row gap-3 sm:ml-auto">
                <Button
                  variant="outline"
                  className="border-destructive/50 text-destructive hover:bg-destructive/10"
                  onClick={handleAblehnen}
                  disabled={submitting}
                >
                  <IconX size={16} className="shrink-0 mr-1.5" />
                  {tx('Anfrage ablehnen')}
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={submitting}
                >
                  <IconCheck size={16} className="shrink-0 mr-1.5" />
                  {tx('Buchung anlegen')}
                </Button>
              </div>
            </div>
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

      {/* ── Schritt 3: Buchung anlegen ── */}
      {step === 3 && (
        selectedAnfrage ? (
          done ? (
            /* Erfolg */
            <div className="text-center py-12 space-y-5">
              <div className="flex justify-center">
                <div className="rounded-full bg-emerald-100 p-4">
                  <IconCheck size={36} className="text-emerald-600" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-foreground">
                  {tx('Buchung erfolgreich angelegt!')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {tx('Die Anfrage wurde bestätigt und eine Buchung erstellt.')}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row justify-center gap-3">
                <Button variant="outline" onClick={handleReset}>
                  {tx('Weitere Anfrage bearbeiten')}
                </Button>
                <Button asChild>
                  <a href="#/">{tx('Zurück zum Dashboard')}</a>
                </Button>
              </div>
            </div>
          ) : (
            /* Buchungsformular */
            <div className="space-y-6">
              {/* Zusammenfassung der Anfrage */}
              <div className="rounded-2xl border bg-secondary/30 px-4 py-3 flex items-center gap-3">
                <IconDog size={18} className="shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {[selectedAnfrage.fields.anfrage_vorname, selectedAnfrage.fields.anfrage_nachname].filter(Boolean).join(' ')}
                    {selectedAnfrage.fields.hund_name ? ` · ${selectedAnfrage.fields.hund_name}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tx('Anfrage wird bestätigt')}
                  </p>
                </div>
              </div>

              {/* Formular */}
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <h2 className="text-base font-semibold text-foreground">
                  {tx('Buchungsdetails')}
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Anreise */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      {tx('Anreise')} <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="date"
                      value={anreise}
                      onChange={e => setAnreise(e.target.value)}
                    />
                  </div>

                  {/* Abreise */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      {tx('Abreise')} <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="date"
                      value={abreise}
                      onChange={e => setAbreise(e.target.value)}
                    />
                  </div>

                  {/* Platz */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      {tx('Platz')} <span className="text-destructive">*</span>
                    </label>
                    <Select value={platzKey || 'none'} onValueChange={v => setPlatzKey(v === 'none' ? '' : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder={tx('Platz wählen …')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{tx('Platz wählen …')}</SelectItem>
                        {PLATZ_OPTIONS.map(o => (
                          <SelectItem key={o.key} value={o.key}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Preis */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      {tx('Gesamtpreis (€)')}
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={preisGesamt}
                      onChange={e => setPreisGesamt(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>

                  {/* Interne Notizen */}
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      {tx('Interne Notizen')}
                    </label>
                    <Textarea
                      value={interneNotizen}
                      onChange={e => setInterneNotizen(e.target.value)}
                      placeholder={tx('Zusätzliche Hinweise für die Buchung …')}
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      {tx('Anfragedaten (Name, Hund) werden automatisch ergänzt.')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Fehlermeldung */}
              {submitError && (
                <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <IconAlertCircle size={16} className="shrink-0" />
                  {submitError}
                </div>
              )}

              {/* Aktionen */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  disabled={submitting}
                >
                  {tx('Zurück')}
                </Button>
                <Button
                  className="sm:ml-auto"
                  onClick={handleBestaetigen}
                  disabled={submitting || !anreise || !abreise || !platzKey}
                >
                  <IconCheck size={16} className="shrink-0 mr-1.5" />
                  {submitting ? tx('Wird gespeichert …') : tx('Buchung anlegen & Anfrage bestätigen')}
                </Button>
              </div>
            </div>
          )
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
    </IntentWizardShell>
  );
}
