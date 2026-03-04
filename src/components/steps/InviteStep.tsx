import React, { useRef, KeyboardEvent, useState, useEffect } from 'react';
import { StepProps } from '../../types/scheduling';

const InviteStep: React.FC<StepProps> = ({ appState, onNext, onBack, onStateChange }) => {
  const emailInputRef = useRef<HTMLInputElement>(null);
  const [localGuestEmails, setLocalGuestEmails] = useState<string[]>(appState.guestEmails || []);

  // Sync local state with app state when step loads
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
          // Immediately update the app state
          onStateChange({
            guestEmails: newEmails
          });
        }
        if (emailInputRef.current) {
          emailInputRef.current.value = '';
        }
      }
    }
  };

  const removeEmail = (emailToRemove: string) => {
    const newEmails = localGuestEmails.filter(email => email !== emailToRemove);
    setLocalGuestEmails(newEmails);
    onStateChange({
      guestEmails: newEmails
    });
  };

  return (
    <div className="step animate-fade-in pb-48 max-w-md mx-auto min-h-[50vh] flex flex-col" aria-labelledby="step5-heading">
      <h2 id="step5-heading" className="text-xl sm:text-2xl font-bold text-e3-white text-center mb-2">Invite Guests (Optional)</h2>
      <p className="text-e3-white/70 text-sm sm:text-base mb-6 text-center">Add email addresses for anyone else you'd like to invite, or click "Next" to proceed without guests.</p>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {localGuestEmails.map(email => (
          <div key={email} className="email-chip">
            <span>{email}</span>
            <button 
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
        placeholder="Enter an email and press Enter"
        onKeyDown={handleEmailInput}
        className="focusable w-full p-3 bg-e3-space-blue border border-e3-azure rounded-lg focus:ring-2 focus:ring-e3-azure outline-none text-e3-white placeholder-e3-white/50"
      />
      
      {/* Unified Sticky Footer (Mobile & Desktop) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-e3-space-blue/95 backdrop-blur-md border-t border-e3-white/10 z-50">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row justify-between gap-3 sm:gap-4">
          <button 
            onClick={onBack} 
            className="order-2 sm:order-1 w-full sm:w-auto py-3 px-6 text-e3-white/80 hover:text-e3-white transition rounded-lg border border-e3-white/20 hover:border-e3-white/40"
          >
            Back
          </button>
          <button 
            onClick={onNext} 
            className="order-1 sm:order-2 w-full sm:w-auto cta"
          >
            Next: Review Booking
          </button>
        </div>
      </div>
    </div>
  );
};

export default InviteStep;