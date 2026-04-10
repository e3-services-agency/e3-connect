import React, { useRef, KeyboardEvent, useState, useEffect } from 'react';
import { StepProps } from '../../types/scheduling';

const InviteStep: React.FC<StepProps> = ({ appState, onNext, onBack, onStateChange, isEmbed }) => {
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [localGuestEmails, setLocalGuestEmails] = useState<string[]>(appState.guestEmails || []);

  useEffect(() => {
    setLocalGuestEmails(appState.guestEmails || []);
  }, [appState.guestEmails]);

  const handleEmailInput = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const email = emailInputRef.current?.value.trim();
      if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (!localGuestEmails.includes(email)) {
          const newEmails = [...localGuestEmails, email];
          setLocalGuestEmails(newEmails);
          onStateChange({
            guestEmails: newEmails,
          });
        }
        if (emailInputRef.current) {
          emailInputRef.current.value = '';
        }
      }
    }
  };

  const removeEmail = (emailToRemove: string) => {
    const newEmails = localGuestEmails.filter((email) => email !== emailToRemove);
    setLocalGuestEmails(newEmails);
    onStateChange({
      guestEmails: newEmails,
    });
  };

  const heading = isEmbed ? 'text-slate-900' : 'text-e3-white';
  const sub = isEmbed ? 'text-slate-600' : 'text-e3-white/70';
  const chip = isEmbed
    ? 'inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-sm text-slate-800'
    : 'email-chip';

  return (
    <div
      className={`step animate-fade-in ${isEmbed ? 'pb-2 max-w-md mx-auto' : 'pb-48 max-w-md mx-auto min-h-[50vh] flex flex-col'}`}
      aria-labelledby="step5-heading"
    >
      <h2 id="step5-heading" className={`text-lg sm:text-xl font-bold mb-2 ${isEmbed ? 'text-left' : 'text-center'} ${heading}`}>
        Additional guests (optional)
      </h2>
      <p className={`text-sm sm:text-base mb-4 ${isEmbed ? 'text-left' : 'text-center'} ${sub}`}>
        Add emails for anyone else who should receive the invite, or leave blank.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        {localGuestEmails.map((email) => (
          <div key={email} className={chip}>
            <span>{email}</span>
            <button
              type="button"
              onClick={() => removeEmail(email)}
              aria-label={`Remove ${email}`}
              className="ml-2 hover:opacity-100 opacity-70 transition-opacity"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <input
        ref={emailInputRef}
        type="email"
        placeholder="Email and press Enter"
        onKeyDown={handleEmailInput}
        className={
          isEmbed
            ? 'focusable w-full p-3 mb-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-e3-azure outline-none text-slate-900 placeholder-slate-400'
            : 'focusable w-full p-3 mb-10 bg-e3-space-blue border border-e3-azure rounded-lg focus:ring-2 focus:ring-e3-azure outline-none text-e3-white placeholder-e3-white/50'
        }
      />

      {!isEmbed && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-e3-space-blue/95 backdrop-blur-md border-t border-e3-white/10 z-50">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row justify-between gap-3 sm:gap-4">
            <button
              onClick={onBack}
              className="order-2 sm:order-1 w-full sm:w-auto py-3 px-6 text-e3-white/80 hover:text-e3-white transition rounded-lg border border-e3-white/20 hover:border-e3-white/40"
            >
              Back
            </button>
            <button onClick={onNext} className="order-1 sm:order-2 w-full sm:w-auto cta">
              Next: Review Booking
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InviteStep;
