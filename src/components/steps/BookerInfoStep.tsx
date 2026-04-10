import React, { useState, useEffect } from 'react';
import { User, Mail } from 'lucide-react';
import { StepProps } from '../../types/scheduling';

const BookerInfoStep: React.FC<StepProps> = ({
  appState,
  onNext,
  onBack,
  onStateChange,
  isEmbed,
}) => {
  const [name, setName] = useState(appState.bookerName || '');
  const [email, setEmail] = useState(appState.bookerEmail || '');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  useEffect(() => {
    onStateChange({
      bookerName: name,
      bookerEmail: email,
    });
  }, [name, email, onStateChange]);

  const validateForm = () => {
    const newErrors: { name?: string; email?: string } = {};

    if (isEmbed && !name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateForm()) {
      onNext();
    }
  };

  const label = isEmbed ? 'text-slate-700' : 'text-e3-white mb-2';
  const sub = isEmbed ? 'text-slate-500' : 'text-e3-white/70';
  const heading = isEmbed ? 'text-slate-900' : 'text-e3-white';
  const inputBase = isEmbed
    ? 'w-full pl-10 pr-4 py-3 bg-white border rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-e3-azure transition border-slate-200'
    : `w-full pl-10 pr-4 py-3 bg-e3-space-blue/50 border rounded-lg text-e3-white placeholder-e3-white/60 focus:outline-none focus:ring-2 focus:ring-e3-azure transition`;
  const icon = isEmbed ? 'text-slate-400' : 'text-e3-white/60';

  return (
    <div
      className={`step animate-fade-in max-w-md mx-auto ${isEmbed ? 'pb-4' : 'pb-48'}`}
      aria-labelledby="step4-heading"
    >
      <div className={`mb-6 ${isEmbed ? 'text-left' : 'text-center'}`}>
        {!isEmbed && (
          <div className="w-12 h-12 bg-e3-emerald/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <User className="w-6 h-6 text-e3-emerald" />
          </div>
        )}
        <h2 id="step4-heading" className={`text-xl sm:text-2xl font-bold mb-2 ${heading}`}>
          Your information
        </h2>
        <p className={sub}>
          {isEmbed
            ? 'We will send the calendar invite to your email.'
            : 'Please provide your contact details so we can send you the meeting confirmation.'}
        </p>
      </div>

      <div className="space-y-5">
        {isEmbed && (
          <div>
            <label htmlFor="booker-name" className={`block text-sm font-medium mb-2 ${label}`}>
              Full name *
            </label>
            <div className="relative">
              <User className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${icon}`} />
              <input
                id="booker-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`${inputBase} ${
                  errors.name ? 'border-red-400 focus:ring-red-400' : isEmbed ? '' : 'border-e3-white/20 focus:border-e3-azure'
                }`}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
            {errors.name && <p className="text-red-600 text-sm mt-1">{errors.name}</p>}
          </div>
        )}

        <div>
          <label htmlFor="booker-email" className={`block text-sm font-medium ${label}`}>
            Email address *
          </label>
          <div className="relative mt-2">
            <Mail className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 ${icon}`} />
            <input
              id="booker-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputBase} pl-10 ${
                errors.email
                  ? 'border-red-400 focus:ring-red-400'
                  : isEmbed
                    ? 'border-slate-200'
                    : 'border-e3-white/20 focus:border-e3-azure'
              }`}
              placeholder="you@company.com"
              autoComplete="email"
            />
          </div>
          {errors.email && <p className="text-red-600 text-sm mt-1">{errors.email}</p>}
          <p className={`text-sm mt-1 ${isEmbed ? 'text-slate-500' : 'text-e3-white/60'}`}>
            We will send the meeting confirmation and calendar invite to this email.
          </p>
        </div>
      </div>

      {!isEmbed && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-e3-space-blue/95 backdrop-blur-md border-t border-e3-white/10 z-50">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row justify-between gap-3 sm:gap-4">
            <button
              onClick={onBack}
              className="order-2 sm:order-1 w-full sm:w-auto py-3 px-6 text-e3-white/80 hover:text-e3-white transition rounded-lg border border-e3-white/20 hover:border-e3-white/40"
            >
              Back
            </button>
            <button onClick={handleNext} className="order-1 sm:order-2 w-full sm:w-auto cta">
              Next: Add Guests
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookerInfoStep;
