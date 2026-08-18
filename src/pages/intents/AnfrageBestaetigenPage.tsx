/**
 * Anfrage bestätigen — 2-Schritt-Wizard.
 * Steps: 1) Offene Buchungsanfrage wählen → 2) Prüfen und entscheiden (ablehnen oder als Buchung bestätigen).
 * Reads: buchungsanfragen (gefiltert auf anfrage_status 'offen').
 * Writes: buchungsanfragen (updateBuchungsanfragenEntry — Status auf 'bestaetigt' oder 'abgelehnt'),
 *         buchungen (createBuchungenEntry — neue Buchung bei Bestätigung).
 * Composes: IntentWizardShell, EntitySelectStep.
 */

import { useState } from 'react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Buchungsanfragen } from '@/types/app';
import { LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { tx } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IconDog, IconCalendar, IconUser, IconPhone, IconMail, IconMessageCircle, IconCheck, IconX } from '@tabler/icons-react';

const PLATZ_OPTIONS = LOOKUP_OPTIONS['buchungen']?.['platz'] ?? [];

export default function AnfrageBestaetigenPage() {
  const { buchungsanfragen, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);
  const [selectedAnfrage, setSelectedAnfrage] = useState<Buchungsanfragen | null>(null);

  // Mini-form state für Buchung anlegen
  const [platzKey, setPlatzKey] = useState('');
  const [preisGesamt, setPreisGesamt] = useState('');
  const [interneNotizen, setInterneNotizen] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Alle Hooks vor allen frühen Returns!

  const offeneAnfragen = buchungsanfragen.filter(
    (a) => a.fields.anfrage_status?.key === 'offen'
  );

  const handleSelectAnfrage = (id: string) => {
    const found = buchungsanfragen.find((a) => a.record_id === id) ?? null;
    setSelectedAnfrage(found);
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
      window.location.hash = '/';
    } catch {
      setSubmitError(tx('Fehler beim Ablehnen. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBestaetigen = async () => {
    if (!selectedAnfrage || !platzKey || platzKey === 'none') return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const preis = preisGesamt ? parseFloat(preisGesamt) : undefined;

      await LivingAppsService.createBuchungenEntry({
        hund: undefined,
        besitzer: undefined,
        anreise: selectedAnfrage.fields.wunsch_anreise,
        abreise: selectedAnfrage.fields.wunsch_abreise,
        platz: platzKey,
        preis_gesamt: preis,
        interne_notizen: interneNotizen || undefined,
        status: 'geplant',
      });

      await LivingAppsService.updateBuchungsanfragenEntry(selectedAnfrage.record_id, {
        anfrage_status: 'bestaetigt',
      });

      setDone(true);
    } catch {
      setSubmitError(tx('Fehler beim Anlegen der Buchung. Bitte erneut versuchen.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSelectedAnfrage(null);
    setPlatzKey('');
    setPreisGesamt('');
    setInterneNotizen('');
    setSubmitError(null);
    setDone(false);
    fetchAll();
    setStep(1);
  };

  if (done) {
    return (
      <IntentWizardShell
        title={tx('Anfrage bestätigen')}
        subtitle={tx('Buchungsanfrage prüfen und umwandeln')}
        steps={[{ label: tx('Anfrage wählen') }, { label: tx('Entscheidung') }]}
        currentStep={2}
        onStepChange={setStep}
        loading={loading}
        error={error}
        onRetry={fetchAll}
      >
        <div className="flex flex-col items-center justify-center py-16 space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <IconCheck size={32} className="text-emerald-600" stroke={2} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">{tx('Buchung erfolgreich angelegt!')}</h2>
            <p className="text-muted-foreground text-sm">
              {tx('Die Anfrage wurde bestätigt und eine neue Buchung wurde erstellt.')}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleReset} variant="outline">
              {tx('Weitere Anfrage bearbeiten')}
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
      title={tx('Anfrage bestätigen')}
      subtitle={tx('Buchungsanfrage prüfen und umwandeln')}
      steps={[{ label: tx('Anfrage wählen') }, { label: tx('Entscheidung') }]}
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
            title: `${a.fields.anfrage_vorname ?? ''} ${a.fields.anfrage_nachname ?? ''}`.trim() || tx('Unbekannt'),
            subtitle: [
              a.fields.hund_name ? `${tx('Hund')}: ${a.fields.hund_name}` : null,
              a.fields.wunsch_anreise ? `${tx('Anreise')}: ${formatDate(a.fields.wunsch_anreise)}` : null,
              a.fields.wunsch_abreise ? `${tx('Abreise')}: ${formatDate(a.fields.wunsch_abreise)}` : null,
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
          emptyText={tx('Keine offenen Anfragen vorhanden.')}
          emptyIcon={<IconDog size={32} className="text-muted-foreground" />}
        />
      )}

      {step === 2 && (
        selectedAnfrage ? (
          <div className="space-y-6">
            {/* Anfrage-Details (read-only) */}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <h3 className="font-semibold text-foreground text-base">{tx('Anfrage-Details')}</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-2">
                  <IconUser size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">{tx('Name')}</p>
                    <p className="text-sm font-medium text-foreground">
                      {[selectedAnfrage.fields.anfrage_vorname, selectedAnfrage.fields.anfrage_nachname]
                        .filter(Boolean)
                        .join(' ') || '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <IconMail size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">{tx('E-Mail')}</p>
                    <p className="text-sm font-medium text-foreground">
                      {selectedAnfrage.fields.anfrage_email || '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <IconPhone size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">{tx('Telefon')}</p>
                    <p className="text-sm font-medium text-foreground">
                      {selectedAnfrage.fields.anfrage_telefon || '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <IconDog size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">{tx('Hund')}</p>
                    <p className="text-sm font-medium text-foreground">
                      {[selectedAnfrage.fields.hund_name, selectedAnfrage.fields.hund_rasse]
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <IconDog size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">{tx('Größe')}</p>
                    <p className="text-sm font-medium text-foreground">
                      {selectedAnfrage.fields.hund_groesse?.label || '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <IconCalendar size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">{tx('Wunsch-Anreise')}</p>
                    <p className="text-sm font-medium text-foreground">
                      {selectedAnfrage.fields.wunsch_anreise
                        ? formatDate(selectedAnfrage.fields.wunsch_anreise)
                        : '—'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <IconCalendar size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">{tx('Wunsch-Abreise')}</p>
                    <p className="text-sm font-medium text-foreground">
                      {selectedAnfrage.fields.wunsch_abreise
                        ? formatDate(selectedAnfrage.fields.wunsch_abreise)
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {selectedAnfrage.fields.nachricht && (
                <div className="flex items-start gap-2 pt-2 border-t">
                  <IconMessageCircle size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">{tx('Nachricht')}</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">
                      {selectedAnfrage.fields.nachricht}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Mini-Form: Buchung anlegen */}
            <div className="rounded-2xl border bg-card p-5 space-y-4">
              <h3 className="font-semibold text-foreground text-base">{tx('Buchung bestätigen')}</h3>
              <p className="text-sm text-muted-foreground">
                {tx('Fehlende Felder ausfüllen, um die Anfrage in eine echte Buchung umzuwandeln.')}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {tx('Anreise')}
                  </label>
                  <Input
                    type="date"
                    value={selectedAnfrage.fields.wunsch_anreise ?? ''}
                    readOnly
                    className="bg-secondary/50 cursor-default"
                  />
                  <p className="text-xs text-muted-foreground">{tx('Aus Anfrage übernommen')}</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {tx('Abreise')}
                  </label>
                  <Input
                    type="date"
                    value={selectedAnfrage.fields.wunsch_abreise ?? ''}
                    readOnly
                    className="bg-secondary/50 cursor-default"
                  />
                  <p className="text-xs text-muted-foreground">{tx('Aus Anfrage übernommen')}</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {tx('Platz')} <span className="text-destructive">*</span>
                  </label>
                  <Select value={platzKey} onValueChange={setPlatzKey}>
                    <SelectTrigger>
                      <SelectValue placeholder={tx('Platz wählen …')} />
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
                  <label className="text-xs font-medium text-muted-foreground">
                    {tx('Preis gesamt (€)')}
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={preisGesamt}
                    onChange={(e) => setPreisGesamt(e.target.value)}
                    placeholder={tx('z. B. 420')}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  {tx('Interne Notizen')}
                </label>
                <Textarea
                  value={interneNotizen}
                  onChange={(e) => setInterneNotizen(e.target.value)}
                  placeholder={tx('Hinweise für das Team …')}
                  rows={3}
                />
              </div>
            </div>

            {submitError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {submitError}
              </div>
            )}

            {/* Aktions-Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                disabled={submitting}
              >
                {tx('Andere Anfrage wählen')}
              </Button>

              <div className="flex-1" />

              <Button
                variant="destructive"
                onClick={handleAblehnen}
                disabled={submitting}
                className="flex items-center gap-2"
              >
                <IconX size={16} stroke={2} />
                {tx('Ablehnen')}
              </Button>

              <Button
                onClick={handleBestaetigen}
                disabled={submitting || !platzKey || platzKey === 'none'}
                className="flex items-center gap-2"
              >
                <IconCheck size={16} stroke={2} />
                {submitting ? tx('Wird verarbeitet …') : tx('Bestätigen & Buchung anlegen')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center">
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
