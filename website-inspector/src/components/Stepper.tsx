"use client";
import React from "react";

interface StepperProps {
  step: number;
  setStep: (s: number) => void;
  steps: { id: number; label: string; actions?: React.ReactNode }[];
}

export function Stepper({ step, setStep, steps }: StepperProps) {
  return (
    <div className="card p-4 w-full">
      <div className="flex flex-col gap-6">
        {steps.map((s) => (
          <div key={s.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <button
                className={`btn btn-secondary ${step === s.id ? "ring-2 ring-[color:var(--primary)]" : ""}`}
                onClick={() => setStep(s.id)}
                aria-current={step === s.id}
              >
                Step {s.id} – {s.label}
              </button>
              <div className="flex gap-2">{s.actions}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
