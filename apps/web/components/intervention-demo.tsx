import { AttentionField } from "@/components/attention-field";

export function InterventionDemo() {
  return (
    <div
      className="intervention-demo"
      aria-label="Demostración de la intervención de Still"
    >
      <div className="intervention-demo__status">
        <span>APP SELECCIONADA</span>
        <span>PAUSA ACTIVA</span>
      </div>
      <AttentionField
        dark
        kind="intervention"
        label="El campo de atención se abre para dejar espacio a una decisión"
      />
      <div className="intervention-demo__copy">
        <h2>
          Una apertura automática
          <br />se vuelve visible.
        </h2>
        <p>¿Qué quieres de la ventana de tiempo configurada?</p>
      </div>
      <div className="intervention-demo__actions" aria-hidden="true">
        <span className="demo-action demo-action--primary">Volver</span>
        <span className="demo-action demo-action--secondary">
          Usar 1 pase <b>→</b>
        </span>
      </div>
      <p className="intervention-demo__note">
        El campo se abre una vez. Un háptico. Sin rebote.
      </p>
    </div>
  );
}
