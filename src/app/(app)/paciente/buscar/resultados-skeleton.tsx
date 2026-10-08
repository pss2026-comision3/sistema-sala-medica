const skeleton = "block rounded-[5px] bg-[#e5edef] motion-safe:animate-pulse";

export function ResultadosSkeleton() {
  return (
    <div aria-busy="true" role="status">
      <section aria-label="Cargando fechas con atención">
        <div className="sigsam-section-head">
          <h2>Fechas con atención</h2>
        </div>
        <div
          className="sigsam-card !p-[18px] max-[600px]:!p-3"
          aria-hidden="true"
        >
          <div className="mb-[14px] flex items-center justify-between gap-3">
            <span className={`${skeleton} h-9 w-9`} />
            <span className={`${skeleton} h-5 w-[150px]`} />
            <span className={`${skeleton} h-9 w-9`} />
          </div>
          <div className="grid grid-cols-7 gap-1.5 max-[600px]:gap-[3px]">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((dia) => (
              <span
                key={dia}
                className="text-muted py-[5px] text-center text-xs font-bold"
              >
                {dia}
              </span>
            ))}
            {Array.from({ length: 42 }, (_, indice) => (
              <span
                key={indice}
                className={`${skeleton} min-h-[52px] w-full max-[600px]:min-h-[42px]`}
              />
            ))}
          </div>
          <span className={`${skeleton} mt-3 h-[14px] w-[65%]`} />
        </div>
      </section>
      <span className="sr-only">Cargando horarios…</span>
    </div>
  );
}
