import { AttentionField } from "@/components/attention-field";

export function InterventionDemo() {
  return (
    <div className="intervention-demo" aria-label="Demostración de la intervención de Still">
      <div className="intervention-demo__status">
        <span>INSTAGRAM</span>
        <span>00:01</span>
      </div>
      <AttentionField dark kind="intervention" label="El campo de atención se abre para dejar espacio a una decisión" />
      <div className="intervention-demo__copy">
        <h2>Instagram se abrió<br />7 veces hoy.</h2>
        <p>¿Qué quieres de los próximos 10 minutos?</p>
      </div>
      <div className="intervention-demo__actions" aria-hidden="true">
        <span className="demo-action demo-action--primary">Volver</span>
        <span className="demo-action demo-action--secondary">Usar 1 pase · 10 min <b>→</b></span>
      </div>
      <p className="intervention-demo__note">El campo se abre una vez. Un háptico. Sin rebote.</p>
    </div>
  );
}
