import { useEffect, useRef, useState } from 'react';
import { PublicShell } from '@/components/PublicShell';
import {
  loadPublicPagesConfig,
  createPublicRecord,
  prepareChallenge,
  PageUnavailableError,
  type PublicPagesConfig,
  type PublicPageConfig,
} from '@/lib/publicClient';
import { tx } from '@/i18n';
import { format } from 'date-fns';
import { IconPaw, IconCheck, IconAlertCircle, IconLoader2 } from '@tabler/icons-react';

const SLUG = 'buchungsanfrage';

type FormState = {
  anfrage_vorname: string;
  anfrage_nachname: string;
  anfrage_email: string;
  anfrage_telefon: string;
  hund_name: string;
  hund_rasse: string;
  hund_groesse: string;
  wunsch_anreise: string;
  wunsch_abreise: string;
  nachricht: string;
};

const INITIAL: FormState = {
  anfrage_vorname: '',
  anfrage_nachname: '',
  anfrage_email: '',
  anfrage_telefon: '',
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

  const [form, setForm] = useState<FormState>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const challengeRef = useRef(false);

  useEffect(() => {
    loadPublicPagesConfig(SLUG)
      .then(c => {
        setCfg(c);
        setPage(c?.pages[SLUG] ?? null);
        setLoading(false);
      })
      .catch(err => {
        if (err instanceof PageUnavailableError) setUnavailable(true);
        else setUnavailable(true);
        setLoading(false);
      });
  }, []);

  const handleFirstInteraction = () => {
    if (challengeRef.current || !cfg || !page) return;
    const ep = page.endpoints?.find(e => e.op === 'create');
    if (!ep) return;
    challengeRef.current = true;
    prepareChallenge(cfg, page, 'POST', `/apps/${ep.app_id}/records`).catch(() => {});
  };

  const setField = (key: keyof FormState, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.anfrage_vorname.trim()) e.anfrage_vorname = tx('Bitte Vorname angeben');
    if (!form.anfrage_nachname.trim()) e.anfrage_nachname = tx('Bitte Nachname angeben');
    if (!form.anfrage_email.trim()) e.anfrage_email = tx('Bitte E-Mail-Adresse angeben');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.anfrage_email))
      e.anfrage_email = tx('Bitte eine gültige E-Mail-Adresse angeben');
    if (!form.hund_name.trim()) e.hund_name = tx('Bitte Namen des Hundes angeben');
    if (!form.wunsch_anreise) e.wunsch_anreise = tx('Bitte Anreisedatum wählen');
    if (!form.wunsch_abreise) e.wunsch_abreise = tx('Bitte Abreisedatum wählen');
    if (form.wunsch_anreise && form.wunsch_abreise && form.wunsch_abreise <= form.wunsch_anreise)
      e.wunsch_abreise = tx('Abreise muss nach der Anreise liegen');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!cfg || !page) return;
    if (!validate()) return;

    const ep = page.endpoints?.find(e => e.op === 'create');
    if (!ep) return;

    setSubmitting(true);
    setSubmitError(null);

    const today = format(new Date(), 'yyyy-MM-dd');
    if (form.wunsch_anreise < today) {
      setErrors(e => ({ ...e, wunsch_anreise: tx('Anreise darf nicht in der Vergangenheit liegen') }));
      setSubmitting(false);
      return;
    }

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
      setSubmitError(tx('Es ist ein Fehler aufgetreten. Bitte versuche es erneut oder ruf uns direkt an.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || unavailable) {
    return <PublicShell loading={loading} unavailable={unavailable} />;
  }

  if (!page) {
    return <PublicShell unavailable />;
  }

  if (submitted) {
    return (
      <PublicShell title={tx('Buchungsanfrage')} description={tx('Ihre Anfrage wurde erfolgreich übermittelt')}>
        <div className="flex flex-col items-center gap-6 py-12 text-center">
          <div className="flex items-center justify-center w-20 h-20 rounded-full bg-emerald-100">
            <IconCheck size={40} className="text-emerald-600" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">{tx('Anfrage eingegangen!')}</h2>
            <p className="text-muted-foreground max-w-sm">
              {tx('Vielen Dank für deine Anfrage. Wir melden uns schnellstmöglich bei dir, um deinen Aufenthalt zu bestätigen.')}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-3">
            <IconPaw size={16} className="shrink-0 text-amber-600" />
            <span>{tx('Wir freuen uns darauf, deinen Liebling bei uns willkommen zu heißen!')}</span>
          </div>
          <button
            type="button"
            onClick={() => { setForm(INITIAL); setSubmitted(false); setErrors({}); }}
            className="text-sm text-primary underline underline-offset-2 hover:no-underline"
          >
            {tx('Weitere Anfrage stellen')}
          </button>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell
      title={tx('Buchungsanfrage')}
      description={tx('Schick uns unverbindlich eine Anfrage — wir melden uns schnell zurück.')}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <form onFocus={handleFirstInteraction} onClick={handleFirstInteraction} onSubmit={handleSubmit} noValidate>
        <div className="space-y-8">

          {/* Kontaktdaten */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-foreground border-b pb-2">{tx('Deine Kontaktdaten')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="anfrage_vorname" className="block text-sm font-medium text-foreground">
                  {tx('Vorname')} <span className="text-destructive">*</span>
                </label>
                <input
                  id="anfrage_vorname"
                  type="text"
                  autoComplete="given-name"
                  value={form.anfrage_vorname}
                  onChange={e => setField('anfrage_vorname', e.target.value)}
                  className={`w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 transition ${errors.anfrage_vorname ? 'border-destructive' : 'border-input'}`}
                  placeholder="Max"
                />
                {errors.anfrage_vorname && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <IconAlertCircle size={12} className="shrink-0" />{errors.anfrage_vorname}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label htmlFor="anfrage_nachname" className="block text-sm font-medium text-foreground">
                  {tx('Nachname')} <span className="text-destructive">*</span>
                </label>
                <input
                  id="anfrage_nachname"
                  type="text"
                  autoComplete="family-name"
                  value={form.anfrage_nachname}
                  onChange={e => setField('anfrage_nachname', e.target.value)}
                  className={`w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 transition ${errors.anfrage_nachname ? 'border-destructive' : 'border-input'}`}
                  placeholder="Mustermann"
                />
                {errors.anfrage_nachname && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <IconAlertCircle size={12} className="shrink-0" />{errors.anfrage_nachname}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="anfrage_email" className="block text-sm font-medium text-foreground">
                {tx('E-Mail-Adresse')} <span className="text-destructive">*</span>
              </label>
              <input
                id="anfrage_email"
                type="email"
                autoComplete="email"
                value={form.anfrage_email}
                onChange={e => setField('anfrage_email', e.target.value)}
                className={`w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 transition ${errors.anfrage_email ? 'border-destructive' : 'border-input'}`}
                placeholder="max@beispiel.de"
              />
              {errors.anfrage_email && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <IconAlertCircle size={12} className="shrink-0" />{errors.anfrage_email}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <label htmlFor="anfrage_telefon" className="block text-sm font-medium text-foreground">
                {tx('Telefonnummer')} <span className="text-xs text-muted-foreground ml-1">{tx('(optional)')}</span>
              </label>
              <input
                id="anfrage_telefon"
                type="tel"
                autoComplete="tel"
                value={form.anfrage_telefon}
                onChange={e => setField('anfrage_telefon', e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 transition"
                placeholder="+49 123 456789"
              />
            </div>
          </section>

          {/* Angaben zum Hund */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-foreground border-b pb-2">{tx('Angaben zu deinem Hund')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="hund_name" className="block text-sm font-medium text-foreground">
                  {tx('Name des Hundes')} <span className="text-destructive">*</span>
                </label>
                <input
                  id="hund_name"
                  type="text"
                  value={form.hund_name}
                  onChange={e => setField('hund_name', e.target.value)}
                  className={`w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 transition ${errors.hund_name ? 'border-destructive' : 'border-input'}`}
                  placeholder="Bello"
                />
                {errors.hund_name && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <IconAlertCircle size={12} className="shrink-0" />{errors.hund_name}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label htmlFor="hund_rasse" className="block text-sm font-medium text-foreground">
                  {tx('Rasse')} <span className="text-xs text-muted-foreground ml-1">{tx('(optional)')}</span>
                </label>
                <input
                  id="hund_rasse"
                  type="text"
                  value={form.hund_rasse}
                  onChange={e => setField('hund_rasse', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 transition"
                  placeholder="Labrador"
                />
              </div>
            </div>

            {/* Größe als Kacheln */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                {tx('Größe des Hundes')} <span className="text-xs text-muted-foreground ml-1">{tx('(optional)')}</span>
              </p>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { key: 'klein', label: tx('Klein'), sub: tx('bis 10 kg') },
                  { key: 'mittel', label: tx('Mittel'), sub: tx('10–25 kg') },
                  { key: 'gross', label: tx('Groß'), sub: tx('über 25 kg') },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setField('hund_groesse', form.hund_groesse === opt.key ? '' : opt.key)}
                    className={`rounded-lg border-2 px-3 py-3 text-center transition focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                      form.hund_groesse === opt.key
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-input bg-background text-foreground hover:border-primary/40'
                    }`}
                  >
                    <div className="text-sm font-semibold">{opt.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Reisezeitraum */}
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-foreground border-b pb-2">{tx('Gewünschter Aufenthalt')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="wunsch_anreise" className="block text-sm font-medium text-foreground">
                  {tx('Anreise')} <span className="text-destructive">*</span>
                </label>
                <input
                  id="wunsch_anreise"
                  type="date"
                  min={format(new Date(), 'yyyy-MM-dd')}
                  value={form.wunsch_anreise}
                  onChange={e => setField('wunsch_anreise', e.target.value)}
                  className={`w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 transition ${errors.wunsch_anreise ? 'border-destructive' : 'border-input'}`}
                />
                {errors.wunsch_anreise && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <IconAlertCircle size={12} className="shrink-0" />{errors.wunsch_anreise}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label htmlFor="wunsch_abreise" className="block text-sm font-medium text-foreground">
                  {tx('Abreise')} <span className="text-destructive">*</span>
                </label>
                <input
                  id="wunsch_abreise"
                  type="date"
                  min={form.wunsch_anreise || format(new Date(), 'yyyy-MM-dd')}
                  value={form.wunsch_abreise}
                  onChange={e => setField('wunsch_abreise', e.target.value)}
                  className={`w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 transition ${errors.wunsch_abreise ? 'border-destructive' : 'border-input'}`}
                />
                {errors.wunsch_abreise && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <IconAlertCircle size={12} className="shrink-0" />{errors.wunsch_abreise}
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Nachricht */}
          <section className="space-y-2">
            <label htmlFor="nachricht" className="block text-sm font-medium text-foreground">
              {tx('Nachricht / Besondere Wünsche')} <span className="text-xs text-muted-foreground ml-1">{tx('(optional)')}</span>
            </label>
            <textarea
              id="nachricht"
              rows={4}
              value={form.nachricht}
              onChange={e => setField('nachricht', e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/50 transition resize-y"
              placeholder={tx('Besonderheiten, Medikamente, Fütterungshinweise …')}
            />
          </section>

          {/* Fehler-Meldung */}
          {submitError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <IconAlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Absenden */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <><IconLoader2 size={16} className="animate-spin shrink-0" />{tx('Wird gesendet …')}</>
            ) : (
              <><IconPaw size={16} className="shrink-0" />{tx('Anfrage unverbindlich absenden')}</>
            )}
          </button>

          <p className="text-xs text-center text-muted-foreground">
            {tx('Diese Anfrage ist unverbindlich. Wir melden uns per E-Mail oder Telefon bei dir.')}
          </p>
        </div>
      </form>
    </PublicShell>
  );
}
