import { useEffect, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  createPublicRecord,
  prepareChallenge,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { tx } from '@/i18n';
import { format } from 'date-fns';
import {
  IconArrowRight,
  IconArrowLeft,
  IconSend,
  IconCircleCheck,
  IconPaw,
  IconUser,
  IconCalendar,
} from '@tabler/icons-react';

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

const INITIAL: FormData = {
  anfrage_vorname: '',
  anfrage_nachname: '',
  anfrage_telefon: '',
  anfrage_email: '',
  hund_name: '',
  hund_rasse: '',
  hund_groesse: '',
  wunsch_anreise: '',
  wunsch_abreise: '',
  nachricht: '',
};

export default function Buchungsanfrage() {
  const [cfg, setCfg] = useState<PublicPagesConfig | null>(null);
  const [page, setPage] = useState<PublicPageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    loadPublicPagesConfig(SLUG).then(c => {
      if (!c) { setUnavailable(true); setLoading(false); return; }
      setCfg(c);
      const p = c.pages[SLUG] ?? null;
      setPage(p);
      setUnavailable(!p);
      setLoading(false);
    }).catch(err => {
      if (err instanceof PageUnavailableError) setUnavailable(true);
      setLoading(false);
    });
  }, []);

  // Pre-warm challenge on first interaction
  const handleFirstInteraction = () => {
    if (!cfg || !page) return;
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (ep?.app_id) {
      prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`);
    }
  };

  const set = (field: keyof FormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm(f => ({ ...f, [field]: e.target.value }));
    setErrors(er => ({ ...er, [field]: undefined }));
  };

  const setLookup = (field: keyof FormData, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setErrors(er => ({ ...er, [field]: undefined }));
  };

  // Validation per step
  const validateStep1 = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!form.anfrage_vorname.trim()) errs.anfrage_vorname = tx('Bitte Vorname eingeben');
    if (!form.anfrage_nachname.trim()) errs.anfrage_nachname = tx('Bitte Nachname eingeben');
    if (!form.anfrage_email.trim()) errs.anfrage_email = tx('Bitte E-Mail eingeben');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.anfrage_email))
      errs.anfrage_email = tx('Bitte gültige E-Mail eingeben');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!form.hund_name.trim()) errs.hund_name = tx('Bitte Name des Hundes eingeben');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep3 = (): boolean => {
    const errs: Partial<Record<keyof FormData, string>> = {};
    if (!form.wunsch_anreise) errs.wunsch_anreise = tx('Bitte Anreisedatum wählen');
    if (!form.wunsch_abreise) errs.wunsch_abreise = tx('Bitte Abreisedatum wählen');
    else if (form.wunsch_anreise && form.wunsch_abreise <= form.wunsch_anreise)
      errs.wunsch_abreise = tx('Abreise muss nach Anreise liegen');
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goNext = () => {
    const valid = step === 1 ? validateStep1() : step === 2 ? validateStep2() : true;
    if (valid) setStep(s => s + 1);
  };

  const goBack = () => {
    setErrors({});
    setStep(s => s - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;
    if (!cfg || !page) return;
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
      setSubmitError(tx('Die Anfrage konnte nicht gesendet werden. Bitte versuche es erneut.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || unavailable) {
    return <PublicShell loading={loading} unavailable={unavailable} />;
  }

  const steps = [
    { label: tx('Kontakt') },
    { label: tx('Hund') },
    { label: tx('Zeitraum') },
  ];

  const today = format(new Date(), 'yyyy-MM-dd');

  if (submitted) {
    return (
      <PublicShell title={tx('Buchungsanfrage')} wide>
        <div className="flex flex-col items-center justify-center py-16 gap-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <IconCircleCheck size={36} className="text-emerald-600" stroke={1.5} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground mb-2">
              {tx('Anfrage gesendet!')}
            </h2>
            <p className="text-muted-foreground max-w-sm">
              {tx('Vielen Dank, ')}
              {form.anfrage_vorname}
              {tx('! Wir melden uns so schnell wie möglich bei dir.')}
            </p>
          </div>
          <div className="rounded-xl border bg-muted/40 px-6 py-4 text-sm text-left w-full max-w-sm space-y-1">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{tx('Hund')}</span>
              <span className="font-medium">{form.hund_name}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{tx('Anreise')}</span>
              <span className="font-medium">{form.wunsch_anreise}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">{tx('Abreise')}</span>
              <span className="font-medium">{form.wunsch_abreise}</span>
            </div>
          </div>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell title={tx('Buchungsanfrage')} description={tx('Unverbindliche Anfrage für deinen Hund — kostenlos und ohne Anmeldung.')} wide>
      <IntentWizardShell
        subtitle={tx('Schritt für Schritt zur Anfrage')}
        steps={steps}
        currentStep={step}
        onStepChange={setStep}
        back={false}
      >
        {/* Step 1: Kontaktdaten */}
        {step === 1 && (
          <div className="space-y-5" onFocus={handleFirstInteraction}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <IconUser size={16} className="text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">{tx('Wie können wir dich erreichen?')}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="anfrage_vorname">
                  {tx('Vorname')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="anfrage_vorname"
                  value={form.anfrage_vorname}
                  onChange={set('anfrage_vorname')}
                  autoComplete="given-name"
                  placeholder=""
                />
                {errors.anfrage_vorname && (
                  <p className="text-xs text-destructive">{errors.anfrage_vorname}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="anfrage_nachname">
                  {tx('Nachname')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="anfrage_nachname"
                  value={form.anfrage_nachname}
                  onChange={set('anfrage_nachname')}
                  autoComplete="family-name"
                  placeholder=""
                />
                {errors.anfrage_nachname && (
                  <p className="text-xs text-destructive">{errors.anfrage_nachname}</p>
                )}
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
                onChange={set('anfrage_email')}
                autoComplete="email"
                placeholder=""
              />
              {errors.anfrage_email && (
                <p className="text-xs text-destructive">{errors.anfrage_email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="anfrage_telefon">{tx('Telefonnummer')}</Label>
              <Input
                id="anfrage_telefon"
                type="tel"
                value={form.anfrage_telefon}
                onChange={set('anfrage_telefon')}
                autoComplete="tel"
                placeholder=""
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={goNext} className="gap-2">
                {tx('Weiter')}
                <IconArrowRight size={16} className="shrink-0" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Hund beschreiben */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <IconPaw size={16} className="text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">{tx('Erzähl uns von deinem Hund.')}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hund_name">
                {tx('Name des Hundes')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="hund_name"
                value={form.hund_name}
                onChange={set('hund_name')}
                placeholder=""
              />
              {errors.hund_name && (
                <p className="text-xs text-destructive">{errors.hund_name}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hund_rasse">{tx('Rasse')}</Label>
              <Input
                id="hund_rasse"
                value={form.hund_rasse}
                onChange={set('hund_rasse')}
                placeholder=""
              />
            </div>

            <div className="space-y-2">
              <Label>{tx('Größe des Hundes')}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { key: 'klein', label: tx('Klein'), sub: tx('bis 10 kg') },
                  { key: 'mittel', label: tx('Mittel'), sub: tx('10–25 kg') },
                  { key: 'gross', label: tx('Groß'), sub: tx('über 25 kg') },
                ].map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setLookup('hund_groesse', opt.key)}
                    className={`rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      form.hund_groesse === opt.key
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border bg-background hover:border-primary/40 text-foreground'
                    }`}
                  >
                    <div className="font-medium text-sm">{opt.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={goBack} className="gap-2">
                <IconArrowLeft size={16} className="shrink-0" />
                {tx('Zurück')}
              </Button>
              <Button onClick={goNext} className="gap-2">
                {tx('Weiter')}
                <IconArrowRight size={16} className="shrink-0" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Wunschzeitraum */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <IconCalendar size={16} className="text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">{tx('Wann soll dein Hund bei uns sein?')}</p>
            </div>

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
                  onChange={set('wunsch_anreise')}
                />
                {errors.wunsch_anreise && (
                  <p className="text-xs text-destructive">{errors.wunsch_anreise}</p>
                )}
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
                  onChange={set('wunsch_abreise')}
                />
                {errors.wunsch_abreise && (
                  <p className="text-xs text-destructive">{errors.wunsch_abreise}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="nachricht">{tx('Nachricht / Besondere Wünsche')}</Label>
              <Textarea
                id="nachricht"
                value={form.nachricht}
                onChange={set('nachricht')}
                rows={4}
                placeholder=""
              />
            </div>

            {submitError && (
              <p className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                {submitError}
              </p>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={goBack} className="gap-2">
                <IconArrowLeft size={16} className="shrink-0" />
                {tx('Zurück')}
              </Button>
              <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                <IconSend size={16} className="shrink-0" />
                {submitting ? tx('Wird gesendet …') : tx('Anfrage absenden')}
              </Button>
            </div>
          </div>
        )}
      </IntentWizardShell>
    </PublicShell>
  );
}
