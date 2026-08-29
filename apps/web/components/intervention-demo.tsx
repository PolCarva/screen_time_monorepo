export function InterventionDemo() {
  return (
    <div className="intervention-demo" aria-label="Demostración de una pausa de Still">
      <div className="intervention-demo__rail" aria-hidden="true">
        <span>14:31:59</span>
        <span className="is-current">14:32:00</span>
        <span>14:32:01</span>
      </div>
      <div className="intervention-demo__screen">
        <div className="intervention-demo__status">
          <span>14:32</span>
          <span>STILL / PAUSA</span>
        </div>
        <div className="intervention-demo__cut" aria-hidden="true">
          <span />
          <b>00:01</b>
          <span />
        </div>
        <div className="intervention-demo__copy">
          <p className="mono-label">ANTES DE ENTRAR</p>
          <h2>¿Aún quieres entrar?</h2>
          <p>Llevas 1 h 14 min hoy en las apps elegidas.</p>
        </div>
        <div className="intervention-demo__actions">
          <span className="demo-action demo-action--primary">No entrar</span>
          <span className="demo-action demo-action--secondary">Usar 1 pase · 10 min</span>
        </div>
      </div>
    </div>
  );
}
