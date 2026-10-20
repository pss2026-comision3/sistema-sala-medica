export default function BandejaAvisosMockPage() {
  return (
    <>
      <div className="sigsam-page-head">
        <div>
          <div className="sigsam-eyebrow">SIGSAM</div>
          <h1>Notificaciones</h1>
          <p>Revisá los avisos sobre tus reservas y las de tus pacientes a cargo.</p>
        </div>
      </div>

      <section className="sigsam-card">
        <div className="sigsam-notice info" style={{ marginBottom: "16px" }}>
          <span className="sigsam-notice-symbol" aria-hidden="true">i</span>
          <div>
            <strong>En construcción (US-SIG-033)</strong>
            <p style={{ margin: 0, fontSize: "14px" }}>
              Acá se va a implementar la bandeja de entrada para ver los avisos internos (confirmación, cancelación, suspensión y reprogramación).
            </p>
          </div>
        </div>

        <div className="sigsam-notice info">
          <span className="sigsam-notice-symbol" aria-hidden="true">i</span>
          <div>
            <strong>Recordatorios (US-SIG-032)</strong>
            <p style={{ margin: 0, fontSize: "14px" }}>
              Los recordatorios programados a 24 horas del inicio del turno también se van a insertar en la misma tabla de avisos y van a aparecer en esta lista.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}