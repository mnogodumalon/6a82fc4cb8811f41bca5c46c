/**
 * Anfrage bestätigen — 2-Schritt-Wizard.
 * Steps: 1) Offene Buchungsanfrage wählen → 2) Entscheiden: ablehnen oder bestätigen + Buchung anlegen.
 * Reads: buchungsanfragen (gefiltert auf status 'offen').
 * Writes: buchungsanfragen (updateBuchungsanfragenEntry), buchungen (createBuchungenEntry).
 * Composes: IntentWizardShell, EntitySelectStep.
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  IconDog,
  IconCheck,
  IconX,
  IconCalendar,
  IconUser,
  IconMail,
  IconPhone,
  IconRuler,
  IconNotes,
} from '@tabler/icons-react';

const PLATZ_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];

export default function AnfrageBestaetigenPage() {
  const { buchungsanfragen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedAnfrage, setSelectedAnfrage] = useState<Buchungsanfragen | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Formularfelder für Bestätigung
  const [platz, setPlatz] = useState('');
  const [preisGesamt, setPreisGesamt] = useState('');
  const [anreise, setAnreise] = useState('');
  const [abreise, setAbreise] = useState('');

  const offeneAnfragen = buchungsanfragen.filter(
    (a) => a.fields.anfrage_status?.key === 'offen'
  );

  const handleSelectAnfrage = (id: string) => {
    const anfrage = buchungsanfragen.find((a) => a.record_id === id);
    if (!anfrage) return;
    setSelectedAnfrage(anfrage);
    setAnreise(anfrage.fields.wunsch_anreise ?? '');
    setAbreise(anfrage.fields.wunsch_abreise ?? '');
    setStep(2);
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
      window.location.hash = '/';
    } catch {
      setSubmitError(tx('Fehler beim Ablehnen. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBestaetigen = async () => {
    if (!selectedAnfrage || !platz || !anreise || !abreise) return;
    setSubmitting(true);
    setSubmitError(null);

    const f = selectedAnfrage.fields;
    const interneNotizen =
      tx`Aus Anfrage von ${f.anfrage_vorname ?? ''} ${f.anfrage_nachname ?? ''} (${f.anfrage_email ?? ''}) — Hund: ${f.hund_name ?? ''}`.trim();

    try {
      await LivingAppsService.createBuchungenEntry({
        anreise,
        abreise,
        platz,
        status: 'geplant',
        zahlungsstatus: 'offen',
        preis_gesamt: preisGesamt ? parseFloat(preisGesamt) : undefined,
        interne_notizen: interneNotizen,
      });
      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
        anfrage_status: 'bestaetigt',
      });
      await fetchAll();
      window.location.hash = '/';
    } catch {
      setSubmitError(tx('Fehler beim Bestätigen. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <IntentWizardShell
      title={tx('Anfrage bestätigen')}
      subtitle={tx('Offene Buchungsanfrage prüfen und entscheiden')}
      steps={[{ label: tx('Anfrage wählen') }, { label: tx('Entscheiden') }]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {step === 1 && (
        <EntitySelectStep
          items={offeneAnfragen.map((a) => ({
            id: a.record_id,
            title:
              `${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim() ||
              tx('Unbekannter Anfragender'),
            subtitle:
              `${a.fields.hund_name ?? tx('Unbekannter Hund')} · ${formatDate(a.fields.wunsch_anreise)} – ${formatDate(a.fields.wunsch_abreise)}`,
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

      {step === 2 && (
        selectedAnfrage ? (
          <div className="space-y-6 max-w-2xl mx-auto">
            {/* Anfrage-Details (schreibgeschützt) */}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg">
                  {`${selectedAnfrage.fields.anfrage_vorname ?? ''} ${selectedAnfrage.fields.anfrage_nachname ?? ''}`.trim()}
                </h2>
                <StatusBadge
                  statusKey={selectedAnfrage.fields.anfrage_status?.key}
                  label={selectedAnfrage.fields.anfrage_status?.label}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {selectedAnfrage.fields.anfrage_email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <IconMail size={15} className="shrink-0" />
                    <span className="truncate">{selectedAnfrage.fields.anfrage_email}</span>
                  </div>
                )}
                {selectedAnfrage.fields.anfrage_telefon && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <IconPhone size={15} className="shrink-0" />
                    <span>{selectedAnfrage.fields.anfrage_telefon}</span>
                  </div>
                )}
                {selectedAnfrage.fields.hund_name && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <IconDog size={15} className="shrink-0" />
                    <span>
                      {selectedAnfrage.fields.hund_name}
                      {selectedAnfrage.fields.hund_rasse
                        ? ` · ${selectedAnfrage.fields.hund_rasse}`
                        : ''}
                    </span>
                  </div>
                )}
                {selectedAnfrage.fields.hund_groesse && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <IconRuler size={15} className="shrink-0" />
                    <span>{selectedAnfrage.fields.hund_groesse.label}</span>
                  </div>
                )}
                {(selectedAnfrage.fields.wunsch_anreise ||
                  selectedAnfrage.fields.wunsch_abreise) && (
                  <div className="flex items-center gap-2 text-muted-foreground col-span-full">
                    <IconCalendar size={15} className="shrink-0" />
                    <span>
                      {tx('Wunschzeitraum')}{': '}
                      {formatDate(selectedAnfrage.fields.wunsch_anreise)}
                      {' – '}
                      {formatDate(selectedAnfrage.fields.wunsch_abreise)}
                    </span>
                  </div>
                )}
                {selectedAnfrage.fields.nachricht && (
                  <div className="flex items-start gap-2 text-muted-foreground col-span-full">
                    <IconNotes size={15} className="shrink-0 mt-0.5" />
                    <span className="line-clamp-3">{selectedAnfrage.fields.nachricht}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Buchungsformular */}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <h3 className="font-semibold">{tx('Buchung anlegen')}</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="anreise">{tx('Anreise')}</Label>
                  <Input
                    id="anreise"
                    type="date"
                    value={anreise}
                    onChange={(e) => setAnreise(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="abreise">{tx('Abreise')}</Label>
                  <Input
                    id="abreise"
                    type="date"
                    value={abreise}
                    onChange={(e) => setAbreise(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="platz">{tx('Platz')}</Label>
                <Select value={platz} onValueChange={setPlatz}>
                  <SelectTrigger id="platz">
                    <SelectValue placeholder={tx('Platz auswählen …')} />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATZ_OPTIONS.map((opt) => (
                      <SelectItem key={opt.key} value={opt.key}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="preis">{tx('Preis gesamt (optional)')}</Label>
                <Input
                  id="preis"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={preisGesamt}
                  onChange={(e) => setPreisGesamt(e.target.value)}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                {tx('Hinweis: Besitzer und Hund können nach der Buchung im CRUD-Bereich verknüpft werden.')}
              </p>
            </div>

            {submitError && (
              <p className="text-sm text-destructive text-center">{submitError}</p>
            )}

            {/* Aktionsbereich */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setStep(1)}
                disabled={submitting}
              >
                {tx('Zurück')}
              </Button>

              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleAblehnen}
                disabled={submitting}
              >
                <IconX size={16} className="shrink-0 mr-2" />
                {tx('Anfrage ablehnen')}
              </Button>

              <Button
                className="flex-1"
                onClick={handleBestaetigen}
                disabled={submitting || !platz || !anreise || !abreise}
              >
                <IconCheck size={16} className="shrink-0 mr-2" />
                {tx('Bestätigen & Buchung anlegen')}
              </Button>
            </div>

            <div className="text-center">
              <a href="#/" className="text-sm text-muted-foreground hover:underline">
                {tx('Zurück zum Dashboard')}
              </a>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <IconUser size={40} className="text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">
              {tx('Dieser Schritt braucht eine Auswahl aus Schritt 1.')}
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
