import { useEffect, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import {
  loadPublicPagesConfig, createPublicRecord, prepareChallenge, PageUnavailableError,
  type PublicPagesConfig, type PublicPageConfig,
} from '@/lib/publicClient';
import { tx } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { IconPaw, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { format } from 'date-fns';

const SLUG = 'buchungsanfrage';

interface FormData {
  anfrage_vorname: string;
  anfrage_nachname: string;
  anfrage_telefon: string;
  anfrage_email: string;
  hund_name: string;
  hund_rasse: string;
  hund_groesse: string;
  wunsch_anreise: string;
  wunsch_abreise: string;
  nachricht: string;
}

const EMPTY: FormData = {
  anfrage_vorname: '',
  anfrage_nachname: '',
  anfrage_telefon: '',
  anfrage_email: '',
  hund_name: '',
  hund_rasse: '',
  hund_groesse: 'klein',
  wunsch_anreise: '',
  wunsch_abreise: '',
  nachricht: '',
};

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive mt-1">{msg}</p>;
}

export default function Buchungsanfrage() {
  const GROESSE_OPTIONS: { key: string; label: string }[] = [
  { key: 'klein', label: tx('Klein (bis 10 kg)') },
  { key: 'mittel', label: tx('Mittel (10–25 kg)') },
  { key: 'gross', label: tx('Groß (über 25 kg)') },
];

  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then(c => {
        setCfg(c);
        setPage(c?.pages[SLUG] ?? null);
        setLoading(false);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) {
          setUnavailable(true);
        }
        setLoading(false);
      });
  }, []);

  // Warm up challenge on first user interaction
  const handleFirstInteraction = () => {
    if (!cfg || !page) return;
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (ep) prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
  };

  if (loading || (!cfg && !unavailable)) {
    return <PublicShell loading />;
  }
  if (unavailable || !cfg || !page) {
    return <PublicShell unavailable />;
  }

  const set = (field: keyof FormData, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(e => ({ ...e, [field]: undefined }));
  };

  // Validation per step
  const validate = (s: number): Partial<Record<keyof FormData, string>> => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (s === 1) {
      if (!form.anfrage_vorname.trim()) errs.anfrage_vorname = tx('Pflichtfeld');
      if (!form.anfrage_nachname.trim()) errs.anfrage_nachname = tx('Pflichtfeld');
      if (!form.anfrage_email.trim()) errs.anfrage_email = tx('Pflichtfeld');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.anfrage_email))
        errs.anfrage_email = tx('Ungültige E-Mail-Adresse');
    }
    if (s === 2) {
      if (!form.hund_name.trim()) errs.hund_name = tx('Pflichtfeld');
    }
    if (s === 3) {
      if (!form.wunsch_anreise) errs.wunsch_anreise = tx('Pflichtfeld');
      if (!form.wunsch_abreise) errs.wunsch_abreise = tx('Pflichtfeld');
      if (form.wunsch_anreise && form.wunsch_abreise && form.wunsch_abreise <= form.wunsch_anreise) {
        errs.wunsch_abreise = tx('Abreise muss nach Anreise liegen');
      }
    }
    return errs;
  };

  const goNext = () => {
    const errs = validate(step);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setStep(s => s + 1);
  };

  const goBack = () => {
    setErrors({});
    setStep(s => s - 1);
  };

  const handleSubmit = async () => {
    const errs = validate(3);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Record<string, string> = {
        anfrage_vorname: form.anfrage_vorname.trim(),
        anfrage_nachname: form.anfrage_nachname.trim(),
        anfrage_email: form.anfrage_email.trim(),
        hund_name: form.hund_name.trim(),
        wunsch_anreise: form.wunsch_anreise,
        wunsch_abreise: form.wunsch_abreise,
      };
      if (form.anfrage_telefon.trim()) payload.anfrage_telefon = form.anfrage_telefon.trim();
      if (form.hund_rasse.trim()) payload.hund_rasse = form.hund_rasse.trim();
      if (form.hund_groesse) payload.hund_groesse = form.hund_groesse;
      if (form.nachricht.trim()) payload.nachricht = form.nachricht.trim();

      await createPublicRecord(cfg, page, payload);
      setSubmitted(true);
    } catch {
      setSubmitError(tx('Deine Anfrage konnte leider nicht gesendet werden. Bitte versuche es erneut.'));
    } finally {
      setSubmitting(false);
    }
  };

  const STEPS = [
    { label: tx('Kontakt') },
    { label: tx('Hund') },
    { label: tx('Zeitraum') },
  ];

  // Success screen
  if (submitted) {
    return (
      <PublicShell title={tx('Buchungsanfrage')} description={tx('Unverbindliche Anfrage für die Hundepension')}>
        <div className="flex flex-col items-center justify-center py-16 gap-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
            <IconCheck size={32} className="text-emerald-600" stroke={2} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              {tx('Anfrage eingegangen!')}
            </h2>
            <p className="text-muted-foreground max-w-sm mx-auto">
              {tx('Vielen Dank, ')}
              <strong>{form.anfrage_vorname}</strong>
              {tx('! Wir haben deine Buchungsanfrage erhalten und melden uns so schnell wie möglich bei dir.')}
            </p>
          </div>
          <div className="rounded-xl border bg-muted/40 p-4 text-sm text-left w-full max-w-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tx('Hund')}</span>
              <span className="font-medium">{form.hund_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tx('Anreise')}</span>
              <span className="font-medium">{form.wunsch_anreise}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{tx('Abreise')}</span>
              <span className="font-medium">{form.wunsch_abreise}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {tx('Eine Bestätigung erhältst du an ')}
            <strong>{form.anfrage_email}</strong>
          </p>
        </div>
      </PublicShell>
    );
  }

  // Today's date for min constraints
  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <PublicShell
      title={tx('Buchungsanfrage')}
      description={tx('Unverbindliche Anfrage für die Hundepension')}
    >
      <div onFocus={handleFirstInteraction}>
        <IntentWizardShell
          subtitle={tx('Fülle das Formular aus — wir melden uns innerhalb von 24 Stunden.')}
          steps={STEPS}
          currentStep={step}
          onStepChange={setStep}
          back={false}
        >
          {/* Step 1: Kontaktdaten */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="anfrage_vorname">
                    {tx('Vorname')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="anfrage_vorname"
                    type="text"
                    value={form.anfrage_vorname}
                    onChange={e => set('anfrage_vorname', e.target.value)}
                    placeholder={tx('z. B. Maria')}
                    autoComplete="given-name"
                  />
                  <FieldError msg={errors.anfrage_vorname} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="anfrage_nachname">
                    {tx('Nachname')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="anfrage_nachname"
                    type="text"
                    value={form.anfrage_nachname}
                    onChange={e => set('anfrage_nachname', e.target.value)}
                    placeholder={tx('z. B. Müller')}
                    autoComplete="family-name"
                  />
                  <FieldError msg={errors.anfrage_nachname} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="anfrage_email">
                  {tx('E-Mail-Adresse')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="anfrage_email"
                  type="email"
                  value={form.anfrage_email}
                  onChange={e => set('anfrage_email', e.target.value)}
                  placeholder={tx('z. B. maria.mueller@beispiel.de')}
                  autoComplete="email"
                />
                <FieldError msg={errors.anfrage_email} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="anfrage_telefon">{tx('Telefonnummer')}</Label>
                <Input
                  id="anfrage_telefon"
                  type="tel"
                  value={form.anfrage_telefon}
                  onChange={e => set('anfrage_telefon', e.target.value)}
                  placeholder={tx('z. B. 0151 12345678')}
                  autoComplete="tel"
                />
                <FieldError msg={errors.anfrage_telefon} />
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={goNext} className="w-full sm:w-auto">
                  {tx('Weiter')}
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Hundeinfo */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="hund_name">
                  {tx('Name des Hundes')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="hund_name"
                  type="text"
                  value={form.hund_name}
                  onChange={e => set('hund_name', e.target.value)}
                  placeholder={tx('z. B. Bello')}
                />
                <FieldError msg={errors.hund_name} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="hund_rasse">{tx('Rasse')}</Label>
                <Input
                  id="hund_rasse"
                  type="text"
                  value={form.hund_rasse}
                  onChange={e => set('hund_rasse', e.target.value)}
                  placeholder={tx('z. B. Labrador')}
                />
                <FieldError msg={errors.hund_rasse} />
              </div>

              <div className="space-y-2">
                <Label>{tx('Größe des Hundes')}</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {GROESSE_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => set('hund_groesse', opt.key)}
                      className={`rounded-xl border-2 px-4 py-3 text-sm font-medium text-left transition-colors ${
                        form.hund_groesse === opt.key
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border bg-background text-foreground hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <IconPaw size={16} className="shrink-0" />
                        {opt.label}
                      </div>
                    </button>
                  ))}
                </div>
                <FieldError msg={errors.hund_groesse} />
              </div>

              <div className="flex justify-between gap-3 pt-2">
                <Button variant="outline" onClick={goBack} className="w-full sm:w-auto">
                  {tx('Zurück')}
                </Button>
                <Button onClick={goNext} className="w-full sm:w-auto">
                  {tx('Weiter')}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Zeitraum + Nachricht */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="wunsch_anreise">
                    {tx('Gewünschte Anreise')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="wunsch_anreise"
                    type="date"
                    value={form.wunsch_anreise}
                    min={today}
                    onChange={e => set('wunsch_anreise', e.target.value)}
                  />
                  <FieldError msg={errors.wunsch_anreise} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wunsch_abreise">
                    {tx('Gewünschte Abreise')} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="wunsch_abreise"
                    type="date"
                    value={form.wunsch_abreise}
                    min={form.wunsch_anreise || today}
                    onChange={e => set('wunsch_abreise', e.target.value)}
                  />
                  <FieldError msg={errors.wunsch_abreise} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="nachricht">{tx('Nachricht / Besondere Wünsche')}</Label>
                <Textarea
                  id="nachricht"
                  value={form.nachricht}
                  onChange={e => set('nachricht', e.target.value)}
                  placeholder={tx('Gibt es etwas, das wir über deinen Hund wissen sollten?')}
                  rows={4}
                />
              </div>

              {submitError && (
                <div className="flex items-start gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
                  {submitError}
                </div>
              )}

              <div className="flex justify-between gap-3 pt-2">
                <Button variant="outline" onClick={goBack} className="w-full sm:w-auto" disabled={submitting}>
                  {tx('Zurück')}
                </Button>
                <Button onClick={handleSubmit} disabled={submitting} className="w-full sm:w-auto">
                  {submitting ? tx('Wird gesendet…') : tx('Anfrage absenden')}
                </Button>
              </div>
            </div>
          )}
        </IntentWizardShell>
      </div>
    </PublicShell>
  );
}
