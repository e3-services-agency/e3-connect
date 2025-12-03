import React, { useState, useEffect } from 'react';
import { User, Mail } from 'lucide-react';
import { StepProps } from '../../types/scheduling';

const BookerInfoStep: React.FC<StepProps> = ({ appState, onNext, onBack, onStateChange }) => {
  const [email, setEmail] = useState(appState.bookerEmail || '');
  const [errors, setErrors] = useState<{ email?: string }>({});

  useEffect(() => {
    onStateChange({
      bookerEmail: email
    });
  }, [email, onStateChange]);

  const validateForm = () => {
    const newErrors: { email?: string } = {};
    
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

  return (
    <div className="step animate-fade-in max-w-md mx-auto" aria-labelledby="step4-heading">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-e3-emerald/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-e3-emerald" />
        </div>
        <h2 id="step4-heading" className="text-2xl font-bold text-e3-white mb-2">
          Your Information
        </h2>
        <p className="text-e3-white/70">
          Please provide your contact details so we can send you the meeting confirmation.
        </p>
      </div>
      
      <div className="space-y-6">
        <div>
          <label htmlFor="booker-email" className="block text-sm font-medium text-e3-white mb-2">
            Email Address *
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-e3-white/60" />
            <input
              id="booker-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full pl-10 pr-4 py-3 bg-e3-space-blue/50 border rounded-lg text-e3-white placeholder-e3-white/60 focus:outline-none focus:ring-2 focus:ring-e3-azure transition ${
                errors.email 
                  ? 'border-red-400 focus:ring-red-400' 
                  : 'border-e3-white/20 focus:border-e3-azure'
              }`}
              placeholder="Enter your email address"
            />
          </div>
          {errors.email && (
            <p className="text-red-400 text-sm mt-1">{errors.email}</p>
          )}
          <p className="text-e3-white/60 text-sm mt-1">
            We'll send the meeting confirmation and calendar invite to this email.
          </p>
        </div>
      </div>
      
      <div className="mt-8 flex flex-col sm:flex-row justify-between gap-4">
        <button 
          onClick={onBack} 
          className="order-2 sm:order-1 py-3 px-6 text-e3-white/80 hover:text-e3-white transition rounded-lg border border-e3-white/20 hover:border-e3-white/40"
        >
          Back
        </button>
        <button 
          onClick={handleNext}
          className="order-1 sm:order-2 cta"
        >
          Next: Add Guests
        </button>
      </div>

      {/* Sticky CTA for mobile */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-e3-space-blue/95 backdrop-blur-sm border-t border-e3-white/10 sm:hidden z-50">
        <button 
          onClick={handleNext}
          className="w-full cta"
        >
          Next: Add Guests
        </button>
      </div>
    </div>
  );
};

export default BookerInfoStep;