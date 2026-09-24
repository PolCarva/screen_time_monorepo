"use client";

import { useId, useState } from "react";

import { LIMITS, projectScreenTime } from "@/lib/calculator";

import styles from "./screen-time-calculator.module.css";

const oneDecimal = new Intl.NumberFormat("es", { maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("es", { maximumFractionDigits: 0 });

/** Everything is computed here; nothing is sent or stored. */
export function ScreenTimeCalculator() {
  const id = useId();
  const [hours, setHours] = useState(5);
  const [age, setAge] = useState(25);
  const [saved, setSaved] = useState(30);
  const result = projectScreenTime({ hoursPerDay: hours, age, minutesSavedPerDay: saved });

  return (
    <form
      aria-label="Calculadora de tiempo en el celular"
      className={styles.calculator}
      onSubmit={(event) => event.preventDefault()}
    >
      <fieldset className={styles.fields}>
        <legend className="sr-only">Tus datos</legend>
        <label className={styles.field} htmlFor={`${id}-hours`}>
          <span>Horas por día en el celular</span>
          <input
            id={`${id}-hours`}
            inputMode="decimal"
            max={LIMITS.hoursPerDay.max}
            min={LIMITS.hoursPerDay.min}
            onChange={(event) => setHours(Number(event.target.value))}
            step={LIMITS.hoursPerDay.step}
            type="number"
            value={hours}
          />
          <span className={styles.hint}>
            Míralo en Tiempo en pantalla (iPhone) o Bienestar digital (Android).
          </span>
        </label>
        <label className={styles.field} htmlFor={`${id}-age`}>
          <span>Tu edad</span>
          <input
            id={`${id}-age`}
            inputMode="numeric"
            max={LIMITS.age.max}
            min={LIMITS.age.min}
            onChange={(event) => setAge(Number(event.target.value))}
            type="number"
            value={age}
          />
        </label>
        <label className={styles.field} htmlFor={`${id}-saved`}>
          <span>¿Cuánto menos por día?</span>
          <select
            id={`${id}-saved`}
            onChange={(event) => setSaved(Number(event.target.value))}
            value={saved}
          >
            <option value={15}>15 minutos</option>
            <option value={30}>30 minutos</option>
            <option value={60}>1 hora</option>
            <option value={90}>1 hora y media</option>
          </select>
        </label>
      </fieldset>
      <output aria-live="polite" className={styles.result} htmlFor={`${id}-hours ${id}-age ${id}-saved`}>
        <p className="eyebrow eyebrow--dark">Resultado</p>
        <p className={styles.big}>{oneDecimal.format(result.yearsUntilHorizon)} años</p>
        <p>
          frente al celular de aquí a los 80 años, a este ritmo. Son{" "}
          <strong>{whole.format(result.daysPerYear)} días completos</strong> cada
          año.
        </p>
        <p className={styles.saved}>
          Con {saved >= 60 ? oneDecimal.format(saved / 60) + (saved === 60 ? " hora" : " horas") : `${saved} minutos`} menos
          por día recuperas <strong>{oneDecimal.format(result.daysSavedPerYear)} días al año</strong>{" "}
          y <strong>{oneDecimal.format(result.yearsSavedUntilHorizon)} años</strong> hasta los 80.
        </p>
      </output>
    </form>
  );
}
